'use client';
// src/components/templates/edgerunner/sections/ui/magnetic.tsx
// Client Component — pointer-follow magnetic effect via motion springs.
// Ported from lovable-exports/synthwave-founder/src/components/ui/MagneticButton.tsx
// R1: framer-motion → motion/react. R3: no hardcoded values (position only — no colors).
// R5: SSR-renders at rest position (x=0, y=0 — fully visible). Reduced-motion → no movement.
// R6: 'use client' required for motion hooks + event handlers.
import { useRef, type ReactNode, type MouseEvent } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from 'motion/react';

type Props = {
  children: ReactNode;
  className?: string;
  /** Fraction of cursor offset to apply as displacement (default 0.35). */
  strength?: number;
};

export function Magnetic({ children, className, strength = 0.35 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 200, damping: 18, mass: 0.4 });

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (prefersReduced) return;
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
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
