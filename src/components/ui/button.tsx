/**
 * Button primitive (02-UI-SPEC "Button").
 *
 * Two variants, both token-driven (no inline hex):
 *  - `primary`  — brand-evergreen fill, brand-foreground text, 44px min-height
 *                 (the WCAG 2.5.5 touch target), radius-md, full-width inside the
 *                 auth card. Hover → brand-hover. Focus-visible → accent halo
 *                 (`--shadow-focus`; the FILL stays brand, the halo is the only
 *                 accent use here). One primary per screen.
 *  - `ghost`    — transparent, border hairline, foreground text; non-primary
 *                 actions on an interstitial (e.g. "Back to login").
 *
 * Presentational (no `'use client'`): renders a native <button>, so it composes
 * inside client form islands or stays in an RSC. The `loading` state swaps the
 * label for a spinner + accessible "Submitting…" copy, keeps the button width,
 * sets `aria-busy`, and disables interaction. Reduced-motion is honored by the
 * spinner (animate-spin is suppressed under prefers-reduced-motion via the
 * `motion-reduce:` variant).
 */
import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const base =
  'inline-flex w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold ' +
  'min-h-11 transition-colors outline-none ' +
  'focus-visible:[box-shadow:var(--shadow-focus)] ' +
  'active:translate-y-px motion-reduce:active:translate-y-0 motion-reduce:transition-none ' +
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted-foreground disabled:shadow-none';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-foreground hover:bg-brand-hover',
  ghost: 'border border-border bg-transparent text-foreground hover:bg-surface-muted',
};

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${variants[variant]}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {loading ? (
        <>
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          <span>Submitting…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
