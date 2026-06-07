// src/components/templates/edgerunner/sections/ui/glow-card.tsx
// Server Component — no hooks, no event handlers, CSS-only hover effects.
// Ported from lovable-exports/synthwave-founder/src/components/ui/GlowCard.tsx
// R1: no framer-motion (not needed — original used it only for hover; replaced with CSS).
// R3: all colors via var(--token). R5: no JS required — fully SSR-visible. R6: no 'use client'.
import type { ReactNode } from 'react';

type Accent = 'pink' | 'cyan' | 'purple';
type Tag = 'div' | 'article' | 'li';

/** Per-accent gradient for the pseudo-border layer. */
const accentGradient: Record<Accent, string> = {
  pink: 'linear-gradient(135deg, var(--neon-pink), var(--neon-magenta), var(--neon-purple))',
  cyan: 'linear-gradient(135deg, var(--neon-cyan), var(--neon-purple), var(--neon-pink))',
  purple: 'linear-gradient(135deg, var(--neon-purple), var(--neon-pink), var(--neon-cyan))',
};

/** Per-accent outer glow shadow for hover state (applied via CSS class in theme.css scope). */
const accentShadow: Record<Accent, string> = {
  pink: '0 0 22px -6px color-mix(in oklab, var(--neon-pink) 55%, transparent)',
  cyan: '0 0 22px -6px color-mix(in oklab, var(--neon-cyan) 55%, transparent)',
  purple: '0 0 22px -6px color-mix(in oklab, var(--neon-purple) 55%, transparent)',
};

type Props = {
  accent?: Accent;
  /** Semantic tag override — the inner `<div>` always renders as `div`. */
  as?: Tag;
  className?: string;
  children: ReactNode;
};

/**
 * GlowCard — gradient-bordered holographic glass panel.
 *
 * The outer element is a 1.5px gradient-border wrapper (position:relative, padding:1.5px,
 * border-radius:var(--radius-lg)). The inner element is the frosted-glass surface
 * (backdrop-blur, surface background, matching border-radius).
 *
 * Hover: the outer glow transitions via CSS `transition` on `box-shadow`. No JS required.
 *
 * The `as` prop controls the OUTER element's tag (div/article/li) for semantics.
 * The inner wrapper is always a `div` (the glass surface).
 */
export function GlowCard({ accent = 'pink', as = 'div', className, children }: Props) {
  const Tag = as;

  const outerStyle: React.CSSProperties = {
    position: 'relative',
    padding: '1.5px',
    borderRadius: 'var(--radius-lg)',
    background: accentGradient[accent],
    transition: 'box-shadow 400ms ease',
  };

  const innerStyle: React.CSSProperties = {
    position: 'relative',
    height: '100%',
    borderRadius: 'calc(var(--radius-lg) - 1.5px)',
    background: 'linear-gradient(145deg, color-mix(in oklab, var(--neon-purple) 10%, var(--surface)), color-mix(in oklab, var(--neon-cyan) 5%, var(--surface)))',
    backdropFilter: 'blur(12px)',
    padding: '24px',
  };

  // Hover glow is injected via a data attribute + CSS in theme.css scope.
  // We use an inline onMouseEnter/Leave-free approach: the CSS `transition` on
  // box-shadow is set on the outer element; the actual hover selector lives in
  // theme.css as `.tmpl-edgerunner .tmpl-glow-card-pink:hover` etc.
  // To avoid JS, we apply a data-accent attribute so a single CSS rule covers all
  // accents via `[data-accent="pink"]:hover`, etc.
  return (
    <Tag
      data-accent={accent}
      className={['tmpl-glow-card', className].filter(Boolean).join(' ')}
      style={outerStyle}
    >
      <div style={innerStyle}>{children}</div>
    </Tag>
  );
}
