'use server';

/**
 * ACCT-01 — in-app password change (D-01 / D-03 / D-04 / D-17).
 *
 * A NEW authenticated `'use server'` action that is a SIBLING to the
 * recovery-gated `updatePassword` in `src/lib/auth/reset-actions.ts` — it does
 * NOT modify, import, or touch that amr=otp recovery gate (D-04). The recovery
 * gate deliberately BLOCKS a normal logged-in user from changing their password
 * (no recovery proof); this action supplies the missing proof a different way:
 * a CURRENT-password reauth (`verifyCurrentPassword`, D-01), which is exactly
 * what the recovery session would otherwise stand in for.
 *
 * SHARED-A write sequence (CLAUDE.md / D-17 / ACCT-05), in this exact order — a
 * failure at step N never reaches step N+1:
 *
 *   1. updatePasswordSchema.safeParse  — Zod re-parse server-side (min 8 / max 72).
 *      Client parse is UX only; THIS is the gate. A too-short/long password is
 *      rejected as a `password` field error BEFORE any reauth or write (T-19-09).
 *      A missing/empty `current_password` is a format field error here too — a
 *      shape problem, never an existence/which-condition signal.
 *   2. getVerifiedClaims()  — the VERIFIED identity (getClaims under the hood;
 *      never the unverified-cookie read the AUTH-05 guard forbids). `sub` and
 *      `email` are read off the claims; if EITHER is missing it HARD-FAILS with a
 *      generic error — never `sub ?? ''` / `email ?? ''` (that would silently
 *      verify the wrong identity or always-fail).
 *   3. verifyCurrentPassword(email, current_password)  — the D-01 reauth gate,
 *      FIRST, before the privileged write. A wrong current password is ONE
 *      generic reject with NO write (T-19-03 / T-19-08).
 *   4. supabase.auth.updateUser({ password })  — on the AUTHENTICATED RLS client
 *      from `@/lib/supabase/server`, NEVER the service-role admin client
 *      (D-03/D-17/T-19-07). A hard write error collapses to the same generic.
 *   5. { ok: true }.
 *
 * Result shape mirrors `updatePassword` (reset-actions.ts): the action NEVER
 * throws to the caller; the form island branches on `result.ok`. Reauth and
 * updateUser failures share ONE generic `error` (enumeration-safe, T-19-08);
 * schema failures surface only format field errors.
 */
import { verifyCurrentPassword } from '@/lib/auth/reauth';
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { updatePasswordSchema } from '@/lib/validations';

/** Per-field validation messages for the change-password form. */
export type ChangePasswordFieldErrors = Partial<
  Record<'password' | 'current_password', string>
>;

/**
 * The change-password outcome.
 *  - `{ ok: true }`                  → password changed; form clears + shows success.
 *  - `{ ok: false, fieldErrors }`    → schema failure (new password 8–72) or a
 *                                      missing/empty current_password (format gate).
 *  - `{ ok: false, error }`          → wrong current password, missing identity,
 *                                      or the write failed (one generic message).
 */
export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: ChangePasswordFieldErrors };

/** The single generic reject for reauth/identity/write failures (never leaks why). */
const GENERIC_ERROR = 'Something went wrong. Please try again.';
/** Format message for an absent current-password field (a shape gate, not a signal). */
const CURRENT_PASSWORD_REQUIRED = 'Enter your current password';

export async function changePassword(input: unknown): Promise<ChangePasswordResult> {
  // 1) Zod re-parse (server gate). The new password's 8–72 cap is enforced BEFORE
  //    any reauth or credential write. `current_password` is NOT part of
  //    updatePasswordSchema, so validate its presence/format defensively here.
  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: ChangePasswordFieldErrors = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === 'password' && !fieldErrors.password) {
        fieldErrors.password = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  // Defensive read of the reauth field off the raw, unknown input (it is not in
  // the schema). An absent/empty value is a FORMAT gate, not an existence signal.
  const current_password =
    typeof input === 'object' &&
    input !== null &&
    typeof (input as { current_password?: unknown }).current_password === 'string'
      ? (input as { current_password: string }).current_password
      : '';
  if (current_password.length === 0) {
    return { ok: false, fieldErrors: { current_password: CURRENT_PASSWORD_REQUIRED } };
  }

  // 2) Verified identity (getClaims — the signature-verified read). Hard-fail if
  //    either `sub` or `email` is absent — NEVER coerce with `?? ''` (a wrong-identity
  //    / always-fail). `email` sources the reauth (claims, never profiles.email,
  //    which is stale-by-design after an email change).
  const claims = await getVerifiedClaims();
  const sub = claims?.sub;
  const email = claims?.email;
  if (typeof sub !== 'string' || sub.length === 0 || typeof email !== 'string' || email.length === 0) {
    return { ok: false, error: GENERIC_ERROR };
  }

  // 3) Current-password reauth FIRST (the D-01 gate). A wrong password is ONE
  //    generic reject with NO write — the stateless verify always challenges and
  //    never clobbers the user's @supabase/ssr session cookies (Pitfall 2).
  if (!(await verifyCurrentPassword(email, current_password))) {
    // D-01
    return { ok: false, error: GENERIC_ERROR };
  }

  // 4) Set the new password on the AUTHENTICATED RLS client — NEVER service-role.
  const supabase = await createClient(); // D-03/D-17
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, error: GENERIC_ERROR };
  }

  // 5) Generic success — the form clears + shows the inline success state.
  return { ok: true };
}
