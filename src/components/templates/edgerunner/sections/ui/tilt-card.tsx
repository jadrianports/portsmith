'use client';
// src/components/templates/edgerunner/sections/ui/tilt-card.tsx
// Client Component — mouse-tracked 3D tilt via motion springs.
// Ported from lovable-exports/synthwave-founder/src/components/ui/TiltCard.tsx
// R1: framer-motion → motion/react. R3: token refs only (no hardcoded hex).
// R5: SSR-renders flat & fully visible (no hiding initial). Reduced-motion → no tilt.
//     The sheen overlay is aria-hidden and purely decorative.
// R6: 'use client' required for motion hooks + event handlers.
import { useRef, type ReactNode, type MouseEvent } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'motion/react';

type Props = {
  children: ReactNode;
  className?: string;
  /** Maximum tilt angle in degrees (default 8). */
  max?: number;
};

export function TiltCard({ children, className, max = 8 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  // Normalized pointer position [0..1]; center (0.5) = no tilt.
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 200, damping: 20 });
  const sy = useSpring(my, { stiffness: 200, damping: 20 });

  // Derive tilt rotations and sheen position from spring values.
  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const rotateX = useTransform(sy, [0, 1], [max, -max]);
  const sheenX = useTransform(sx, [0, 1], ['0%', '100%']);
  const sheenY = useTransform(sy, [0, 1], ['0%', '100%']);

  const sheenBg = useTransform(
    [sheenX, sheenY],
    ([x, y]: string[]) =>
      `radial-gradient(380px circle at ${x} ${y}, color-mix(in oklab, var(--neon-cyan) 22%, transparent), transparent 60%)`
  );

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (prefersReduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };

  const onLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  // Under reduced-motion: render a plain div — no 3D, no sheen, content stays visible.
  if (prefersReduced) {
    return (
      <div
        ref={ref}
        className={['tmpl-tilt-card', className].filter(Boolean).join(' ')}
        style={{ position: 'relative' }}
      >
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 900,
        transformStyle: 'preserve-3d',
        position: 'relative',
      }}
      className={['tmpl-tilt-card', className].filter(Boolean).join(' ')}
    >
      {children}
      {/* Decorative sheen overlay — pointer-events disabled, aria-hidden */}
      <motion.div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'var(--radius-lg)',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          background: sheenBg,
        }}
      />
    </motion.div>
  );
}
