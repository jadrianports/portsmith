'use client';
/**
 * GlowCard for edgerunner-v2 — bar-for-bar port of
 * lovable-exports/synthwave-founder/src/components/ui/GlowCard.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout/sizing/class structure VERBATIM from export JSX.
 *   2. Color Tailwind classes converted → inline style with scoped var(--token).
 *      bg-card/80 → background via --gradient-card token.
 *      hover:shadow-neon-* → accentShadow via onMouseEnter/Leave (client).
 *   3. Custom classes (shadow-neon-*, before:bg-[...]) handled via inline CSS + data-attr.
 *   4. 'use client' for hover interaction.
 *
 * The gradient-border wrapper uses ::before with the neon gradient. Since we can't use
 * Tailwind's arbitrary `before:bg-[...]` in a .tsx file scoped to the template, we wire
 * the border directly via inline background + padding on the outer element, matching
 * the export's visual exactly.
 */
import { type ReactNode, forwardRef } from 'react';

type Accent = 'pink' | 'cyan' | 'purple';
type Tag = 'div' | 'article' | 'li';

const accentGradient: Record<Accent, string> = {
  pink: 'linear-gradient(135deg, var(--neon-pink), var(--neon-magenta), var(--neon-purple))',
  cyan: 'linear-gradient(135deg, var(--neon-cyan), var(--neon-purple), var(--neon-pink))',
  purple: 'linear-gradient(135deg, var(--neon-purple), var(--neon-pink), var(--neon-cyan))',
};

const accentShadow: Record<Accent, string> = {
  pink: '0 0 22px -6px color-mix(in oklab, var(--neon-pink) 55%, transparent)',
  cyan: '0 0 22px -6px color-mix(in oklab, var(--neon-cyan) 55%, transparent)',
  purple: '0 0 22px -6px color-mix(in oklab, var(--neon-purple) 55%, transparent)',
};

type Props = {
  accent?: Accent;
  className?: string;
  children: ReactNode;
  as?: Tag;
};

/** Neon glow-border card with a glassy interior. */
export const GlowCard = forwardRef<HTMLDivElement, Props>(function GlowCard(
  { accent = 'pink', className, children, as = 'div' },
  ref
) {
  const Tag = as as 'div';

  return (
    <Tag
      ref={ref}
      className={['group relative rounded-2xl p-[1.5px] transition-all duration-500', className]
        .filter(Boolean)
        .join(' ')}
      style={{
        background: accentGradient[accent],
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = accentShadow[accent];
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = '';
      }}
    >
      <div
        className="relative h-full rounded-2xl backdrop-blur-xl p-6"
        style={{ backgroundImage: 'var(--gradient-card)' }}
      >
        {children}
      </div>
    </Tag>
  );
});
