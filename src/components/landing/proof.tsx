/**
 * Proof — the live-preview proof carousel (D-02 / D-03 / D-13 / SHOW-01 / SHOW-02).
 *
 * Replaces the frozen 2-up `.webp` grid with a navigable scroll-snap carousel of LIVE
 * og-image previews of real published portfolios (`<ShowcaseCarousel />`, fed by the curated
 * static `SHOWCASE_USERNAMES` array, D-04). Each slide's `<img src>` is the self-updating
 * per-username `opengraph-image` route (SHOW-01), so the proof reflects each page's actual
 * current published state, not a committed screenshot. The block is NEVER empty (the curated
 * array always has content — the same by-construction guarantee `Proof` had today).
 *
 * Below the carousel, the D-13 "Explore all portfolios →" CTA links to the public `/explore`
 * gallery (the full live opt-in pool — D-05). A plain in-app `<Link>`, no JS, no dynamic read.
 *
 * Stays `force-static` — static literals only; the og-image `<img>` is browser-fetched, never
 * server-fetched here. Chrome `@theme` tokens only (landing-isolation discipline).
 */
import { Link } from '@/components/ui/link';

import { ShowcaseCarousel } from './showcase-carousel';

export function Proof() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-xl font-semibold text-foreground">Real pages, really published</h2>
        <ShowcaseCarousel />
        <p className="mt-6">
          <Link href="/explore">Explore all portfolios →</Link>
        </p>
      </div>
    </section>
  );
}
