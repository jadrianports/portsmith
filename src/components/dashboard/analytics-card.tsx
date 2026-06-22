/**
 * AnalyticsCard (15-UI-SPEC Surface B, ANLY-01 / D-01 / D-12) — the glanceable
 * owner analytics card on `/dashboard`: the all-time total-views headline, the
 * last-30-day figure, a 30-day trend sparkline, and friendly top referrer buckets.
 *
 * This is the dopamine "your portfolio got N views" moment for the first user — a
 * GLANCEABLE CARD, not an analytics product (D-12). One card's worth of information.
 *
 * CHROME layer (Evergreen & Copper, Inter): Tailwind utilities → `globals.css
 * @theme` tokens + lucide glyphs ONLY; NO scoped per-template theme classes
 * (two-layer isolation, SHARED-E). The copper accent is reserved for
 * focus/active/link-hover — NEVER a fill. Per the accent-scarcity rule the
 * sparkline stroke is brand EVERGREEN (`--color-brand`), NOT copper. Every numeric
 * figure renders `tabular-nums` so counts don't jitter as they update.
 *
 * Presentational — it takes the RSC-loaded `OwnerAnalytics` (the dashboard awaits
 * `getOwnerAnalytics()` and spreads the shape in) and renders it; it fetches
 * nothing and holds no state. The sparkline is a net-new dependency-free inline
 * `<svg>` (no charting library — lean-deps ethos), static under
 * `prefers-reduced-motion`.
 *
 * Source: the chrome card shell + empty-state recipe + `aria-live`/`tabular-nums`
 * discipline from `report-queue.tsx`; the inline-SVG `Sparkline` recipe established
 * in `insights-view.tsx` (15-04); the `<Alert variant="error">` from
 * `@/components/ui/alert`; the typed shape from `@/lib/analytics/owner-analytics`.
 */
import { LineChart } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import type { OwnerAnalytics, OwnerDailyRow } from '@/lib/analytics/owner-analytics';

/** UI-SPEC error copy (curly apostrophe), mirroring the house Alert pattern. */
const LOAD_ERROR = 'We couldn’t load analytics. Please try again.';

/** How many source buckets to surface inline (keeps the card glanceable). */
const MAX_REFERRERS = 4;

/** How many outbound-click destinations to surface inline (keeps the card glanceable). */
const MAX_DESTINATIONS = 4;

/** The card consumes the `getOwnerAnalytics()` shape directly (spread by the RSC). */
export type AnalyticsCardProps = OwnerAnalytics;

