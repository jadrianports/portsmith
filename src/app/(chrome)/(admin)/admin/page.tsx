/**
 * /admin — the Trust-and-Safety surface (SAFE-02 / D-12, UI-SPEC Surface 4).
 *
 * The REVIEW + TAKEDOWN half of the moderation loop: the operator sees the
 * unreviewed report queue (the data 06-06's report path feeds) and can mark a
 * report reviewed or suspend/restore a portfolio. This RSC:
 *
 *   1. Is already GATED by `(admin)/layout.tsx` (getVerifiedClaims + is_admin()
 *      RPC re-check). This page does no second gate — it trusts the layout and
 *      reads the queue.
 *   2. READS the unreviewed queue via `getUnreviewedReports()` — the
 *      AUTHENTICATED admin cookie/RLS read (the `reports admin all` policy),
 *      NEVER `supabaseAdmin` (T-06-W4 — service-role is the lock WRITE only).
 *      The read resolves each report's target username + locked state.
 *   3. Renders the H1 "Trust & Safety" + a `shield-alert` glyph + the unreviewed
 *      count, then hands the rows to the `<ReportQueue>` client island.
 *
 * STRICTLY trust-and-safety — NO stats / analytics surface (D-12). FORCE-DYNAMIC
 * (operator-private; never statically cached). [CHROME] — Evergreen & Copper,
 * Inter; imports NO template token (two-layer identity, SHARED-E).
 *
 * Replaces the `(admin)/admin-placeholder/page.tsx` marker — the real surface
 * lives here at `(admin)/admin/page.tsx`.
 *
 * Source: the RSC-loads-then-seeds-island idiom from `dashboard/inbox/page.tsx`;
 * the queue read from `@/lib/admin/reports`; the queue island from
 * `@/components/admin/report-queue`.
 */
import { ShieldAlert } from 'lucide-react';

import { ReportQueue } from '@/components/admin/report-queue';
import { getUnreviewedReports } from '@/lib/admin/reports';

/** Operator-private + always reflects current state — never ISR. */
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // Authenticated admin RLS read (NOT service-role — T-06-W4). The layout already
  // proved the caller is an admin.
  const reports = await getUnreviewedReports();

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6 lg:p-8">
      {/* Header — H1 "Trust & Safety" + shield-alert glyph + unreviewed count. */}
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <ShieldAlert
          aria-hidden="true"
          className="size-7 shrink-0 text-muted-foreground"
        />
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          Trust &amp; Safety
        </h1>
        {reports.length > 0 ? (
          <span className="text-[13px] tabular-nums text-muted-foreground">
            {reports.length} to review
          </span>
        ) : null}
      </header>

      <ReportQueue initialReports={reports} />
    </div>
  );
}
