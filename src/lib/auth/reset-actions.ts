'use server';

/**
 * Password-reset server actions — the request side (always-generic) and the
 * update side (schema-gated, recovery-session-guarded). AUTH-04 / D-07.
 *
 * Two Server Actions (`'use server'`) so the enumeration contract and the
 * credential write live on the server boundary, never the client:
 *
 *   requestReset — the forgot-password front. The flow:
 *     1. resetRequestSchema.safeParse  — Zod re-parse server-side. Client parse is
 *        UX only; THIS is the real gate (login-action / signup-action posture).
 *        A malformed email returns a field error (a format problem, not an
 *        existence signal — so it's not an enumeration leak).
 *     2. resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/auth/confirm` }).
 *        The recovery email template appends `?token_hash&type=recovery`; the
 *        shared Plan 04 `/auth/confirm` handler verifies the OTP and routes to
 *        `/update-password`.
 *     3. ALWAYS return the IDENTICAL generic outcome — whether the call resolved,
 *        errored, or threw. We never inspect the result for an existence signal
 *        and never branch the message (D-07 / T-02-17 / Pitfall 3). A wrapping
 *        try/catch guarantees even a thrown network error yields the same shape.
 *
 *   updatePassword — the update-password write (runs ONLY on the recovery session
 *   the verified OTP minted in `/auth/confirm`). The flow:
 *     1. updatePasswordSchema.safeParse (min 8 / max 72) — server-side BEFORE any
 *        write. A too-short password is rejected before `updateUser` is reached
 *        (T-02-20).
 *     2. Require a verified RECOVERY session (CR-01). `getVerifiedClaims`
 *        (getClaims under the hood — NEVER `getSession()`, the AUTH-05 guard test
 *        greps for it) yields the claims; the gate then inspects the `amr`
 *        (authentication-methods) array and requires a recovery/otp method. This
 *        is the load-bearing distinction: `getClaims()` returns claims for ANY
 *        authenticated session, so a bare "is some session present" check would let
 *        a NORMAL logged-in user (amr method `password`) change their password with
 *        no recovery proof and no current-password challenge. A recovery session
 *        (minted by `verifyOtp({ type: 'recovery' })`) carries amr method `otp`
 *        (verified empirically against this gotrue version); a password login
 *        carries `password`. No recovery-grade session → reject (T-02-19).
 *     3. updateUser({ password }) sets the new password on that recovery session.
 *
 * On success the caller's form island navigates (`/check-email?type=reset` for the
 * request, `/dashboard` for the update). Returning rather than calling `redirect()`
 * keeps the surface symmetric with login-action / signup-action.
 */
import { checkBotId } from 'botid/server';

import { isRecoverySession } from '@/lib/auth/recovery-session';
import { countAndRecord } from '@/lib/rate-limit/ledger';
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { hashClientIpFromHeaders } from '@/lib/trust/ip-hash';
import { resetRequestSchema, updatePasswordSchema } from '@/lib/validations';

// `isRecoverySession` (the CR-01 recovery-session predicate) lives in the plain
// `./recovery-session` module — a `'use server'` module may only export async
// functions in the Next 16 production build, and this predicate is synchronous.

/** Per-field validation messages for the reset-request form. */
export type RequestResetFieldErrors = Partial<Record<'email', string>>;
/** Per-field validation messages for the update-password form. */
export type UpdatePasswordFieldErrors = Partial<Record<'password', string>>;

/**
 * The reset-request outcome. On a well-formed email it is ALWAYS
 * `{ ok: true, message }` — identical whether or not the account exists (D-07).
 * The only failure is a malformed email (a format gate, not an existence signal).
 */
export type RequestResetResult =
  | { ok: true; message: string }
  | { ok: false; fieldErrors: RequestResetFieldErrors };

/**
 * The update-password outcome.
 *  - `{ ok: true }`                  → password changed; form navigates to /dashboard.
 *  - `{ ok: false, fieldErrors }`    → schema failure (too short / too long).
 *  - `{ ok: false, error }`          → no recovery session, or the write failed.
 */
