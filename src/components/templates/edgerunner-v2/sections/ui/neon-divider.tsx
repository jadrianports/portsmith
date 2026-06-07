'use client';
/**
 * NeonDivider for edgerunner-v2 — bar-for-bar port of
 * lovable-exports/synthwave-founder/src/components/ui/NeonDivider.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout classes VERBATIM from export JSX.
 *   2. Color border/bg → inline style with scoped var(--token).
 *   3. Custom classes (font-mono-retro, text-glow-cyan, text-neon-cyan) KEPT AS-IS.
 *   4. framer-motion → motion/react, ALL motion values VERBATIM.
 *   5. 'use client' required for motion/react.
 */
import { m } from 'motion/react';

export function NeonDivider({
  glyph = '◆',
  className,
}: {
  glyph?: string;
  className?: string;
}) {
  return (
    <div
      className={['relative mx-auto my-2 flex max-w-6xl items-center gap-4 px-6', className]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <m.div
        initial={false}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        className="h-px flex-1 origin-right"
        style={{
          backgroundImage:
            'linear-gradient(to right, transparent, var(--neon-pink), var(--neon-purple), transparent)',
          boxShadow: '0 0 8px var(--neon-pink)',
        }}
      />
      <span className="font-mono-retro text-neon-cyan text-glow-cyan text-lg">{glyph}</span>
      <m.div
        initial={false}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        className="h-px flex-1 origin-left"
        style={{
          backgroundImage:
            'linear-gradient(to right, transparent, var(--neon-cyan), var(--neon-purple), transparent)',
          boxShadow: '0 0 8px var(--neon-cyan)',
        }}
      />
    </div>
  );
}
