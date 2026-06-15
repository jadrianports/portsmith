/**
 * CtaLink — the landing page's ONLY navigating CTA element (Pitfall 2 fix).
 *
 * The `<Button>` primitive renders a native `<button>` with NO `href` — it cannot
 * navigate, and wrapping it in an `<a>` is invalid HTML (an `onClick` nav would force
 * a `'use client'` island, which `/` must avoid to stay SSG). So this lifts the
 * brand-button VISUAL recipe from `button.tsx` (`base` + `variants.primary`) onto a
 * `next/link`, sized up for the marketing hero.
 *
 * Sizing delta vs the auth-card button: `base` is `w-full px-4 text-sm` (card-oriented);
 * the landing scale is `w-auto px-6 text-base`, keeping `min-h-11` (the WCAG 2.5.5 touch
 * target), the brand-evergreen fill, and the `--shadow-focus` copper halo on focus
 * (D-01 — the copper accent is focus-only, never a fill). Every class resolves through a
 * chrome `@theme` token; NO inline hex.
 *
 * Presentational RSC (no `'use client'`). The header / hero / final-CTA all consume this,
 * never the `<Button>` primitive (D-09).
 */
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ComponentProps } from 'react';

export interface CtaLinkProps extends Omit<ComponentProps<typeof Link>, 'children'> {
  children: React.ReactNode;
  /** Render a trailing decorative arrow-right glyph (aria-hidden). Defaults to true. */
  withArrow?: boolean;
}

/**
 * The brand-button recipe lifted from `button.tsx:30-39`, sized for the landing hero
 * (`w-auto px-6 text-base` instead of the auth card's `w-full px-4 text-sm`). All
 * token-driven: `bg-brand`/`text-brand-foreground`/`hover:bg-brand-hover` + the
 * `--shadow-focus` halo. The `active:translate-y-px` press is suppressed under
 * reduced motion (`motion-reduce:`), matching the `<Button>` primitive.
 */
const ctaClasses =
  'inline-flex w-auto items-center justify-center gap-2 rounded-md px-6 text-base font-semibold ' +
  'min-h-11 bg-brand text-brand-foreground hover:bg-brand-hover transition-colors outline-none ' +
  'focus-visible:[box-shadow:var(--shadow-focus)] ' +
  'active:translate-y-px motion-reduce:active:translate-y-0 motion-reduce:transition-none';

export function CtaLink({ children, className, withArrow = true, ...props }: CtaLinkProps) {
  return (
    <Link className={`${ctaClasses}${className ? ` ${className}` : ''}`} {...props}>
      {children}
      {withArrow ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
    </Link>
  );
}
