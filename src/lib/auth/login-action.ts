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
 *   - OPERATIONAL failures are NOT credential failures (WR-04): a rate-limit, a
 *     5xx, a network blip, a banned user, or an unknown/renamed gotrue code must
 *     return the NEUTRAL "something went wrong" message — never "your password is
 *     wrong" — so a transient outage does not push users into a reset loop. Only
 *     `invalid_credentials` earns the credential message; a status-based fallback
 *     (429 / >=500) keeps this correct across gotrue code renames.
 *
 * Verified-identity discipline carries over (AUTH-05): this action NEVER calls
 * `getSession()` (the guard test greps for it). It does not need to read identity
 * here — `signInWithPassword` either succeeds (cookies written) or errors.
 *
 * On success it returns `{ ok: true }`; the form island navigates to the dashboard
 * (or a validated internal `redirectedFrom`). Returning rather than calling
 * `redirect()` keeps the success path symmetric with `signupAction` and avoids
 * throwing a redirect through the client island's try/catch.
 *
 * D-14 (locked-account block, 06-07): AFTER a successful credential check, the
 * action reads the now-authenticated caller's OWN `profiles.locked`. A suspended
 * account CAN authenticate (its credentials are valid) but MUST NOT establish a
 * usable dashboard session — so when `locked === true` the action signs the
 * just-created session back out and returns the GENERIC suspended result. This is
 * NOT an enumeration leak: `locked` is a real, KNOWN state readable by the
 * account's OWN authenticated user under `profiles own select`, so it is surfaced
 * only to that very user — never as a differential signal about another account.
 * The enumeration-safe credential/unconfirmed/operational branches are untouched.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
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
/**
 * D-14: the generic suspended-account message (decided copy, 06-UI-SPEC). Surfaced
 * via the existing 02 auth banner — NO new component. Not enumeration: a locked
 * account is a real known state for its OWN authenticated user.
 */
const SUSPENDED_MESSAGE =
  'This account has been suspended. If you think this is a mistake, contact support.';

/**
 * D-14 enforcement helper: given a freshly-signed-in `supabase` client, read the
 * caller's OWN `profiles.locked` (the verified `sub` from `getVerifiedClaims()`).
 * If the account is locked, sign the just-created session back OUT (a suspended
 * account must hold no usable session) and return the generic suspended
 * `LoginResult`. Otherwise return `null` (login proceeds).
 *
 * Exported so the integration spec (locked-login.test.ts) can assert the
 * enforcement contract directly. `locked` is readable by the owner under
 * `profiles own select`, so this is a verified own-row read, never an
 * enumeration probe of another account.
 */
export async function assertNotLocked(
  supabase: SupabaseClient,
): Promise<LoginResult | null> {
  // The session cookies are set post-sign-in, so the verified identity resolves.
  const claims = await getVerifiedClaims();
  const sub = claims ? (claims as { sub?: string }).sub : undefined;
  if (!sub) return null; // No verified subject ⇒ nothing to enforce; let login proceed.

  const { data, error } = await supabase
    .from('profiles')
    .select('locked')
    .eq('id', sub)
    .single();
  // On a read error, do NOT block a legitimate login on an unrelated failure —
  // fall through (the account is not provably locked). The own-row read is the
  // signal; its absence is not "suspended".
  if (error) return null;

  if ((data as { locked?: boolean } | null)?.locked === true) {
    // Tear down the just-created session — a locked account establishes NO usable
    // session (D-14). signOut is BEST-EFFORT: if it fails transiently the session
    // cookie could linger, so the /dashboard gate ALSO re-checks `locked` server-side
    // (defense-in-depth, WR-02) — a suspended account can never load an authed
    // surface even if this teardown fails. Surface the failure rather than silently
    // discarding the result.
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error('[login] signOut after locked-account detection failed:', signOutError);
    }
    return { ok: false, error: SUSPENDED_MESSAGE };
  }

  return null;
}

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
    // 3) D-14: a locked account authenticates but must NOT keep a session. Read
    //    OWN `locked` (verified), and if suspended sign back out + return the
    //    generic suspended result. Otherwise login proceeds.
    const suspended = await assertNotLocked(supabase);
    if (suspended) return suspended;
    return { ok: true };
  }

  // The ONE sanctioned exception (D-07): an unconfirmed user gets the resend
  // prompt. Supabase reports this as `email_not_confirmed`.
  if (error.code === 'email_not_confirmed') {
    return { ok: false, error: UNCONFIRMED_MESSAGE, unconfirmed: true, email };
  }

  // Only a genuine CREDENTIAL failure earns the credential message. A wrong email
  // and a wrong password are INDISTINGUISHABLE — both surface `invalid_credentials`
  // — and collapse to the SAME generic message; we never branch on existence (D-07).
  if (error.code === 'invalid_credentials') {
    return { ok: false, error: GENERIC_INVALID };
  }

  // Everything else is an OPERATIONAL failure, NOT a credential one (WR-04). A
  // rate-limit, a 5xx, a network blip, a banned user, or an unknown/renamed
  // gotrue code must NOT tell the user "your password is wrong" — that drives a
  // futile password-reset loop. Return the NEUTRAL "something went wrong" instead.
  // The status-based fallback (429 / >=500) keeps this correct even if gotrue
  // renames a code string in a version bump.
  if (
    error.code === 'over_request_rate_limit' ||
    error.status === 429 ||
    (error.status ?? 0) >= 500
  ) {
    return { ok: false, error: GENERIC_ERROR };
  }

  // Unknown error → neutral, never credential-blaming (WR-04).
  return { ok: false, error: GENERIC_ERROR };
}
