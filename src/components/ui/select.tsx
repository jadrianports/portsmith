'use client';

/**
 * Select primitive (04-UI-SPEC §7) — a native `<select>` styled to match Input.
 *
 * Reuses the same label + focus-ring + border-state contract as `input.tsx`
 * (real `<label htmlFor>`, 2px `--color-ring` outline at 2px offset, destructive
 * border on error, `aria-invalid`/`aria-describedby`, `<FieldError>` below) so a
 * select reads as a sibling of the text fields. A `chevron-down` (lucide)
 * adornment marks it as a menu; the native element keeps keyboard + screen-reader
 * behavior for free.
 *
 * Provided for soft-enum growth (CMS-08) — no LONGER enum is required this phase
 * beyond the two segmented controls, but the primitive exists for future types.
 * Token-driven chrome only — zero inline hex, zero template-token reach
 * (SHARED-E, two-layer identity).
 */
import { ChevronDown } from 'lucide-react';
import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';

import { FieldError } from './field-error';

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: ReactNode;
  /** Inline error message (also drives the destructive border + aria-invalid). */
  error?: string;
  /** Non-error helper caption shown below the field when there is no error. */
  helper?: ReactNode;
  /** Optional explicit id; auto-generated (stable) otherwise. */
  id?: string;
  children: ReactNode;
}

export function Select({
  label,
  error,
  helper,
  id: idProp,
  className,
  children,
  ...props
}: SelectProps) {
  const reactId = useId();
  const id = idProp ?? reactId;
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helper && !error ? `${id}-helper` : undefined;

  // Mirrors input.tsx:55-60 (fixed `h-11`); `pr-10` leaves room for the chevron;
  // `appearance-none` hides the native arrow so the lucide glyph is the only one.
  const fieldBase =
    'h-11 w-full appearance-none rounded-sm border bg-surface pl-3 pr-10 text-base text-foreground ' +
    'outline-none transition-colors ' +
    'focus-visible:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'focus-visible:outline-ring disabled:bg-surface-muted disabled:text-muted-foreground';
  const borderState = error ? 'border-destructive' : 'border-border';

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-foreground">
        {label}
      </label>

      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId ?? helperId}
          className={`${fieldBase} ${borderState}`}
          {...props}
        >
          {children}
        </select>

        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground"
        />
      </div>

      {error ? (
        <FieldError id={errorId}>{error}</FieldError>
      ) : helper ? (
        <p id={helperId} className="mt-1 text-[13px] leading-tight text-muted-foreground">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
