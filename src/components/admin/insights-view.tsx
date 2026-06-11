'use client';

/**
 * InsightsView (15-UI-SPEC Surface A, ANLY-03 / ANLY-04) — the operator Insights
 * surface: a **Traffic** section (total-views headline + top-N portfolios + a
 * 30-day inline-SVG sparkline) and an **Abuse & rate limits** section (rate-limit
 * events by bucket + report volume), one scroll, two stacked sections (`gap-8`).
 *
 * CHROME layer (Evergreen & Copper, Inter): Tailwind utilities → `globals.css
 * @theme` tokens + lucide glyphs ONLY; NO scoped per-template theme classes
 * (two-layer isolation, SHARED-E). The copper accent (`hover:text-accent` /
 * `outline-ring`) is reserved for link-hover + focus rings — NEVER a fill. Per the
 * accent-scarcity rule the sparkline stroke is brand EVERGREEN (`--color-brand`),
 * NOT copper.
 *
 * PASSIVE numbers only — these are observational surfaces the operator eyeballs.
 * There is NO thresholding and no warning/alerting language (D-15 — comparing a
 * count to a prior window is Phase 16). Every numeric figure renders `tabular-nums`
 * so counts don't jitter.
 *
 * `'use client'` for the polite `aria-live` region + the computed sparkline; it
 * takes the RSC-loaded `OperatorInsights` as props and fetches nothing itself
 * (server data stays on the server — this island only renders it). The sparkline
 * is a net-new dependency-free inline `<svg>` (no charting library — lean-deps
 * ethos), static under `prefers-reduced-motion`.
 *
 * Source: the card shell + empty-state recipe + "View live ↗" link + `aria-live`
 * discipline from `report-queue.tsx`; the `<Alert variant="error">` from
 * `@/components/ui/alert`; the typed shape from `@/lib/analytics/operator-analytics`;
 * `siteUrl` from `@/lib/url`.
 */
import { Activity, BarChart3, ExternalLink, TrendingUp } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import type {
  DailyViewsRow,
  OperatorInsights,
} from '@/lib/analytics/operator-analytics';
import { siteUrl } from '@/lib/url';

/** UI-SPEC error copy (curly apostrophe), mirroring the house Alert pattern. */
const LOAD_ERROR = 'We couldn’t load analytics. Please try again.';

export interface InsightsViewProps {
  /** The RSC-loaded operator aggregates (calm defaults on a read error). */
  insights: OperatorInsights;
}

