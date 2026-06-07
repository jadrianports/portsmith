// src/components/templates/edgerunner/sections/ui/section-heading.tsx
// Server Component — no motion, no hooks, SSR-renders fully visible.
// Ported from lovable-exports/synthwave-founder/src/components/ui/SectionHeading.tsx
// R1: framer-motion entrance animations DROPPED (sections wrap in ScrollReveal later;
//     heading content must be visible on SSR — R5 invariant).
// R3: all values via var(--token). R6: no 'use client'.
import type { CSSProperties } from 'react';
import { eyebrowStyle } from '../shared';

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

export function SectionHeading({
  eyebrow,
  title,
  description,
  accent = 'pink',
  align = 'center',
  className,
}: Props) {
  const wrapperStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '48px',
    alignItems: align === 'center' ? 'center' : 'flex-start',
    textAlign: align,
  };

  const titleStyle: CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 'clamp(1.75rem, 4vw, 3rem)',
    lineHeight: 1.1,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: accentColor[accent],
    margin: 0,
  };

  const descriptionStyle: CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: 'clamp(0.95rem, 1.5vw, 1.125rem)',
    lineHeight: 1.55,
    color: 'var(--muted-fg)',
    maxWidth: '42rem',
    margin: 0,
  };

  return (
    <div
      className={['tmpl-section-heading', className].filter(Boolean).join(' ')}
      style={wrapperStyle}
    >
      {eyebrow && (
        <span style={eyebrowStyle}>// {eyebrow}</span>
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
