'use client';
/**
 * SectionHeading for edgerunner-v2 — bar-for-bar port of
 * lovable-exports/synthwave-founder/src/components/ui/SectionHeading.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout classes VERBATIM from export JSX.
 *   2. Color classes converted → inline style with scoped var(--token).
 *   3. Custom classes (font-mono-retro, text-glow-*, text-neon-*) KEPT AS-IS (scoped in theme.css).
 *   4. framer-motion → motion/react, ALL motion values VERBATIM.
 *   5. 'use client' required for motion/react.
 */
import { motion } from 'motion/react';

type Accent = 'pink' | 'cyan' | 'purple';

const accentTextClass: Record<Accent, string> = {
  pink: 'text-neon-pink text-glow-pink',
  cyan: 'text-neon-cyan text-glow-cyan',
  purple: 'text-neon-purple text-glow-purple',
};

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  accent?: Accent;
  align?: 'left' | 'center';
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  accent = 'pink',
  align = 'center',
  className,
}: Props) {
  const centered = align === 'center';

  return (
    <div
      className={[
        'mb-12 flex flex-col gap-3',
        centered ? 'items-center text-center' : 'items-start text-left',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {eyebrow && (
        <motion.span
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono-retro text-sm uppercase tracking-[0.4em]"
          style={{ color: 'color-mix(in oklab, var(--neon-cyan) 80%, transparent)' }}
        >
          // {eyebrow}
        </motion.span>
      )}
      <motion.h2
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`font-display text-3xl font-bold uppercase tracking-wider sm:text-4xl md:text-5xl ${accentTextClass[accent]}`}
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="max-w-2xl text-base sm:text-lg"
          style={{ color: 'var(--muted-fg)' }}
        >
          {description}
        </motion.p>
      )}
    </div>
  );
}
