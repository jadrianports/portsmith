'use client';

/**
 * ShowcaseCarousel — the hand-rolled scroll-snap proof carousel (D-03 / SHOW-02).
 *
 * The ONLY interactivity on the `force-static` landing. A native CSS scroll-snap track
 * (`overflow-x-auto snap-x snap-mandatory`, each slide `snap-start shrink-0`) gives free
 * swipe / trackpad / wheel nav with ZERO library; this island layers ONLY keyboard/button
 * controls on top — real `<button aria-label>` prev/next + dot indicators tracking the
 * active slide. NO `motion`, NO carousel lib — hand-rolled (D-03) to protect the landing
 * First-Load-JS budget (the single biggest threat to the SSG/perf invariants).
 *
 * Each slide is a `ShowcaseCard` whose `imageSrc` is the committed static
 * `/landing/showcase-*.webp` page screenshot carried on each `SHOWCASE_USERNAMES` entry
 * (LAND-03 / D-12) — browser-loaded as an `<img>`, never server-fetched (keeps `/` force-static).
 * Fed by the curated static `SHOWCASE_USERNAMES` array (D-04).
 *
 * REDUCED-MOTION: programmatic `scrollBy`/`scrollTo` uses `behavior: 'auto'` when
 * `(prefers-reduced-motion: reduce)` matches, else `'smooth'` — mirrors the `motion-reduce`
 * discipline on `ShowcaseCard`.
 *
 * TWO-LAYER (load-bearing): lives under `src/components/landing/` so `landing-isolation.test.ts`
 * auto-covers it — chrome `@theme` tokens ONLY (border-border / bg-surface / text-foreground /
 * the focus-ring), NO `tmpl-*` token, NO inline hex, NO `components/templates/*` import.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ShowcaseCard } from './showcase-card';
import { SHOWCASE_USERNAMES } from './showcase-usernames';

/** Resolve the scroll behavior, honoring the user's reduced-motion preference (SSR-safe). */
function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'auto';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

export function ShowcaseCarousel() {
  const trackRef = useRef<HTMLUListElement>(null);
  const slideRefs = useRef<(HTMLLIElement | null)[]>([]);
  /** Per-slide intersection ratios — the source of truth for "which slide is most visible". */
  const ratiosRef = useRef<number[]>([]);
  const [active, setActive] = useState(0);
  /** Whether the track actually overflows (is scrollable). When false (all slides fit — e.g. 2
   *  cards on wide desktop), the prev/next + dots are meaningless and are hidden, so the resting
   *  state never reads as "last slide active + Next disabled" on a non-scrollable track. */
  const [scrollable, setScrollable] = useState(false);

  const count = SHOWCASE_USERNAMES.length;

  /** Scroll a given slide index into view (reduced-motion-aware). */
  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, SHOWCASE_USERNAMES.length - 1));
    const slide = slideRefs.current[clamped];
    const track = trackRef.current;
    if (!slide || !track) return;
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: scrollBehavior() });
  }, []);

  const goPrev = useCallback(() => goTo(active - 1), [active, goTo]);
  const goNext = useCallback(() => goTo(active + 1), [active, goTo]);

  /**
   * Track the active slide via IntersectionObserver (no scroll-event thrash). The active slide is
   * the MOST-visible one (highest intersection ratio), breaking ties toward the LOWEST index — so
   * at rest it resolves to slide 0 (the visible/first slide), never the last intersecting entry.
   */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    ratiosRef.current = new Array(slideRefs.current.length).fill(0);
    const observer = new IntersectionObserver(
      (entries) => {
        // Record each reported slide's latest visibility ratio.
        for (const entry of entries) {
          const idx = slideRefs.current.indexOf(entry.target as HTMLLIElement);
          if (idx >= 0) ratiosRef.current[idx] = entry.intersectionRatio;
        }
        // Pick the most-visible slide; ties (equal ratio) resolve to the LOWEST index.
        let best = 0;
        let bestRatio = -1;
        for (let i = 0; i < ratiosRef.current.length; i++) {
          if (ratiosRef.current[i] > bestRatio) {
            bestRatio = ratiosRef.current[i];
            best = i;
          }
        }
        setActive(best);
      },
      // Multiple thresholds so the ratio comparison is fine-grained (not a single 0.6 cliff).
      { root: track, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    for (const slide of slideRefs.current) {
      if (slide) observer.observe(slide);
    }
    return () => observer.disconnect();
  }, []);

  /** Detect whether the track overflows (is scrollable); keep it current across resizes. */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setScrollable(track.scrollWidth > track.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="mt-8">
      {/* The native scroll-snap track — free swipe/trackpad/wheel nav, no lib. */}
      <ul
        ref={trackRef}
        className="-mx-1 flex snap-x snap-mandatory gap-6 overflow-x-auto px-1 pb-4 [scrollbar-width:thin]"
      >
        {SHOWCASE_USERNAMES.map((entry, i) => (
          <li
            key={entry.username}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            className="w-[min(85vw,32rem)] shrink-0 snap-start"
          >
            <ShowcaseCard
              username={entry.username}
              imageSrc={entry.image}
              alt={entry.alt}
              caption={entry.caption}
              name={entry.name}
            />
          </li>
        ))}
      </ul>

      {/* Prev/next + dots — the keyboard/button controls layered over native scroll-snap. Hidden
          when the track does not overflow (all slides fit — e.g. 2 cards on wide desktop): with
          nothing to scroll the affordances are meaningless, so we drop them entirely rather than
          render an ambiguous "last slide active + Next disabled" resting state. */}
      <div
        className={`mt-4 flex items-center justify-center gap-4 ${scrollable ? '' : 'hidden'}`}
        aria-hidden={scrollable ? undefined : true}
      >
        <button
          type="button"
          onClick={goPrev}
          disabled={active === 0}
          aria-label="Previous portfolio"
          className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground outline-none transition-colors hover:border-border-strong focus-visible:[box-shadow:var(--shadow-focus)] disabled:opacity-40"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>

        <div className="flex items-center gap-2" role="tablist" aria-label="Choose a portfolio">
          {SHOWCASE_USERNAMES.map((entry, i) => (
            <button
              key={entry.username}
              type="button"
              role="tab"
              aria-selected={active === i}
              aria-label={`Go to slide ${i + 1} of ${count}`}
              onClick={() => goTo(i)}
              className={`size-2.5 rounded-full outline-none transition-colors focus-visible:[box-shadow:var(--shadow-focus)] ${
                active === i ? 'bg-foreground' : 'bg-border-strong hover:bg-foreground'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={active >= count - 1}
          aria-label="Next portfolio"
          className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground outline-none transition-colors hover:border-border-strong focus-visible:[box-shadow:var(--shadow-focus)] disabled:opacity-40"
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>
    </div>
  );
}
