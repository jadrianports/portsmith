/**
 * Mailpit two-OTP helper for the secure email-change flow (ACCT-02 / D-05).
 *
 * The local Supabase stack's mail catcher is MAILPIT (`supabase/mailpit`,
 * container port 8025 → host `:54324`) — NOT Inbucket. Use the Mailpit v1 HTTP
 * API: `GET /api/v1/messages` to list, `GET /api/v1/message/{id}` to fetch one
 * message's body. (MEMORY: local-mailpit-not-inbucket — the planning docs that
 * say "Inbucket" are wrong for this stack.)
 *
 * WHY TWO TOKENS: with `double_confirm_changes = true` (config.toml:121), calling
 * `updateUser({ email })` makes gotrue send TWO emails — one to the OLD address,
 * one to the NEW address — each carrying its own single-use `token_hash` with
 * `type=email_change`. Both must be verified (`verifyOtp`) before the change takes
 * effect; gotrue tracks the half-confirmed state server-side. This helper polls
 * Mailpit for messages to a given recipient and extracts every `token_hash` query
 * param from the change-email confirm links in the bodies.
 *
 * This is a helper module (no `.test.ts` suffix) so the vitest `integration`
 * project never runs it as a test file. LOCAL STACK ONLY.
 *
 * NOTE (environment): the new `[auth.email.template.email_change]` config block
 * authored in this plan only takes effect after Supabase is RESTARTED. Until then
 * gotrue uses its built-in email-change default (a `{{ .ConfirmationURL }}`
 * `?code=` link, no `token_hash`), so `extractTokenHashes` will find zero hashes
 * and `fetchChangeEmailTokens` will time out — this is the EXPECTED red state for
 * the change-email test in this plan (the orchestrator restarts Supabase before
 * Wave 2). The token extractor handles both link forms defensively.
 */

/** Mailpit's HTTP API base on the local Supabase stack (host port 54324 → 8025). */
const MAILPIT_BASE = 'http://127.0.0.1:54324';

interface MailpitMessageSummary {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

interface MailpitMessagesList {
  messages: MailpitMessageSummary[];
}

interface MailpitMessageDetail {
  ID: string;
  /** Plain-text body (Mailpit returns both Text and HTML when present). */
  Text: string;
  HTML: string;
}

/**
 * Extract every `token_hash` value from change-email confirm links in a message
 * body. Matches the `/auth/confirm?token_hash=…&type=email_change…` form the
 * `change-email.html` template emits. Dedupes (the same hash appears in both the
 * button and the plain-text fallback link).
 */
export function extractTokenHashes(body: string): string[] {
  const hashes = new Set<string>();
  // token_hash=<hash> up to the next & or quote or whitespace, when an
  // email_change link is present in the same body.
  const linkRe =
    /token_hash=([^&"'\s]+)[^"'\s]*type=email_change/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(body)) !== null) {
    if (m[1]) hashes.add(decodeURIComponent(m[1]));
  }
  return [...hashes];
}

/** List all messages currently in Mailpit (most-recent first). */
async function listMessages(): Promise<MailpitMessageSummary[]> {
  const res = await fetch(`${MAILPIT_BASE}/api/v1/messages`);
  if (!res.ok) return [];
  const data = (await res.json()) as MailpitMessagesList;
  return data.messages ?? [];
}

/** Fetch one message's full body by id. */
async function getMessageBody(id: string): Promise<string> {
  const res = await fetch(`${MAILPIT_BASE}/api/v1/message/${id}`);
  if (!res.ok) return '';
  const data = (await res.json()) as MailpitMessageDetail;
  return `${data.Text ?? ''}\n${data.HTML ?? ''}`;
}

/**
 * Poll Mailpit for messages addressed to `recipient` and return every
 * change-email `token_hash` found in their bodies.
 *
 * @param recipient   The address to match (case-insensitive) in message `To`.
 * @param opts.expect How many distinct token_hashes to wait for (default 1).
 * @param opts.timeoutMs  Max wait before returning whatever was found (default 5000).
 * @returns the distinct token_hash values (length may be < `expect` if it timed out —
 *          the caller asserts the count, so a short fetch is a visible red, not a hang).
 */
export async function fetchChangeEmailTokens(
  recipient: string,
  opts: { expect?: number; timeoutMs?: number } = {},
): Promise<string[]> {
  const want = opts.expect ?? 1;
  const deadline = Date.now() + (opts.timeoutMs ?? 5000);
  const target = recipient.toLowerCase();

  while (Date.now() < deadline) {
    const messages = await listMessages();
    const mine = messages.filter((msg) =>
      (msg.To ?? []).some((t) => (t.Address ?? '').toLowerCase() === target),
    );
    const hashes = new Set<string>();
    for (const msg of mine) {
      for (const h of extractTokenHashes(await getMessageBody(msg.ID))) {
        hashes.add(h);
      }
    }
    if (hashes.size >= want) return [...hashes];
    await new Promise((r) => setTimeout(r, 250));
  }

  // Timed out — return what we have (caller asserts the count → visible red).
  const messages = await listMessages();
  const mine = messages.filter((msg) =>
    (msg.To ?? []).some((t) => (t.Address ?? '').toLowerCase() === target),
  );
  const hashes = new Set<string>();
  for (const msg of mine) {
    for (const h of extractTokenHashes(await getMessageBody(msg.ID))) hashes.add(h);
  }
  return [...hashes];
}

/** Best-effort: clear all messages in Mailpit (so a poll only sees this test's mail). */
export async function clearMailpit(): Promise<void> {
  try {
    await fetch(`${MAILPIT_BASE}/api/v1/messages`, { method: 'DELETE' });
  } catch {
    // best-effort — never fail a test on a mail-catcher hiccup.
  }
}
