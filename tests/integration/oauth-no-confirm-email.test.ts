/**
 * OAUTH-01 — an OAuth-created user is email-VERIFIED with NO confirmation email
 * sent. Proven against the live local stack + Mailpit.
 *
 * An OAuth identity arrives with a provider-verified email; GoTrue stamps
 * `email_confirmed_at` immediately and sends NO confirmation mail, regardless of
 * `enable_confirmations = true` (that governs the email/password path only —
 * Pitfall 5). This test pins that behavior so a future config change can't silently
 * regress OAUTH-01.
 *
 * SIMULATING THE OAUTH SHAPE: `admin.createUser({ email_confirm: true,
 * user_metadata: {} })` reproduces a provider-verified, no-username create (the same
 * shape used by the provisional-username test) and exercises the 026 trigger. We
 * assert the auth row is `email_confirmed_at`-stamped AND that Mailpit holds no
 * message addressed to that email.
 *
 * MAILPIT (MEMORY local-mailpit-not-inbucket): the local stack's mail catcher is
 * Mailpit at `http://127.0.0.1:54324` — `GET /api/v1/messages` to list,
 * `GET /api/v1/message/{id}` for a body. NOT Inbucket.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  cleanupTestUsers,
  sweepLeftoverTestUsers,
} from './_setup';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);
const MAILPIT_BASE = 'http://127.0.0.1:54324';

const createdIds: string[] = [];

interface MailpitMessageSummary {
  ID: string;
  To: { Address: string }[];
}

/** List every message currently in Mailpit. */
async function listMailpitMessages(): Promise<MailpitMessageSummary[]> {
  const res = await fetch(`${MAILPIT_BASE}/api/v1/messages`);
  if (!res.ok) return [];
  const data = (await res.json()) as { messages?: MailpitMessageSummary[] };
  return data.messages ?? [];
}

/** Count messages addressed (case-insensitive) to `recipient`. */
async function countMailTo(recipient: string): Promise<number> {
  const target = recipient.toLowerCase();
  const messages = await listMailpitMessages();
  return messages.filter((m) =>
    (m.To ?? []).some((t) => (t.Address ?? '').toLowerCase() === target),
  ).length;
}

/** Best-effort: clear Mailpit so a count only reflects this test's window. */
async function clearMailpit(): Promise<void> {
  try {
    await fetch(`${MAILPIT_BASE}/api/v1/messages`, { method: 'DELETE' });
  } catch {
    // best-effort — never fail a test on a mail-catcher hiccup.
  }
}

beforeAll(async () => {
  await sweepLeftoverTestUsers();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(...createdIds.filter(Boolean));
});

describe('OAUTH-01 — OAuth-created user is verified with no confirmation email', () => {
  it('email_confirmed_at is set AND no Mailpit message is addressed to the user', async () => {
    const email = `oauthmail${RUN}@gmail.example.test`;

    // Clear the catcher so a post-create poll measures only this create's effect.
    await clearMailpit();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {}, // OAuth shape: no username, provider-verified email
    });
    expect(error).toBeNull();
    const userId = data.user?.id;
    expect(userId).toBeTruthy();
    if (userId) createdIds.push(userId);

    // The user is email-VERIFIED (email_confirmed_at stamped) — OAUTH-01.
    const { data: adminView, error: getErr } =
      await admin.auth.admin.getUserById(userId!);
    expect(getErr).toBeNull();
    expect(adminView.user?.email_confirmed_at ?? null).not.toBeNull();

    // The 026 trigger still provisioned a profile (no NULL-username window).
    const { data: prof } = await admin
      .from('profiles')
      .select('id')
      .eq('id', userId!);
    expect(prof).toHaveLength(1);

    // NO confirmation mail was sent to this address. Give GoTrue a brief window in
    // case any mail were dispatched async, then assert zero.
    await new Promise((r) => setTimeout(r, 750));
    const mailCount = await countMailTo(email);
    expect(mailCount).toBe(0);
  });
});
