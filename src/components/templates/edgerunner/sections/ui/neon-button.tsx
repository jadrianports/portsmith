// src/components/templates/edgerunner/sections/ui/neon-button.tsx
// Server Component — no hooks, no event handlers, pure-CSS presentational.
// Ported from lovable-exports/synthwave-founder/src/components/ui/NeonButton.tsx
// R1: no framer-motion (not needed). R3: all values via var(--token). R6: no 'use client'.
import type { ReactNode, ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'outline' | 'ghost';

const base: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  minHeight: '44px',
  padding: '0 24px',
  borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  textDecoration: 'none',
  cursor: 'pointer',
  border: 'none',
  transition: 'box-shadow 200ms ease, transform 200ms ease, background 200ms ease',
};

const variants: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--neon-gradient)',
    color: 'var(--bg)',
    boxShadow: '0 8px 28px -12px color-mix(in oklab, var(--neon-pink) 50%, transparent)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--neon-cyan)',
    border: '1px solid var(--border-strong)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--fg)',
  },
};

/**
 * NeonLink — anchor variant of the neon button.
 * Props: href, variant?, external?, children
 */
export function NeonLink({
  href,
  variant = 'primary',
  children,
  external,
}: {
  href: string;
  variant?: Variant;
  children: ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      style={{ ...base, ...variants[variant] }}
    >
      {children}
    </a>
  );
}

/**
 * NeonButton — <button> variant for form actions / in-page interactions.
 * Props: variant?, children, plus all native HTMLButtonElement attributes.
 */
export function NeonButton({
  variant = 'primary',
  children,
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
}
