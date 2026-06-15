import 'server-only';
import { Resend } from 'resend';

/**
 * Server-only Resend send wrapper (NOTIF-01/02 · D-01) — degrade-OPEN.
 *
 * `import 'server-only'` (the FIRST line, intentionally) turns any attempt to
 * import this module from a Client Component into a BUILD ERROR — the compile-time
 * wall that keeps `RESEND_API_KEY` out of every browser bundle (the same FND-05
 * discipline as `service-role.ts:1` / `turnstile.ts:1`). CI greps `.next/static`
 * for the key value as the regression backstop.
 *
 * Structural analog: `src/lib/auth/turnstile.ts` — a server-only secret module
 * whose whole network call is wrapped so a failure degrades to a safe default.
 * Turnstile fails CLOSED (an unprovable verify is "not verified"); this module
 * fails OPEN — a contact message is ALREADY stored before notify runs, so a send
 * failure must NEVER surface (NOTIF-02). It NEVER throws.
 *
 * Dormant-until-domain (D-01): the client is constructed and the send is attempted
 * ONLY when BOTH `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are present. With either
 * unset (the launch / $0-domains state) this is a no-op that returns `'skipped'` —
 * exactly the no-op behavior the seam had before Resend was wired. The brand-domain
 * turn-on is then purely an env change (see docs/runbooks/contact-notify-resend.md).
 */

/** The send result — deliberately tiny; callers only need ok/skipped/error, never throw. */
export type ResendSendResult = 'sent' | 'skipped' | 'error';

/** The minimal client surface this module uses (a subset of the Resend instance). */
type ResendClient = { emails: { send: (...args: unknown[]) => Promise<{ error: unknown }> } };

/**
 * Construct the Resend client. The real SDK `Resend` is a CLASS (must be invoked with
 * `new`); a `new`-first call covers that. The `catch` fallback to a plain call exists
 * ONLY so a test double that mocks `Resend` as a plain factory function (not a class)
 * still resolves a client — it never changes real-SDK behavior (the real class always
 * succeeds on the `new` path and never reaches the fallback).
 */
function createResendClient(apiKey: string): ResendClient {
  const Ctor = Resend as unknown as new (k: string) => ResendClient;
  try {
    return new Ctor(apiKey);
  } catch {
    return (Resend as unknown as (k: string) => ResendClient)(apiKey);
  }
}

/** The minimal email shape this wrapper sends (a subset of the Resend SDK params). */
export interface ResendEmail {
  /** The verified platform sender (`RESEND_FROM_EMAIL`) — NEVER the visitor (D-02). */
  from: string;
  /** The looked-up owner address — a TRUSTED server value, never a client payload (NOTIF-03). */
  to: string;
  /** The visitor's email — the owner replies directly from their mail client (D-02). */
  replyTo: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send one transactional email via Resend, degrade-OPEN. Returns `'skipped'` when
 * the RESEND env vars are unset (dormant), `'error'` when the send failed (swallowed
 * + logged), and `'sent'` on success. NEVER throws — a missing key, a network error,
 * an SDK throw, or a returned `{ error }` all resolve to a value, never a rejection.
 */
export async function sendOwnerEmail(email: ResendEmail): Promise<ResendSendResult> {
  // Dormant-until-domain (D-01): no key / no verified sender → no-op exactly as today.
  // The guard is here (not only in notify) so any future caller is dormant-safe too.
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return 'skipped';

  try {
    const resend = createResendClient(apiKey);
    // The SDK's `{ data, error }` shape does NOT throw on an API-level error, but a
    // missing key / network failure / SDK internal CAN throw — hence the try/catch
    // wraps BOTH the construction and the send (NOTIF-02).
    const { error } = await resend.emails.send({
      from: email.from,
      to: email.to,
      replyTo: email.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    if (error) {
      // An API-level error (e.g. "domain not verified") — swallow + log, never throw.
      console.error('[notify] Resend send returned an error:', error);
      return 'error';
    }
    return 'sent';
  } catch (err) {
    // A thrown missing-key / network / SDK error — swallow + log, never throw (degrade-open).
    console.error('[notify] Resend send threw:', err);
    return 'error';
  }
}
