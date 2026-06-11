'use client';

/**
 * Textarea primitive (04-UI-SPEC §1) — the multi-line variant of Input.
 *
 * Reuses the EXACT field-base + border-state token strings from `input.tsx`
 * (focus model, disabled fill, error border) so a textarea and an input read
 * identically; the only delta is a 3-line `min-h` + vertical resize instead of
 * the input's fixed `h-11`. Renders a real `<label htmlFor>` above (never
 * placeholder-as-label), wires `aria-invalid`/`aria-describedby`, and renders a
 * `<FieldError>` below — matching Input's accessibility contract verbatim.
 *
 * Pairs with `<CharCounter>` bottom-right, driven by the field's Zod `max`
 * (04-UI-SPEC §6). Token-driven chrome only — zero inline hex, zero
 * template-token reach (SHARED-E, two-layer identity).
 */
import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react';

import { FieldError } from './field-error';

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: ReactNode;
  /** Inline error message (also drives the destructive border + aria-invalid). */
  error?: string;
  /** Non-error helper caption shown below the field when there is no error. */
  helper?: ReactNode;
  /** Optional explicit id; auto-generated (stable) otherwise. */
  id?: string;
  /**
   * Optional trailing affordance rendered under the field (right-aligned) — the
   * CharCounter lives here so it sits bottom-right of the textarea.
   */
  trailing?: ReactNode;
  /**
   * Optional ref to the underlying `<textarea>` (React 19 ref-as-prop). Lets a
   * caller move focus to the field — e.g. the D-01 ExampleChip clear focusing the
   * first field after a one-tap clear.
   */
  ref?: React.Ref<HTMLTextAreaElement>;
}

export function Textarea({
  label,
  error,
  helper,
  id: idProp,
  className,
  trailing,
  rows = 3,
  ref,
  ...props
}: TextareaProps) {
  const reactId = useId();
  const id = idProp ?? reactId;
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helper && !error ? `${id}-helper` : undefined;

  // Identical to input.tsx:55-60, minus the fixed `h-11` (textareas grow).
  const fieldBase =
    'min-h-[5.5rem] w-full resize-y rounded-sm border bg-surface px-3 py-2 text-base text-foreground ' +
    'placeholder:text-muted-foreground outline-none transition-colors ' +
    'focus-visible:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'focus-visible:outline-ring disabled:bg-surface-muted disabled:text-muted-foreground';
  const borderState = error ? 'border-destructive' : 'border-border';

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-foreground">
        {label}
      </label>

      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? helperId}
        className={`${fieldBase} ${borderState}`}
        {...props}
      />

      {/* Counter / trailing affordance row (bottom-right). */}
      {trailing ? <div className="mt-1 flex justify-end">{trailing}</div> : null}

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