export function InsightsView({ insights }: InsightsViewProps) {
  const { total, top, daily, buckets, reports, error } = insights;

  // Total reports across the report-volume window — a passive count the operator
  // eyeballs (D-15: no comparison/warning copy, just the number).
  const reportTotal = reports.reduce((sum, r) => sum + (r.reports ?? 0), 0);

  // A read error degrades to calm defaults; surface the load-error Alert (announced
  // politely) instead of reading the empty result as a genuine "no traffic" state.
  if (error) {
    return (
      <div aria-live="polite">
        <Alert variant="error">{LOAD_ERROR}</Alert>
      </div>
    );
  }

  const trafficEmpty = total === 0 && top.length === 0;
  const abuseEmpty = buckets.length === 0 && reportTotal === 0;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Section 1: Traffic ───────────────────────────────────────────────── */}
      <section aria-labelledby="insights-traffic-heading">
        <h2
          id="insights-traffic-heading"
          className="mb-4 flex items-center gap-1.5 text-base font-semibold text-foreground"
        >
          <TrendingUp aria-hidden="true" className="size-4 text-muted-foreground" />
          Traffic
        </h2>

        {trafficEmpty ? (
          <EmptyState
            heading="No traffic yet"
            body="Page views appear here as visitors land on published portfolios."
          />
        ) : (
          <div className="rounded-md border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-6">
            {/* Focal point — total-views headline (Display 28/600, tabular-nums). */}
            <p className="text-[28px] font-semibold leading-tight tracking-[-0.01em] tabular-nums text-foreground">
              {total.toLocaleString()}
            </p>
            <p className="text-[13px] text-muted-foreground">
              total views · Last 30 days
            </p>

            {/* 30-day trend — inline dependency-free SVG sparkline (evergreen stroke). */}
            <Sparkline daily={daily} className="mt-4" />

            {/* Top-N portfolios — username (Label) + tabular-nums count + View live. */}
            {top.length > 0 ? (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  Top portfolios
                </h3>
                <ul className="flex flex-col">
                  {top.map((row) => {
                    const liveHref = siteUrl('/' + row.username);
                    return (
                      <li
                        key={row.username}
                        className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0"
                      >
                        <a
                          href={liveHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View ${row.username}’s page in a new tab`}
                          className={
                            'inline-flex min-h-11 min-w-0 items-center gap-1.5 text-sm font-semibold ' +
                            'text-foreground underline-offset-2 outline-none transition-colors ' +
                            'hover:text-accent hover:underline focus-visible:outline-2 ' +
                            'focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none'
                          }
                        >
                          <span className="truncate">{row.username}</span>
                          <ExternalLink
                            aria-hidden="true"
                            className="size-3.5 shrink-0"
                          />
                        </a>
                        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                          {row.views.toLocaleString()}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* ── Section 2: Abuse & rate limits ───────────────────────────────────── */}
      <section aria-labelledby="insights-abuse-heading">
        <h2
          id="insights-abuse-heading"
          className="mb-4 flex items-center gap-1.5 text-base font-semibold text-foreground"
        >
          <Activity aria-hidden="true" className="size-4 text-muted-foreground" />
          Abuse &amp; rate limits
        </h2>

        {abuseEmpty ? (
          <EmptyState
            heading="All quiet"
            body="No rate-limit events or report spikes in this window."
          />
        ) : (
          <div className="rounded-md border border-border bg-surface p-4 shadow-[var(--shadow-card)] sm:p-6">
            {/* Rate-limit events grouped by bucket — passive per-bucket counts only. */}
            {buckets.length > 0 ? (
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <BarChart3
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  Rate-limit events
                  <span className="text-[13px] font-normal text-muted-foreground">
                    · Last 7 days
                  </span>
                </h3>
                <ul className="flex flex-col">
                  {buckets.map((row) => (
                    <li
                      key={row.bucket}
                      className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0"
                    >
                      {/* Bucket name as a color-independent text label (not a dot). */}
                      <span className="inline-flex items-center rounded-md bg-surface-muted px-2 py-0.5 text-sm font-semibold text-foreground">
                        {row.bucket}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        {row.events.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Report volume — a passive count + plain window qualifier (just the number). */}
            <div className={buckets.length > 0 ? 'mt-6' : undefined}>
              <h3 className="mb-1 text-sm font-semibold text-foreground">
                Report volume
              </h3>
              <p className="text-base tabular-nums text-foreground">
                {reportTotal.toLocaleString()}
                <span className="ml-1.5 text-[13px] text-muted-foreground">
                  reports · Last 14 days
                </span>
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** Shared empty-state block (mirrors the `report-queue.tsx` "Queue clear" recipe). */
function EmptyState({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <h3 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
        {heading}
      </h3>
      <p className="max-w-md text-base text-muted-foreground">{body}</p>
    </div>
  );
}

/**
 * A net-new dependency-free 30-day trend sparkline — a single inline `<svg>`
 * `<polyline>` over the daily view counts. Stroke is brand EVERGREEN
 * (`--color-brand`, the accent-scarcity rule — copper is reserved for
 * focus/active/link-hover, never a chart). Decorative-with-summary: `role="img"` +
 * an `aria-label` summarizing the trend; the headline number conveys the value
 * textually, so the chart shape is never the only signal. Static — no draw-on
 * animation — so it is inert under `prefers-reduced-motion`.
 */
function Sparkline({
  daily,
  className,
}: {
  daily: DailyViewsRow[];
  className?: string;
}) {
  // Need at least two points to draw a line; otherwise render nothing (the
  // headline + caption already carry the data textually).
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
      aria-label={`Page views over the last 30 days — peak ${peak.toLocaleString()}, ${last.toLocaleString()} on the latest day`}
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
