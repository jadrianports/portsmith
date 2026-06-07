/**
 * SectionHeading for edgerunner-v2 — bar-for-bar port of
 * lovable-exports/synthwave-founder/src/components/ui/SectionHeading.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout classes VERBATIM from export JSX.
 *   2. Color classes converted → inline style with scoped var(--token).
 *   3. Custom classes (font-mono-retro, text-glow-*, text-neon-*) KEPT AS-IS (scoped in theme.css).
 *   4. SERVER COMPONENT — no 'use client', no motion (bundle-budget; D-25 / TMPL-04).
 *      The export's entrance motion here was `initial={false}` + `animate` = the elements
 *      render AT REST (no visible entrance). The shared `ScrollReveal` kit wrapper already
 *      reveals each section on scroll, so the redundant per-heading `m.*` islands were
 *      pulling `motion/react` into the public First Load JS for ZERO static-render effect.
 *      Converted to plain elements — pixel-identical at rest (the parity capture is
 *      `reducedMotion:'reduce'`, where `initial={false}` motion is suppressed anyway).
 */
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
        <span
          className="font-mono-retro text-sm uppercase tracking-[0.4em]"
          style={{ color: 'color-mix(in oklab, var(--neon-cyan) 80%, transparent)' }}
        >
          // {eyebrow}
        </span>
      )}
      <h2
        className={`font-display text-3xl font-bold uppercase tracking-wider sm:text-4xl md:text-5xl ${accentTextClass[accent]}`}
      >
        {title}
      </h2>
      {description && (
        <p
          className="max-w-2xl text-base sm:text-lg"
          style={{ color: 'var(--muted-fg)' }}
        >
          {description}
        </p>
      )}
    </div>
  );
}
