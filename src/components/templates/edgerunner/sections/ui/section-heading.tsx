// src/components/templates/edgerunner/sections/ui/section-heading.tsx
// Server Component — no motion, no hooks, SSR-renders fully visible.
// Ported from lovable-exports/synthwave-founder/src/components/ui/SectionHeading.tsx
// R1: framer-motion entrance animations DROPPED (sections wrap in ScrollReveal later;
//     heading content must be visible on SSR — R5 invariant).
// R3: all values via var(--token). R6: no 'use client'.
import type { CSSProperties } from 'react';

type Accent = 'pink' | 'cyan' | 'purple';

const accentColor: Record<Accent, string> = {
  pink: 'var(--neon-pink)',
  cyan: 'var(--neon-cyan)',
  purple: 'var(--neon-purple)',
};

const accentGlowClass: Record<Accent, string> = {
  pink: 'tmpl-glow-pink',
  cyan: 'tmpl-glow-cyan',
  purple: 'tmpl-glow-purple',
};

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  accent?: Accent;
  align?: 'left' | 'center';
  className?: string;
};

/**
 * Centered section header block — reference-faithful synthwave section header:
 *   1. Small cyan `//`-prefixed eyebrow (mono, uppercase, letter-spaced)
 *   2. BIG neon-glow display title (Orbitron, clamp(2.25rem,5vw,3.25rem), uppercase, text-glow)
 *   3. Optional centered muted subtitle (max-width 640px)
 *
 * Default align='center'. Eyebrow is rendered VERBATIM (caller passes "// CATEGORY").
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  accent = 'pink',
  align = 'center',
  className,
}: Props) {
  const centered = align === 'center';

  const wrapperStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '56px',
    alignItems: centered ? 'center' : 'flex-start',
    textAlign: align,
  };

  // Eyebrow — small, mono/uppercase, neon-cyan, letter-spaced (the `// CATEGORY` label)
  const eyebrowStyle: CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.3,
    textTransform: 'uppercase',
    letterSpacing: '0.22em',
    color: 'var(--neon-cyan)',
    margin: 0,
  };

  // BIG display title — Orbitron, ~3rem clamp, uppercase, text-glow applied via class
  const titleStyle: CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 'clamp(2.25rem, 5vw, 3.25rem)',
    lineHeight: 1.05,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: accentColor[accent],
    margin: 0,
  };

  // Optional subtitle — muted body copy, capped width, centered
  const descriptionStyle: CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontWeight: 400,
    fontSize: 'clamp(0.95rem, 1.5vw, 1.125rem)',
    lineHeight: 1.6,
    color: 'var(--muted-fg)',
    maxWidth: '40rem',
    margin: 0,
  };

  return (
    <div
      className={['tmpl-section-heading', className].filter(Boolean).join(' ')}
      style={wrapperStyle}
    >
      {eyebrow && (
        <span style={eyebrowStyle}>{eyebrow}</span>
      )}
      <h2 style={titleStyle} className={accentGlowClass[accent]}>
        {title}
      </h2>
      {description && (
        <p style={descriptionStyle}>{description}</p>
      )}
    </div>
  );
}
