'use client';

/**
 * Scroll-reveal island — a tiny IntersectionObserver fade-up wrapper (UI-SPEC
 * §Motion: "per-section fade-up on scroll … with a no-JS / reduced-motion visible
 * fallback"). One of only TWO client islands the `minimal` template ships
 * (TMPL-04 budget); keep it small.
 *
 * REDUCED-MOTION CONTRACT (hard requirement — UI-SPEC §"Reduced-motion"): content
 * is NEVER hidden behind an animation with no fallback. The opacity:0 / translate
 * starting state is applied ONLY after we confirm motion is allowed (the observer
 * is wired and `prefers-reduced-motion: reduce` is NOT set). So:
 *   - JS disabled        -> renders fully visible (initial inline style is "shown").
 *   - reduced-motion set  -> stays fully visible, observer is never armed.
 *   - motion allowed      -> starts hidden, fades up when it scrolls into view.
 * This guarantees the content is readable in every degraded path.
 *
 * ABOVE-THE-FOLD / LCP CONTRACT (perf gate — TMPL-04 LCP ≤ 2.5s; 03 verification
 * fix 2026-06-01): the FIRST section (the Hero) is the page's LCP element and is
 * ALWAYS in view, so it must NEVER be gated by this JS opacity:0 reveal — doing so
 * delays the LCP text until the island HYDRATES + the IntersectionObserver fires
 * (~2.9s render-delay on throttled mobile = the "entrance animation on the LCP
 * element" anti-pattern). For the Hero, pass `priority` (a.k.a. the load-reveal
 * variant): this component then renders a STATIC, fully-visible wrapper with NO
 * `'use client'` state and NO opacity:0 — the LCP text paints at FCP. The UI-SPEC's
 * "orchestrated page-load reveal" is realized as a CSS-only, opacity-STABLE
 * (translate-only) entrance defined in theme.css (`.tmpl-load-reveal`), so the text
 * is visible from the first paint and never depends on JS. Below-the-fold sections
 * keep the JS fade-up + the reduced-motion / no-JS visible fallback (d6e4c7a).
 */
import { useEffect, useRef, useState } from 'react';

export function ScrollReveal({
  children,
  /** Stagger within an orchestrated group (ms). */
  delay = 0,
  as: Tag = 'div',
  /**
   * Above-the-fold / LCP opt-out. When `true` (the Hero), this wrapper does NOT
   * gate its content behind the JS IntersectionObserver opacity:0 reveal — it
   * renders a static, fully-visible element (the LCP text paints at FCP). Its
   * entrance is the CSS-only, opacity-stable `.tmpl-load-reveal` (theme.css):
   * translate-only, begins at full opacity, reduced-motion-safe. Never set this on
   * a below-the-fold section.
   */
  priority = false,
}: {
  children: React.ReactNode;
  delay?: number;
  as?: 'div' | 'section' | 'li';
  priority?: boolean;
}) {
  // ABOVE-THE-FOLD LCP PATH: render a static, fully-visible wrapper — never gated
  // by hydration/opacity:0. The CSS-only `.tmpl-load-reveal` entrance (theme.css)
  // is opacity-stable (translate-only), so the LCP text is painted at first paint
  // regardless of JS. This branch ships no observer/state for the Hero.
  if (priority) {
    return <Tag className="tmpl-load-reveal">{children}</Tag>;
  }

  return <ScrollRevealOnScroll delay={delay} as={Tag}>{children}</ScrollRevealOnScroll>;
}

/**
 * The below-the-fold scroll-triggered fade-up (the original behavior). Split into
 * its own component so the `priority` Hero path can early-return a static wrapper
 * WITHOUT calling the hooks below (Rules-of-Hooks-safe: hooks live only on this
 * always-scroll-revealing path).
 */
function ScrollRevealOnScroll({
  children,
  delay,
  as: Tag,
}: {
  children: React.ReactNode;
  delay: number;
  as: 'div' | 'section' | 'li';
}) {
  const ref = useRef<HTMLElement | null>(null);
  // Default to revealed so the no-JS / SSR output is fully visible. We only opt
  // INTO the hidden start state once we know motion is permitted (see effect).
  const [revealed, setRevealed] = useState(true);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Reduced motion (or no IO support): leave content visible, do nothing.
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    // Motion is allowed — start hidden, then reveal on intersection.
    setRevealed(false);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      // The cast keeps a single ref usable across the small allowed tag set.
      ref={ref as React.Ref<HTMLDivElement & HTMLLIElement>}
      // Class hook for the reduced-motion CSS-level visible-fallback in theme.css
      // (`.tmpl-reveal { opacity:1 !important }` under prefers-reduced-motion) — a
      // belt-and-suspenders guarantee independent of this JS effect (UI-SPEC §Motion).
      className="tmpl-reveal"
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'none' : 'translateY(16px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
        transitionDelay: revealed ? `${delay}ms` : '0ms',
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </Tag>
  );
}
