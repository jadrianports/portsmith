/**
 * Link primitive (02-UI-SPEC "Link").
 *
 * Resting: foreground text, 1px underline at 3px offset. Hover/focus: color →
 * accent (one of the four sanctioned accent uses), underline thickens. Always a
 * visible focus-visible ring (accent, 2px outline at 2px offset) — never
 * `outline:none` without a replacement.
 *
 * Wraps `next/link` so internal routes (`/login`, `/legal`, …) get client
 * navigation; external `href`s pass through. Presentational RSC.
 */
import NextLink from 'next/link';
import type { ComponentProps } from 'react';

export type LinkProps = ComponentProps<typeof NextLink>;

export function Link({ className, children, ...props }: LinkProps) {
  return (
    <NextLink
      className={
        'rounded-sm font-semibold text-foreground underline decoration-1 underline-offset-[3px] ' +
        'outline-none transition-colors hover:text-accent hover:decoration-2 ' +
        'focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 ' +
        'focus-visible:outline-ring' +
        (className ? ` ${className}` : '')
      }
      {...props}
    >
      {children}
    </NextLink>
  );
}
