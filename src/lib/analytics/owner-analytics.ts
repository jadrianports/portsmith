import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { DIRECT_BUCKET, toSourceBucket } from '@/lib/analytics/source-buckets';

/**
 * Owner analytics read (ANLY-01 / ANLY-03, 15-05 / D-12 / D-13) — the bounded,
 * glanceable "your portfolio got N views" numbers for the dashboard card.
 *
 * `import 'server-only'` is the literal first line (above) so this authenticated
 * own-rows read can never reach a client bundle.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ READ BOUNDARY (T-15-14 + D-13, LOAD-BEARING):                                 │
 * │ The owner read uses the AUTHENTICATED `createClient()` — NEVER the            │
 * │ service-role admin client, and NEVER the five operator DEFINER aggregate RPCs │
 * │ (those are operator-only, is_admin()-gated, 15-02/15-04). The existing        │
 * │ `page_views own select` RLS policy (migration 004:222) scopes EVERY returned  │
 * │ row to the caller's OWN portfolio via the `EXISTS (… portfolios.user_id =     │
 * │ auth.uid())` join — so the read needs NO explicit `portfolio_id` filter (the  │
 * │ policy IS the tenant boundary, proven cross-tenant-denied by the Plan-01      │
 * │ integration test). Aggregation happens in TypeScript: a single portfolio's    │
 * │ page-view volume is trivial (D-13/D-19), so a scoped DEFINER RPC is overkill   │
 * │ (RESEARCH OQ-7) — no new policy, no new RPC, no migration to read.            │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * PRIVACY (T-15-02): the returned shape is anonymous + aggregate ONLY — counts, a
 * per-day trend, and friendly source-bucket labels (via `toSourceBucket`, D-10).
 * No raw IP is ever read (it is never stored), no viewer identity, no country.
 *
 * A read error degrades to CALM DEFAULTS (the `error` flag is set so the card can
 * show its load-error Alert instead of a misleading "no views yet" empty state).
 *
 * Source: the authenticated-read posture of `src/lib/admin/reports.ts` (never the
 * service-role client); 15-RESEARCH §5 (the `getOwnerAnalytics` own-rows select +
 * TS aggregation); `toSourceBucket` from `@/lib/analytics/source-buckets`.
 */

/** How many days the trend window + the "last 30 days" figure cover. */
const WINDOW_DAYS = 30;
/** A generous safety bound on the rows pulled for in-TS aggregation (D-13). */
const ROW_CAP = 10_000;
/** Milliseconds in one day (window-since math). */
const DAY_MS = 24 * 60 * 60 * 1000;

/** One day of the 30-day trend (the series is filled to a contiguous range). */
export interface OwnerDailyRow {
  /** The day, `YYYY-MM-DD` (UTC). */
  day: string;
  /** Page views recorded that day. */
  views: number;
}

/** One friendly source bucket + its count (e.g. `{ source: 'LinkedIn', views: 40 }`). */
export interface OwnerReferrerRow {
  /** The friendly bucket label from `toSourceBucket` (incl. "Direct / unknown"). */
  source: string;
  /** Views attributed to that bucket in the window. */
  views: number;
}

/** The typed shape the `AnalyticsCard` consumes (D-12). */
export interface OwnerAnalytics {
  /** All-time total page views across the owner's portfolio (headline, D-12). */
  allTime: number;
  /** Page views in the last 30 days (the trend figure, D-12/D-17). */
  total30d: number;
  /** All-time blog views (rows whose `path` contains `/blog`) — a secondary figure. */
  blogAllTime: number;
  /** Per-day series for the 30-day sparkline (contiguous, empty days filled, D-12). */
  daily: OwnerDailyRow[];
  /** Top source buckets (desc), always including the explicit "Direct / unknown". */
  topReferrers: OwnerReferrerRow[];
  /**
   * True when a read failed (the data fields then hold calm defaults). The card
   * renders its `<Alert variant="error">` load-error state instead of reading an
   * empty result as a genuine "no views yet" state.
   */
  error: boolean;
}

/** The window-scoped columns the trend/referrer aggregation needs. */
interface PageViewWindowRow {
  path: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  created_at: string;
}

