'use server';

/**
 * clear-template-fallback-action — the owner action that clears the one-time
 * post-auto-fallback dashboard notice (D-P12-10's user-facing half).
 *
 * When an operator flips a template to `restricted` (or revokes a grant) in /admin,
 * the cross-user `fallback_ungranted_to_editorial` RPC (12-02) repoints each
 * now-ungranted portfolio onto editorial AND stamps `portfolios.template_fallback_at
 * = now()`. The dashboard reads that timestamp and surfaces a one-time notice
 * ("Your previous template is no longer available — pick another"). Dismissing the
 * notice calls THIS action, which clears the stamp so the notice does not return.
 *
 * Clones the CANONICAL SHARED-A skeleton (publish-action.ts / switch-template-action.ts):
 *   1. getVerifiedClaims()  — verified JWT identity (AUTH-05). NEVER the spoofable
 *      cookie-session getter. A null claim ⇒ { ok:false }. A verified claim MISSING
 *      `sub` is a HARD auth failure (WR-05) — never coerced to '' (which would scope
 *      the UPDATE to a non-existent row and silently clear 0 rows while appearing to
 *      succeed).
 *   2. SINGLE-COLUMN write under RLS via the AUTHENTICATED client (never
 *      service-role) — `.update({ template_fallback_at: null }).eq('user_id', sub)`
 *      on the caller's OWN `portfolios` row. `template_fallback_at` is NOT one of the
 *      8 protected columns (the `enforce_protected_profile_columns` trigger guards
 *      `role/username/email/storage_used_bytes/locked/...` on `profiles` — this is a
 *      `portfolios` column and is NOT in that list), so the owner clears it directly
 *      under the `portfolios own all` RLS policy. Write ONLY the one column — never
 *      spread an object — scoped to the caller's own row (a cross-tenant clear
 *      silently changes 0 rows, the RLS USING clause).
 *   3. Return { ok: true }.
 *
 * NO `revalidatePath` — `template_fallback_at` is a DASHBOARD-ONLY signal; the public
 * `/[username]` ISR page does NOT read this column, so clearing it cannot stale the
 * public render (D-22 untouched).
 *
 * Source: the SHARED-A skeleton from `publish-action.ts`; the verified-claims guard +
 * the authenticated client from `@/lib/supabase/server.ts`; the `.eq('user_id', sub)`
 * owner scoping from `switch-template-action.ts` (portfolios.user_id is the UNIQUE FK
 * to the auth id, NOT `.eq('id', sub)`).
 */
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

/**
 * The clear outcome. `{ ok: true }` on success; `{ ok: false }` (optionally with an
 * `error`) on a not-signed-in / write failure — the same discriminated-union shape the
 * other CMS write actions return (SHARED-A), so the dismiss control handles results
 * identically.
 */
export type ClearTemplateFallbackResult = { ok: true } | { ok: false; error?: string };

const NOT_SIGNED_IN = 'Not signed in.';
const CLEAR_FAILED = 'We couldn’t dismiss that notice. Please try again.';

/**
 * Clear the caller's one-time post-fallback dashboard notice by nulling
 * `portfolios.template_fallback_at` on their OWN row. SHARED-A owner action — no
 * revalidate (the public page does not read this column).
 */
export async function clearTemplateFallbackNotice(): Promise<ClearTemplateFallbackResult> {
  // 1) Verified identity (AUTH-05 — never getSession).
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // WR-05: a verified claim MUST carry a subject. A missing `sub` is a HARD auth
  // failure — never coerce it to '' (which would scope the UPDATE to a non-existent
  // row and silently clear 0 rows while appearing to succeed).
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 2) SINGLE-COLUMN write under RLS via the AUTHENTICATED client (never
  //    service-role). `template_fallback_at` is NOT a protected column, so the owner
  //    clears it directly under `portfolios own all`. Scope to the caller's OWN row
  //    via `.eq('user_id', sub)` (portfolios.user_id is the UNIQUE FK — NOT
  //    `.eq('id', sub)`). A cross-tenant clear silently changes 0 rows.
  const supabase = await createClient();
  const { error } = await supabase
    .from('portfolios')
    .update({ template_fallback_at: null })
    .eq('user_id', sub); // WR-05: `sub` guaranteed present (no `?? ''`).
  if (error) return { ok: false, error: CLEAR_FAILED };

  // 3) Success — the dismiss control hides the notice.
  return { ok: true };
}
