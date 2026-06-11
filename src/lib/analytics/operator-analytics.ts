import 'server-only';

import { createClient } from '@/lib/supabase/server';

/**
 * Operator Insights read (ANLY-03 / ANLY-04, 15-04) — the five page-view /
 * abuse aggregates, read via the AUTHENTICATED admin cookie/RLS client.
 *
 * `import 'server-only'` is the literal first line (above) so this authenticated
 * read can never reach a client bundle.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ READ BOUNDARY (T-06-W4 + D-16, LOAD-BEARING):                                 │
 * │ The operator Insights read uses the AUTHENTICATED `createClient()` — NEVER    │
 * │ the service-role admin client. Service-role is RESERVED for the anon WRITE     │
 * │ routes; using it here would bypass the very identity that authorizes the read. │
 * │ The data comes ONLY from the five `is_admin()`-self-gated SECURITY DEFINER     │
 * │ aggregate RPCs (migration 019) — there is NO raw-row `page_views` SELECT       │
 * │ (D-16): the RPCs return counts / top-N / per-day series only, never raw rows.  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * The `(admin)/layout.tsx` gate (getVerifiedClaims + is_admin() RPC) already proved
 * the caller is an admin before this module is reached; each RPC ADDITIONALLY
 * self-gates on `is_admin()` (defense-in-depth — a non-admin call would RAISE).
 *
 * Each RPC returns its calm default (`0` / `[]`) on a read error so a transient
 * failure renders the Insights empty/error state rather than throwing.
 *
 * NOTE: `createClient()` is currently untyped (`Database = any` — see
 * `src/lib/supabase/server.ts`), so `.rpc(...)` data is `any`. We narrow each
 * result to the row shapes generated into `src/types/database.ts` (the five
 * Functions signatures from migration 019) so the page + island consume a typed
 * `OperatorInsights`.
 *
 * Source: in-repo `src/lib/admin/reports.ts` (authenticated admin read; never the
 * service-role client); 15-RESEARCH §4 (the `getOperatorInsights` Promise.all);
 * the RPC return shapes from `src/types/database.ts`.
 */

/** Top-N portfolios by views in the window (aggregates only — username + count). */
export interface TopPortfolioRow {
  username: string;
  views: number;
}

/** One day of the 30-day page-view trend (generate_series fills empty days). */
export interface DailyViewsRow {
  day: string;
  views: number;
}

/** `rate_limit_events` grouped by bucket (abuse observability, ANLY-04). */
export interface RateLimitBucketRow {
  bucket: string;
  events: number;
}

/** One day of the report-volume trend (report spikes, ANLY-04). */
export interface ReportVolumeRow {
  day: string;
  reports: number;
}

/** The typed shape the `/admin/insights` RSC + `InsightsView` island consume. */
export interface OperatorInsights {
  /** Total page views in the fixed recent window (30 days). */
  total: number;
  /** Top-N portfolios by views (ranked, newest window). */
  top: TopPortfolioRow[];
  /** Per-day page-view series for the sparkline (30 days). */
  daily: DailyViewsRow[];
  /** Rate-limit events grouped by bucket (7-day abuse window). */
  buckets: RateLimitBucketRow[];
  /** Per-day report-volume series (14-day window). */
  reports: ReportVolumeRow[];
}

/**
 * Read all five operator aggregates via the AUTHENTICATED client over the DEFINER
 * RPCs (D-16 / T-06-W4) — never service-role, never a raw-row read. Returns calm
 * defaults so a transient read error renders the Insights empty/error state.
 */
export async function getOperatorInsights(): Promise<OperatorInsights> {
  const supabase = await createClient(); // authenticated identity — the layout proved is_admin().

  // Each RPC self-gates on is_admin(); a non-admin would get an error (defense-in-depth).
  const [{ data: total }, { data: top }, { data: daily }, { data: buckets }, { data: reports }] =
    await Promise.all([
      supabase.rpc('page_view_total_count', { p_days: 30 }),
      supabase.rpc('page_view_top_portfolios', { p_days: 30, p_limit: 10 }),
      supabase.rpc('page_view_daily_series', { p_days: 30 }),
      supabase.rpc('rate_limit_events_by_bucket', { p_days: 7 }),
      supabase.rpc('report_volume_series', { p_days: 14 }),
    ]);

  return {
    total: (total as number | null) ?? 0,
    top: (top as TopPortfolioRow[] | null) ?? [],
    daily: (daily as DailyViewsRow[] | null) ?? [],
    buckets: (buckets as RateLimitBucketRow[] | null) ?? [],
    reports: (reports as ReportVolumeRow[] | null) ?? [],
  };
}
