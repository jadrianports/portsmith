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
 *   updatePassword — the update-password write (runs on the recovery session the
 *   verified OTP minted in `/auth/confirm`). The flow:
 *     1. updatePasswordSchema.safeParse (min 8 / max 72) — server-side BEFORE any
 *        write. A too-short password is rejected before `updateUser` is reached
 *        (T-02-20).
 *     2. Guard that a verified recovery session exists via `getVerifiedClaims`
 *        (getClaims under the hood — NEVER `getSession()`, the AUTH-05 guard test
 *        greps for it). No valid session → reject; `updateUser` is unreachable
 *        without the recovery token's session (T-02-19).
 *     3. updateUser({ password }) sets the new password on that session.
 *
 * On success the caller's form island navigates (`/check-email?type=reset` for the
 * request, `/dashboard` for the update). Returning rather than calling `redirect()`
 * keeps the surface symmetric with login-action / signup-action.
 */
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { resetRequestSchema, updatePasswordSchema } from '@/lib/validations';

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

  // 2) Require a verified recovery session (getClaims, never getSession). Without
  //    the session the recovery OTP minted, the write must not run (T-02-19).
  const claims = await getVerifiedClaims();
  if (!claims) {
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
