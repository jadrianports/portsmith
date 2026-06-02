'use server';

/**
 * report-actions — the /admin queue's mark-reviewed write (SAFE-02 / D-17, 06-07).
 *
 * D-17 (manual-only review): an operator MARKS a report reviewed — there is NO
 * auto-lock. Marking reviewed sets `reviewed=true` (+ `reviewed_at` / `reviewed_by`
 * for the audit trail) so the row leaves the unreviewed queue; it does NOT touch
 * the target portfolio (the takedown is the separate, confirmed lock control).
 *
 * BOUNDARY (T-06-W4): this write uses the AUTHENTICATED cookie/RLS `createClient()`
 * — NOT `supabaseAdmin`. The `reports admin all` RLS policy (004:263, USING +
 * WITH CHECK is_admin()) scopes the UPDATE to admins, and `is_admin()` is the
 * recursion-safe SECURITY DEFINER helper. A non-admin's write affects 0 rows
 * (and the verified-identity guard rejects them first). Service-role is reserved
 * for the lock WRITE only.
 *
 * Mirrors the SHARED-A skeleton (verified identity → RLS-scoped write →
 * discriminated-union result) from `message-actions.ts`. No `revalidatePath` —
 * marking a report reviewed does not change any public page.
 */
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

/** The mark-reviewed outcome — the SHARED-A discriminated union. */
export type ReportActionResult = { ok: true } | { ok: false };

/**
 * Mark a report reviewed (D-17 — manual triage; no auto-lock).
 *
 * Writes `reviewed=true`, `reviewed_at=now()`, `reviewed_by=<admin sub>` under the
 * `reports admin all` RLS policy. The row then drops out of the unreviewed queue.
 *
 * @param reportId The report to mark reviewed.
 */
export async function markReportReviewed(
  reportId: string,
): Promise<ReportActionResult> {
  // 1) Verified identity (AUTH-05 — never getSession). A missing `sub` is a hard
  //    auth failure (WR-05, never coerced to '').
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false };
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false };

  // 2) RLS-scoped write via the AUTHENTICATED admin client. The `reports admin
  //    all` policy (is_admin()) gates it; a non-admin affects 0 rows.
  const supabase = await createClient();
  const { error } = await supabase
    .from('reports')
    .update({
      reviewed: true,
      reviewed_at: new Date().toISOString(),
      reviewed_by: sub,
    })
    .eq('id', reportId);
  if (error) return { ok: false };

  return { ok: true };
}
