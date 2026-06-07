/**
 * NeonButton / NeonLink — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/components/ui/NeonButton.tsx
 *
 * CHANGES FROM EXPORT:
 *   - Removed `cn` import (no shadcn/utils in this template tree)
 *   - Tailwind color utilities in `variants` converted to inline styles via scoped tokens:
 *     bg-gradient-neon → backgroundImage: 'var(--gradient-neon)'
 *     text-primary-foreground → color: 'var(--bg)'
 *     shadow-neon-pink → boxShadow: 'var(--shadow-neon-pink)'
 *     hover:shadow-neon-cyan → handled via CSS class in theme.css
 *     border-neon-cyan/60 → borderColor: 'color-mix(in oklab, var(--neon-cyan) 60%, transparent)'
 *     text-neon-cyan → color: 'var(--neon-cyan)'
 *     hover:bg-neon-cyan/10 → handled via CSS in theme.css
 *     text-foreground/80 → color: 'color-mix(in oklab, var(--fg) 80%, transparent)'
 *   - focus-visible:ring-2 focus-visible:ring-neon-pink → inline focus style
 *   - Layout + sizing Tailwind classes are KEPT VERBATIM (they work with @import "tailwindcss")
 *   - `font-display` class is kept — scoped in theme.css
 * Server Component — no 'use client', no hooks.
 */
import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';

type Variant = 'primary' | 'outline' | 'ghost';

// Base Tailwind classes VERBATIM from export (layout/typography only)
const baseClass =
  'relative inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 font-display text-sm font-semibold uppercase tracking-[0.18em] transition-all duration-300 focus-visible:outline-none';

// Variant-specific inline styles (color/shadow tokens only — no Tailwind color utilities)
function variantStyle(variant: Variant): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        backgroundImage: 'var(--gradient-neon)',
        color: 'var(--bg)',
        boxShadow: 'var(--shadow-neon-pink)',
      };
    case 'outline':
      return {
        border: '1px solid color-mix(in oklab, var(--neon-cyan) 60%, transparent)',
        color: 'var(--neon-cyan)',
        background: 'transparent',
      };
    case 'ghost':
      return {
        color: 'color-mix(in oklab, var(--fg) 80%, transparent)',
        background: 'transparent',
      };
  }
}

type Common = {
  variant?: Variant;
  className?: string;
  children: ReactNode;
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Common;
export function NeonButton({ variant = 'primary', className, children, style, ...rest }: ButtonProps) {
  return (
    <button
      className={[baseClass, className].filter(Boolean).join(' ')}
      style={{ ...variantStyle(variant), ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & Common & { external?: boolean };
export function NeonLink({ variant = 'primary', className, children, external, style, ...rest }: LinkProps) {
  return (
    <a
      className={[baseClass, className].filter(Boolean).join(' ')}
      style={{ ...variantStyle(variant), textDecoration: 'none', ...style }}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      {...rest}
    >
      {children}
    </a>
  );
}
