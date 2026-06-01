'use client';

/**
 * Input primitive (02-UI-SPEC "Input (text / email / password)").
 *
 * Client component because the password variant owns a show/hide toggle
 * (`useState`). Renders a real <label for> above the field (never
 * placeholder-as-label), a 44px-tall input (16px body text — prevents the iOS
 * zoom-on-focus), and a helper/error caption below.
 *
 *  - Focus: border → border-strong + a 2px accent ring at 2px offset (real
 *    `outline`, for high-contrast-mode support).
 *  - Error: border → destructive, `aria-invalid`, error wired via
 *    `aria-describedby`, inline `circle-alert` glyph in the caption (FieldError).
 *  - Password (`type="password"`): trailing icon-only show/hide toggle (lucide
 *    `eye`/`eye-off`), 44px touch target, `aria-label` + `aria-pressed`,
 *    keyboard-operable, and it never covers the focus ring.
 *
 * `autoComplete` is REQUIRED by the caller (email → `email`/`username`,
 * password → `current-password` | `new-password`) so password managers prefill
 * for the non-technical audience.
 */
import { Eye, EyeOff } from 'lucide-react';
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { FieldError } from './field-error';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: ReactNode;
  /** Inline error message (also drives the destructive border + aria-invalid). */
  error?: string;
  /** Non-error helper caption shown below the field when there is no error. */
  helper?: ReactNode;
  /** Optional explicit id; auto-generated (stable) otherwise. */
  id?: string;
}

export function Input({
  label,
  error,
  helper,
  id: idProp,
  type = 'text',
  className,
  ...props
}: InputProps) {
  const reactId = useId();
  const id = idProp ?? reactId;
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helper && !error ? `${id}-helper` : undefined;

  const isPassword = type === 'password';
  const [revealed, setRevealed] = useState(false);
  const effectiveType = isPassword && revealed ? 'text' : type;

  const fieldBase =
    'h-11 w-full rounded-sm border bg-surface px-3 text-base text-foreground ' +
    'placeholder:text-muted-foreground outline-none transition-colors ' +
    'focus-visible:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'focus-visible:outline-ring disabled:bg-surface-muted disabled:text-muted-foreground';
  const borderState = error ? 'border-destructive' : 'border-border';

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-foreground">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={effectiveType}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId ?? helperId}
          className={`${fieldBase} ${borderState}${isPassword ? ' pr-12' : ''}`}
          {...props}
        />

        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className={
              'absolute inset-y-0 right-0 flex w-11 items-center justify-center ' +
              'text-muted-foreground outline-none hover:text-foreground ' +
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
            }
          >
            {revealed ? (
              <EyeOff aria-hidden="true" className="size-5" />
            ) : (
              <Eye aria-hidden="true" className="size-5" />
            )}
          </button>
        ) : null}
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
