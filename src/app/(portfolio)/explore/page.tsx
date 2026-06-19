/**
 * `/explore` — the public showcase gallery (SHOW-04 / D-09..D-16).
 *
 * A net-new cookie-LESS ISR route under `(portfolio)` (lean, no chrome). It renders
 * the opted-in, publish-ready pool from `getShowcaseCandidates()` (31-04 Task 1) as a
 * grid of `ShowcaseCard`s (live per-username og-image previews + links), with a
 * friendly empty-state when the pool is empty (D-14).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ISR / STATIC — NOT DYNAMIC (D-22 / SHOW-04 — LOAD-BEARING):                     │
 * │ `export const revalidate = 3600` matches every `(portfolio)` route. The read    │
 * │ (`getShowcaseCandidates`) is COOKIE-LESS by construction, so NOTHING here reads  │
 * │ `cookies()` / `headers()` / `searchParams` / the request host — any of those     │
 * │ would silently flip the route to dynamic (`ƒ`) and regress the budget. The        │
 * │ Plan-06 build + `route-table-ssg.test.ts` /explore assertion guard this posture. │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * METADATA (D-15/D-16): static, INDEXABLE (no `robots: { index: false }`) metadata
 * mirroring `(chrome)/page.tsx`'s shape — own title/description, `siteUrl('/explore')`
 * canonical, OG + Twitter `summary_large_image` over the `og-default.png` placeholder
 * (D-16; the brand card lands in Phase 32). Every URL is absolute via `siteUrl()`
 * (never the request Host — T-31-11).
 *
 * The card preview `<img src>` is the LIVE per-username og-image route
 * (`siteUrl('/' + username + '/opengraph-image')`, SHOW-01 reuse) — the self-updating
 * Satori card, never a committed screenshot.
 */
import type { Metadata } from 'next';

import { ShowcaseCard } from '@/components/landing/showcase-card';
import { getShowcaseCandidates } from '@/lib/portfolio/get-showcase-candidates';
import { siteUrl } from '@/lib/url';

/** D-21 ISR backstop — 1 hour (matches every `(portfolio)` route). */
export const revalidate = 3600;

const TITLE = 'Explore — published Portsmith portfolios';
const DESCRIPTION =
  'Browse real, published portfolios built on Portsmith — pick a curated template, fill in your experience, and publish a page you are proud to share.';
const CANONICAL = siteUrl('/explore');
const OG_IMAGE = siteUrl('/og-default.png'); // D-16 placeholder (same as landing).

/**
 * D-15/D-16 — static, indexable metadata (NO `robots` noindex). Mirrors the
 * `(chrome)/page.tsx` OG + Twitter `summary_large_image` shape; every URL absolute
 * via `siteUrl()` (Pitfall 5 — a relative OG URL would be rejected by crawlers).
 */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: CANONICAL,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default async function ExplorePage() {
  // Cookie-less anon read (Task 1) — keeps the route ISR-cacheable.
  const candidates = await getShowcaseCandidates();

  return (
    <main className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Explore Portsmith portfolios
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Real pages, really published. Each one was built by picking a curated template
          and filling in structured content — no design skills required.
        </p>
      </header>

      {candidates.length === 0 ? (
        // D-14 — friendly empty-state when the opted-in pool is empty.
        <div className="mt-16 rounded-lg border border-border bg-surface-muted px-6 py-16 text-center">
          <p className="text-lg font-medium text-foreground">
            No showcased portfolios yet
          </p>
          <p className="mt-2 text-base text-muted-foreground">
            Publish yours and opt in from your settings to be featured here.
          </p>
        </div>
      ) : (
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map(({ username, displayName }) => (
            <ShowcaseCard
              key={username}
              username={username}
              imageSrc={siteUrl(`/${username}/opengraph-image`)}
              alt={`Live preview of ${displayName}'s published Portsmith portfolio`}
              caption={`${displayName}'s portfolio`}
              name={displayName}
            />
          ))}
        </div>
      )}
    </main>
  );
}
