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
 */
import { useEffect, useRef, useState } from 'react';

export function ScrollReveal({
  children,
  /** Stagger within an orchestrated group (ms). */
  delay = 0,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  as?: 'div' | 'section' | 'li';
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