/** The calm-default shape returned on any read error (still a valid `OwnerAnalytics`). */
function emptyAnalytics(error: boolean): OwnerAnalytics {
  return {
    allTime: 0,
    total30d: 0,
    blogAllTime: 0,
    daily: buildDailySeries([]),
    topReferrers: [{ source: DIRECT_BUCKET, views: 0 }],
    error,
  };
}

/** `YYYY-MM-DD` (UTC) for a date — the per-day bucket key + the series label. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build a contiguous {@link WINDOW_DAYS}-day series ending today (UTC), filling
 * every empty day to 0 so the sparkline has no gaps (D-12). `counts` maps a
 * `YYYY-MM-DD` key → that day's view count.
 */
function buildDailySeries(rows: PageViewWindowRow[]): OwnerDailyRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const t = Date.parse(row.created_at);
    if (Number.isNaN(t)) continue;
    const key = dayKey(new Date(t));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const series: OwnerDailyRow[] = [];
  // Oldest → newest so the sparkline reads left (30 days ago) → right (today).
  const todayUtc = Date.parse(dayKey(new Date()) + 'T00:00:00.000Z');
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const key = dayKey(new Date(todayUtc - i * DAY_MS));
    series.push({ day: key, views: counts.get(key) ?? 0 });
  }
  return series;
}

/**
 * Group the window rows into friendly source buckets (D-10 — UTM wins, "Direct /
 * unknown" fallback), sorted by count desc. The explicit {@link DIRECT_BUCKET} is
 * ALWAYS present (even at zero) so the card can render it as a real bucket.
 */
function buildTopReferrers(rows: PageViewWindowRow[]): OwnerReferrerRow[] {
  const counts = new Map<string, number>();
  counts.set(DIRECT_BUCKET, 0); // always present, even at zero (D-10).
  for (const row of rows) {
    const bucket = toSourceBucket(row.referrer, row.utm_source, row.utm_medium);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([source, views]) => ({ source, views }))
    // Highest count first; the explicit Direct bucket sinks to the bottom only
    // when it is genuinely the smallest, keeping the friendly list readable.
    .sort((a, b) => b.views - a.views);
}

/**
 * Read the owner's OWN page views under the existing `page_views own select` RLS +
 * aggregate in TypeScript (D-13). Returns a typed {@link OwnerAnalytics} with calm
 * defaults on any read error (never throws — the card renders an error/empty state).
 *
 * Two reads, both under the authenticated RLS client (the policy scopes both to the
 * owner's portfolio — no `portfolio_id` filter, D-13):
 *   1. An all-time HEAD count (`{ count: 'exact', head: true }`) for the headline —
 *      cheap, pulls no rows (D-12).
 *   2. The last-30-day rows (`path, referrer, utm_source, utm_medium, created_at`,
 *      capped) for the trend series + the source-bucket counts.
 * The all-time blog total is a second cheap head count filtered on `path ~ /blog`.
 */
export async function getOwnerAnalytics(): Promise<OwnerAnalytics> {
  const supabase = await createClient(); // authenticated identity — RLS is the boundary.
  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS).toISOString();

  // 1) All-time headline + all-time blog total — cheap head counts (no rows pulled),
  //    and 2) the windowed rows for the trend + referrer aggregation. All three run
  //    under the same `page_views own select` RLS (owner-scoped, no explicit filter).
  const [allTimeRes, blogRes, windowRes] = await Promise.all([
    supabase.from('page_views').select('id', { count: 'exact', head: true }),
    supabase
      .from('page_views')
      .select('id', { count: 'exact', head: true })
      .ilike('path', '%/blog%'),
    supabase
      .from('page_views')
      .select('path, referrer, utm_source, utm_medium, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(ROW_CAP),
  ]);

  // Any read error → calm defaults + the error flag (the card shows the load-error
  // Alert, not a misleading "no views yet" empty state).
  if (allTimeRes.error || blogRes.error || windowRes.error) {
    return emptyAnalytics(true);
  }

  const rows = (windowRes.data ?? []) as unknown as PageViewWindowRow[];

  return {
    allTime: allTimeRes.count ?? 0,
    total30d: rows.length,
    blogAllTime: blogRes.count ?? 0,
    daily: buildDailySeries(rows),
    topReferrers: buildTopReferrers(rows),
    error: false,
  };
}
