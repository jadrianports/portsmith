'use server';

/**
 * Login server action — the authentication gate (AUTH-03, D-07).
 *
 * A Server Action (`'use server'`) so the credential check + the enumeration-safe
 * messaging contract live on the server boundary, never the client. The flow:
 *
 *   1. loginSchema.safeParse  — Zod re-parse server-side. Client parse is UX
 *      only; THIS is the real gate (contact.ts / signup-action posture). Field
 *      errors on malformed email / empty password.
 *   2. supabase.auth.signInWithPassword — the credential check. On success the
 *      `@supabase/ssr` server client writes the session cookies and the Phase 1
 *      middleware refreshes them on every later request (consumed, not rebuilt).
 *
 * Enumeration-safety (D-07 / T-02-14 / Pitfall 3) — the load-bearing contract:
 *   - A wrong email and a wrong password are INDISTINGUISHABLE. Supabase returns
 *     `invalid_credentials` for both; the action collapses every credential
 *     failure to the SINGLE generic message and never echoes the email or
 *     branches on whether the account exists.
 *   - The ONLY sanctioned exception (D-07) is an UNCONFIRMED user: Supabase
 *     surfaces `email_not_confirmed`, and the action returns a distinct
 *     `{ unconfirmed: true, email }` outcome so the login page can render the
 *     "Please confirm your email — resend?" affordance. This is the one place a
 *     differential signal is allowed.
 *
 * Verified-identity discipline carries over (AUTH-05): this action NEVER calls
 * `getSession()` (the guard test greps for it). It does not need to read identity
 * here — `signInWithPassword` either succeeds (cookies written) or errors.
 *
 * On success it returns `{ ok: true }`; the form island navigates to the dashboard
 * (or a validated internal `redirectedFrom`). Returning rather than calling
 * `redirect()` keeps the success path symmetric with `signupAction` and avoids
 * throwing a redirect through the client island's try/catch.
 */
import { createClient } from '@/lib/supabase/server';
import { loginSchema } from '@/lib/validations';

/** Per-field validation messages, keyed by the login field name. */
export type LoginFieldErrors = Partial<Record<'email' | 'password', string>>;

/**
 * The login outcome.
 *  - `{ ok: true }`                          → credentials valid, session set.
 *  - `{ ok: false, fieldErrors }`            → schema failure (UX field errors).
 *  - `{ ok: false, error }`                  → GENERIC credential failure (D-07).
 *  - `{ ok: false, error, unconfirmed, email }` → the one sanctioned exception:
 *      an unconfirmed user, driving the resend-confirmation affordance.
 */
export type LoginResult =
  | { ok: true }
  | {
      ok: false;
      error?: string;
      fieldErrors?: LoginFieldErrors;
      unconfirmed?: boolean;
      email?: string;
    };

/** The single generic credential-failure message — never reveals which field. */
const GENERIC_INVALID = "That email or password isn't right. Please try again.";
/** The D-07 exception: copy for an unconfirmed user (drives the resend link). */
const UNCONFIRMED_MESSAGE =
  'Please confirm your email to log in. We can send the link again.';
/** Last-resort message for an unexpected (non-credential) auth failure. */
const GENERIC_ERROR = 'Something went wrong. Please try again.';

export async function loginAction(input: unknown): Promise<LoginResult> {
  // 1) Zod re-parse (server gate). Malformed email / empty password → field errors.
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: LoginFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === 'email' || key === 'password') && !(key in fieldErrors)) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  const { email, password } = parsed.data;

  // 2) The credential check.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (!error) {
    return { ok: true };
  }

  // The ONE sanctioned exception (D-07): an unconfirmed user gets the resend
  // prompt. Supabase reports this as `email_not_confirmed`.
  if (error.code === 'email_not_confirmed') {
    return { ok: false, error: UNCONFIRMED_MESSAGE, unconfirmed: true, email };
  }

  // Every credential failure (wrong email OR wrong password — `invalid_credentials`)
  // collapses to the SAME generic message. We never branch on existence (D-07).
  if (error.code === 'invalid_credentials') {
    return { ok: false, error: GENERIC_INVALID };
  }

  // Any other auth error (rate-limit, network, banned, …) → generic, no leak.
  // Treated as a credential failure to keep the surface uniform; a rare
  // operational error gets the neutral "something went wrong" instead.
  if (error.code === 'over_request_rate_limit' || error.status === 429) {
    return { ok: false, error: GENERIC_ERROR };
  }
  return { ok: false, error: GENERIC_INVALID };
}
