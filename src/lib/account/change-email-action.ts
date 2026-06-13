'use server';

/**
 * ACCT-02 — in-app email change, double-confirmed (D-01 / D-05 / D-07 / D-17 / D-18).
 *
 * A NEW authenticated `'use server'` action that is a SIBLING to `changePassword`
 * (`src/lib/account/change-password-action.ts`): it reuses the exact ACCT
 * credential-change template — Zod re-parse → verified-claims sub+email hard-fail
 * → current-password reauth (D-01) FIRST → an authenticated-RLS privileged write →
 * one generic result. Here the privileged write is `updateUser({ email })`, which
 * — with `double_confirm_changes = true` (config wired in 19-01) — makes gotrue
 * issue the secure DOUBLE-CONFIRM OTPs: one `type=email_change` link to the OLD
 * inbox and one to the NEW inbox (D-05). The new email does NOT take effect until
 * BOTH links are confirmed (gotrue tracks the half-confirmed state server-side;
 * the app does not). Each link lands on the hardened `/auth/confirm` route, which
 * gained the single `email_change` literal in 19-01.
 *
 * SHARED-A write sequence (CLAUDE.md / D-17 / ACCT-05), in this exact order — a
 * failure at step N never reaches step N+1:
 *
 *   1. changeEmailSchema.safeParse  — Zod re-parse server-side (the canonical NEW
 *      email via the single-source `canonicalEmail` + a present `current_password`).
 *      Client parse is UX only; THIS is the gate. A malformed/empty email is an
 *      `email` field error BEFORE any reauth or write (T-19-09).
 *   2. getVerifiedClaims()  — the VERIFIED identity (getClaims under the hood; never
 *      the unverified-cookie read the AUTH-05 guard forbids). `sub` and `email` are
 *      read off the claims; if EITHER is missing it HARD-FAILS with a generic error
 *      — never `sub ?? ''` / `email ?? ''` (that silently verifies the wrong
 *      identity or always-fails). `email` (claims, never `profiles.email`, which is
 *      stale-by-design) sources the reauth as the user's CURRENT address.
 *   3. verifyCurrentPassword(email, current_password)  — the D-01 reauth gate,
 *      FIRST, before the privileged write. A wrong current password is ONE generic
 *      reject with NO write (T-19-04 / T-19-08); the new email cannot take effect
 *      without ALSO clicking the link in both inboxes (D-05 — two independent gates).
 *   4. supabase.auth.updateUser({ email })  — on the AUTHENTICATED RLS client from
 *      `@/lib/supabase/server`, NEVER the service-role admin client (D-07/D-17/
 *      T-19-07). gotrue then issues the two double-confirm OTPs. An error here
 *      (e.g. gotrue's "email already in use") collapses to the SAME generic — the
 *      raw gotrue text is NEVER echoed (Pitfall 5 / T-19-08, enumeration-safe).
 *   5. { ok: true }  — the form surfaces "check both inboxes" and the pending banner
 *      (driven by `user.new_email` resolved by the settings RSC, not the claims).
 *
 * D-18: NO `profiles.email` write and NO migration — gotrue updates `auth.users.email`
 * once both links are confirmed; the app reads identity from `claims.email`, so
 * `profiles.email` is left harmlessly stale (and the 002 protected-columns trigger
 * would reject a user write to it anyway). T-19-10.
 *
 * Result shape mirrors `changePassword`: the action NEVER throws to the caller; the
 * form island branches on `result.ok`. Reauth, identity, and updateUser failures
 * share ONE generic `error`; schema failures surface only format field errors.
 */
import { verifyCurrentPassword } from '@/lib/auth/reauth';
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { changeEmailSchema } from '@/lib/validations';

/** Per-field validation messages for the change-email form. */
export type ChangeEmailFieldErrors = Partial<
  Record<'email' | 'current_password', string>
>;

/**
 * The change-email outcome.
 *  - `{ ok: true }`                  → the double-confirm was issued; form shows the
 *                                      "check both inboxes" success state.
 *  - `{ ok: false, fieldErrors }`    → schema failure (malformed/empty new email or
 *                                      a missing current_password — format gates).
 *  - `{ ok: false, error }`          → wrong current password, missing identity, or
 *                                      the updateUser failed (one generic message;
 *                                      "email already in use" is NEVER echoed).
 */
export type ChangeEmailResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: ChangeEmailFieldErrors };

/** The single generic reject for reauth/identity/write failures (never leaks why). */
const GENERIC_ERROR = 'Something went wrong. Please try again.';

export async function changeEmail(input: unknown): Promise<ChangeEmailResult> {
  // 1) Zod re-parse (server gate). The canonical NEW email + a present
  //    current_password are enforced BEFORE any reauth or privileged write. A
  //    malformed/empty email or a missing current_password is a FORMAT field error
  //    here (T-19-09), never an existence/which-condition signal.
  const parsed = changeEmailSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: ChangeEmailFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === 'email' && !fieldErrors.email) {
        fieldErrors.email = issue.message;
      } else if (key === 'current_password' && !fieldErrors.current_password) {
        fieldErrors.current_password = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  // 2) Verified identity (getClaims — the signature-verified read). Hard-fail if
  //    either `sub` or `email` is absent — NEVER coerce with `?? ''` (a
  //    wrong-identity / always-fail). `email` is the user's CURRENT address and
  //    sources the reauth (claims, never profiles.email, which is stale-by-design).
  const claims = await getVerifiedClaims();
  const sub = claims?.sub;
  const email = claims?.email;
  if (typeof sub !== 'string' || sub.length === 0 || typeof email !== 'string' || email.length === 0) {
    return { ok: false, error: GENERIC_ERROR };
  }

  // 3) Current-password reauth FIRST (the D-01 gate). A wrong password is ONE
  //    generic reject with NO write — the stateless verify always challenges and
  //    never clobbers the user's @supabase/ssr session cookies (Pitfall 2).
  if (!(await verifyCurrentPassword(email, parsed.data.current_password))) {
    // D-01
    return { ok: false, error: GENERIC_ERROR };
  }

  // 4) Request the email change on the AUTHENTICATED RLS client — NEVER
  //    service-role (D-07/D-17). gotrue (double_confirm_changes=true) now issues the
  //    two type=email_change OTPs (old + new inbox, D-05). A hard error (incl. the
  //    "email already in use" case) collapses to the SAME generic — the raw gotrue
  //    text is NEVER echoed (Pitfall 5, enumeration-safe). No profiles.email write
  //    and no migration (D-18 — auth.users.email is the source of truth).
  const supabase = await createClient(); // D-07/D-17
  const { error } = await supabase.auth.updateUser({ email: parsed.data.email });
  if (error) {
    return { ok: false, error: GENERIC_ERROR };
  }

  // 5) Generic success — the form shows "check both your old and new inbox", and
  //    the pending banner is driven by user.new_email (resolved by the settings RSC).
  return { ok: true };
}