export function AnalyticsCard({
  allTime,
  total30d,
  blogAllTime,
  daily,
  topReferrers,
  clicks30d,
  topDestinations,
  conversion30d,
  error,
}: AnalyticsCardProps) {
  // A read error degrades to calm defaults upstream; surface the load-error Alert
  // (announced politely) instead of reading the empty result as a genuine "no
  // views yet" state.
  if (error) {
    return (
      <section aria-labelledby="owner-analytics-heading">
        <CardHeading />
        <div aria-live="polite" className="mt-3">
          <Alert variant="error">{LOAD_ERROR}</Alert>
        </div>
      </section>
    );
  }

  // Empty state — no views recorded anywhere yet (D-12 share-prompt copy).
  if (allTime === 0) {
    return (
      <section aria-labelledby="owner-analytics-heading">
        <CardHeading />
        <div className="mt-3 rounded-md border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-6">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <LineChart aria-hidden="true" className="size-10 text-muted-foreground" />
            <h3 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
              No views yet
            </h3>
            <p className="max-w-md text-base text-muted-foreground">
              Share your portfolio link — your view count shows up here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Surface the top buckets only (keeps the card glanceable); buckets arrive sorted
  // desc with the explicit "Direct / unknown" always present (owner-analytics.ts).
  const referrers = topReferrers.slice(0, MAX_REFERRERS);
  // Outbound-click destinations arrive sorted desc; surface the top few inline (ANLY-05).
  const destinations = topDestinations.slice(0, MAX_DESTINATIONS);
  // The conversion figure renders only when there is enough data (null → hidden, D-11).
  const conversionPct =
    conversion30d !== null ? (conversion30d * 100).toLocaleString(undefined, { maximumFractionDigits: 1 }) : null;

  return (
    <section aria-labelledby="owner-analytics-heading">
      <CardHeading />
      <div className="mt-3 rounded-md border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-6">
        {/* Focal point — the all-time total-views headline (Display 28/600, tnum). */}
        <p className="text-[28px] font-semibold leading-tight tracking-[-0.01em] tabular-nums text-foreground">
          {allTime.toLocaleString()}
        </p>
        <p className="text-[13px] text-muted-foreground">total views · All time</p>

        {/* The last-30-day figure (the trend qualifier, D-12/D-17). */}
        <p className="mt-2 text-base text-foreground">
          <span className="font-semibold tabular-nums">{total30d.toLocaleString()}</span>{' '}
          <span className="text-[13px] text-muted-foreground">Last 30 days</span>
        </p>

        {/* 30-day trend — inline dependency-free SVG sparkline (evergreen stroke). */}
        <Sparkline daily={daily} className="mt-4" />

        {/* Top referrers — the friendly inline source-bucket list (D-10). */}
        {referrers.length > 0 ? (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-semibold text-foreground">Top referrers</h3>
            <p className="text-base text-muted-foreground">
              {referrers.map((row, i) => (
                <span key={row.source}>
                  {i > 0 ? <span aria-hidden="true"> · </span> : null}
                  <span>{row.source} </span>
                  <span className="tabular-nums text-foreground">
                    {row.views.toLocaleString()}
                  </span>
                </span>
              ))}
            </p>
          </div>
        ) : null}

        {/* Outbound clicks (30d) — engagement beyond views (ANLY-05). */}
        {clicks30d > 0 ? (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-semibold text-foreground">Outbound clicks</h3>
            <p className="text-base text-foreground">
              <span className="font-semibold tabular-nums">{clicks30d.toLocaleString()}</span>{' '}
              <span className="text-[13px] text-muted-foreground">Last 30 days</span>
            </p>
            {/* Top-clicked destinations — the same inline `·`-separated tnum idiom as referrers. */}
            {destinations.length > 0 ? (
              <p className="mt-1 text-base text-muted-foreground">
                {destinations.map((row, i) => (
                  <span key={row.host}>
                    {i > 0 ? <span aria-hidden="true"> · </span> : null}
                    <span>{row.host} </span>
                    <span className="tabular-nums text-foreground">
                      {row.clicks.toLocaleString()}
                    </span>
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Views→contacts conversion (ANLY-06) — hidden when null (not enough data, D-11). */}
        {conversionPct !== null ? (
          <p className="mt-3 text-[13px] text-muted-foreground">
            Conversion ·{' '}
            <span className="tabular-nums text-foreground">{conversionPct}%</span> of viewers
            reached out
          </p>
        ) : null}

        {/* Optional blog-views sub-figure (Caption 13/400) — only when non-zero. */}
        {blogAllTime > 0 ? (
          <p className="mt-3 text-[13px] text-muted-foreground">
            Blog views ·{' '}
            <span className="tabular-nums text-foreground">
              {blogAllTime.toLocaleString()}
            </span>
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** The card title (Heading 16/600) — shared across the happy/empty/error states. */
function CardHeading() {
  return (
    <h2
      id="owner-analytics-heading"
      className="flex items-center gap-1.5 text-base font-semibold text-foreground"
    >
      <LineChart aria-hidden="true" className="size-4 text-muted-foreground" />
      Your analytics
    </h2>
  );
}

/**
 * A net-new dependency-free 30-day trend sparkline — a single inline `<svg>`
 * `<polyline>` over the daily view counts (the recipe established in
 * `insights-view.tsx`, 15-04). Stroke is brand EVERGREEN (`--color-brand`, the
 * accent-scarcity rule — copper is reserved for focus/active/link-hover, never a
 * chart). Decorative-with-summary: `role="img"` + an `aria-label` summarizing the
 * trend; the headline number conveys the value textually, so the chart shape is
 * never the only signal. Static — no draw-on animation — so it is inert under
 * `prefers-reduced-motion`.
 */
function Sparkline({ daily, className }: { daily: OwnerDailyRow[]; className?: string }) {
  // Need at least two points to draw a line; otherwise render nothing (the headline
  // + caption already carry the data textually).
  if (daily.length < 2) return null;

  const W = 100;
  const H = 28;
  const values = daily.map((d) => d.views ?? 0);
  const max = Math.max(...values);
  const last = values[values.length - 1] ?? 0;
  const peak = max;

  // Normalize each day into the viewBox. A flat all-zero series draws along the
  // bottom edge of the chart (max === 0 → every point at y = H).
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = max === 0 ? H : H - (v / max) * H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      role="img"
      aria-label={`Profile views over the last 30 days — peak ${peak.toLocaleString()}, ${last.toLocaleString()} on the latest day`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={`h-8 w-full${className ? ` ${className}` : ''}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