export type UpdatePasswordResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: UpdatePasswordFieldErrors };

/** The single always-generic reset-request message (never reveals existence). */
const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, we've sent a link to reset your password.";
/** Shown when there is no valid recovery session backing the update. */
const NO_RECOVERY_SESSION =
  'Your reset link is invalid or has expired. Please request a new one.';
/** Last-resort message for an unexpected failure writing the new password. */
const GENERIC_UPDATE_ERROR = 'Something went wrong. Please try again.';

export async function requestReset(input: unknown): Promise<RequestResetResult> {
  // 1) Zod re-parse (server gate). A malformed email is a format error, not an
  //    existence signal — safe to surface as a field error.
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: RequestResetFieldErrors = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === 'email' && !fieldErrors.email) {
        fieldErrors.email = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  const { email } = parsed.data;

  // 1b) BotID gate (D-06 / D-07 / HARD-02) — AFTER Zod, BEFORE the ledger write +
  //     the email send (Pitfall 3). On isBot return the ALWAYS-generic outcome —
  //     never a distinct bot signal (the request side is already always-generic,
  //     so this changes nothing observable; enumeration-safe, Pitfall 2 / D-07).
  //     No-ops to isBot:false off-Vercel/locally.
  let isBot = false;
  try {
    ({ isBot } = await checkBotId());
  } catch {
    // A transient BotID/OIDC outage must NOT throw the action — degrade to "allow"
    // (isBot=false), matching the ledger's fail-open posture (WR-01 / ledger.ts). The
    // per-IP ledger remains the real cap; the response is always-generic regardless.
    isBot = false;
  }
  if (isBot) {
    return { ok: true, message: GENERIC_RESET_MESSAGE };
  }

  // 1c) Per-hashed-IP throttle (D-11 / HARD-04). Reset is rare and the costliest
  //     to abuse (it sends email -> Supabase MAU/egress + victim spam), so the cap
  //     is the tightest (5/h). A null subject (no IP, or no REPORT_IP_HASH_SECRET)
  //     SKIPS the cap — degrade-when-no-secret. Over-cap returns the SAME
  //     always-generic outcome (Pitfall 2 / D-07).
  const subject = await hashClientIpFromHeaders();
  if (subject) {
    const allowed = await countAndRecord('auth_reset', subject, 60 * 60 * 1000, 5); // cap 5/h (OQ-1)
    if (!allowed) {
      return { ok: true, message: GENERIC_RESET_MESSAGE };
    }
  }

  // 2) Fire the reset email. EVERY path below collapses to the same generic
  //    outcome — we never inspect the result and never let an error change the
  //    shape (D-07 / T-02-17). The try/catch covers a thrown network failure too.
  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    });
  } catch {
    // Swallow — surfacing this would leak timing/existence. Always generic.
  }

  // 3) Always-generic (enumeration-safe).
  return { ok: true, message: GENERIC_RESET_MESSAGE };
}

export async function updatePassword(input: unknown): Promise<UpdatePasswordResult> {
  // 1) Zod re-parse (server gate). A too-short/long password is rejected BEFORE
  //    any credential write (T-02-20).
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: UpdatePasswordFieldErrors = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === 'password' && !fieldErrors.password) {
        fieldErrors.password = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  // 2) Require a verified RECOVERY session (getClaims, never getSession). A bare
  //    "is some session present" check is NOT enough — getClaims() is true for ANY
  //    authenticated session, so a normal logged-in user would otherwise change
  //    their password with no recovery proof (CR-01). The gate inspects the `amr`
  //    and requires a recovery/otp method, so only the session the recovery OTP
  //    minted may write (T-02-19).
  const claims = await getVerifiedClaims();
  if (!isRecoverySession(claims)) {
    return { ok: false, error: NO_RECOVERY_SESSION };
  }

  // 3) Set the new password on the recovery session.
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, error: GENERIC_UPDATE_ERROR };
  }

  return { ok: true };
}
