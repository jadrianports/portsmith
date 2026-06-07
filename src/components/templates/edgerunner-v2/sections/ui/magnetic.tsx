'use client';
/**
 * Magnetic — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/components/ui/MagneticButton.tsx
 *
 * CHANGES FROM EXPORT:
 *   - `framer-motion` → `motion/react` (same API, motion values VERBATIM)
 * All motion values (stiffness 200, damping 18, mass 0.4, strength 0.35) are VERBATIM.
 */
import { useRef, type ReactNode, type MouseEvent } from 'react';
import { m, useMotionValue, useSpring } from 'motion/react';

type Props = {
  children: ReactNode;
  className?: string;
  strength?: number;
};

export function Magnetic({ children, className, strength = 0.35 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 200, damping: 18, mass: 0.4 });

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <m.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      className={className}
    >
      {children}
    </m.div>
  );
}
