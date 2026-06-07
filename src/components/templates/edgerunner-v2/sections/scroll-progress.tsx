'use client';
/**
 * ScrollProgress bar for edgerunner-v2 — transcription of
 * lovable-exports/synthwave-founder/src/components/layout/ScrollProgress.tsx
 *
 * Fixed top bar (2px, full-width, bg-gradient-neon), scaleX driven by scroll position.
 * Uses motion/react useScroll + useSpring for a smooth spring-damped fill.
 * zIndex 60 (above navbar at z-50), pointer-events: none.
 * Reduced-motion safe: motionValue still drives scaleX but CSS zeroes transitions.
 */
import { useScroll, useSpring, m } from 'motion/react';

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <m.div
      className="tmpl-scroll-progress"
      style={{ scaleX }}
      aria-hidden="true"
    />
  );
}
