'use client';
/**
 * TiltCard for edgerunner-v2 — bar-for-bar port of
 * lovable-exports/synthwave-founder/src/components/ui/TiltCard.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Structure/props VERBATIM from export.
 *   2. framer-motion → motion/react. ALL motion values VERBATIM.
 *   3. color-mix token VERBATIM.
 *   4. 'use client' required.
 */
import { useRef, type ReactNode, type MouseEvent } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'motion/react';

export function TiltCard({
  children,
  className,
  max = 8,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 200, damping: 20 });
  const sy = useSpring(my, { stiffness: 200, damping: 20 });
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

  if (prefersReduced) {
    return (
      <div ref={ref} className={['relative', className].filter(Boolean).join(' ')}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX, rotateY, transformPerspective: 900, transformStyle: 'preserve-3d' }}
      className={['relative', className].filter(Boolean).join(' ')}
    >
      {children}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background: sheenBg,
          mixBlendMode: 'screen',
        }}
      />
    </motion.div>
  );
}
