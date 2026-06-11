/**
 * /admin/insights — the operator Insights surface (ANLY-03 / ANLY-04, D-14/D-16,
 * 15-UI-SPEC Surface A).
 *
 * The passive READ half of operator observability: the operator eyeballs traffic
 * (total views + top-N portfolios + a 30-day trend) and abuse (rate-limit events by
 * bucket + report volume). One scroll, two stacked sections, no alerting (D-15).
 * This RSC:
 *
 *   1. Is already GATED by `(admin)/layout.tsx` (getVerifiedClaims + is_admin()
 *      RPC re-check). This page does NO second gate — it trusts the layout and
 *      reads the aggregates (mirrors `admin/page.tsx`).
 *   2. READS the five aggregates via `getOperatorInsights()` — the AUTHENTICATED
 *      admin cookie/RLS read over the `is_admin()`-self-gated DEFINER RPCs, NEVER
 *      `supabaseAdmin`, NEVER a raw-row `page_views` SELECT (D-16 / T-06-W4).
 *   3. Renders the H1 "Insights" + a `line-chart` glyph, then hands the loaded
 *      aggregates to the `<InsightsView>` chrome island.
 *
 * FORCE-DYNAMIC (operator-private; never statically cached). [CHROME] — Evergreen &
 * Copper, Inter; imports NO template token (two-layer identity, SHARED-E).
 *
 * Source: the RSC-loads-then-seeds-island idiom from `admin/page.tsx`; the read
 * from `@/lib/analytics/operator-analytics`; the view island from
 * `@/components/admin/insights-view`.
 */
import { LineChart } from 'lucide-react';

import { InsightsView } from '@/components/admin/insights-view';
import { getOperatorInsights } from '@/lib/analytics/operator-analytics';

/** Operator-private + always reflects current state — never ISR. */
export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  // Authenticated admin RLS read over the DEFINER RPCs (NOT service-role,
  // NOT raw rows — D-16/T-06-W4). The layout already proved the caller is an admin.
  const insights = await getOperatorInsights();

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6 lg:p-8">
      {/* Header — H1 "Insights" + line-chart glyph. */}
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <LineChart
          aria-hidden="true"
          className="size-7 shrink-0 text-muted-foreground"
        />
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          Insights
        </h1>
      </header>

      <InsightsView insights={insights} />
    </div>
  );
}
