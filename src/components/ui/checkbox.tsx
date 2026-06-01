/**
 * Checkbox primitive — the ToS-acceptance control (02-UI-SPEC "Checkbox", D-09).
 *
 * A native <input type="checkbox"> (20px box, radius-sm, brand checked fill via
 * `accent-brand`) inside a 44px clickable <label> row. The label carries the
 * inline legal link, which is independently keyboard-focusable (it sits OUTSIDE
 * the control's hit target as a real anchor). Unchecked submit surfaces the
 * error caption "You must accept the Terms to continue" (mirroring the Zod
 * `tos_accepted` message), wired via `aria-describedby` + `aria-invalid`.
 *
 * Presentational and controlled by the parent form island (the native control
 * needs no client JS itself), so this stays RSC-compatible. Color-independence:
 * the error is text + glyph (FieldError), not color alone.
 */
import type { InputHTMLAttributes, ReactNode } from 'react';
import { FieldError } from './field-error';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  id: string;
  label: ReactNode;
  error?: string;
}

export function Checkbox({ id, label, error, className, ...props }: CheckboxProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-foreground"
      >
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={
            'size-5 shrink-0 rounded-sm border-2 border-border accent-brand outline-none ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
            (error ? 'border-destructive' : '')
          }
          {...props}
        />
        <span>{label}</span>
      </label>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}
