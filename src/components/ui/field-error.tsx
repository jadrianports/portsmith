/**
 * FieldError primitive (02-UI-SPEC "Field error / inline alert").
 *
 * A live, per-field error caption: 13px destructive text with a leading
 * `circle-alert` glyph and `role="alert"` so screen readers announce the
 * validation failure. Color is never the sole signal — the glyph + text carry
 * the meaning too (UI-SPEC color-independence contract).
 *
 * Presentational RSC. The `id` is wired by the parent to the input via
 * `aria-describedby`; render nothing when there is no message.
 */
import { CircleAlert } from 'lucide-react';

export interface FieldErrorProps {
  id?: string;
  children?: React.ReactNode;
}

export function FieldError({ id, children }: FieldErrorProps) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className="mt-1 flex items-center gap-1.5 text-[13px] leading-tight text-destructive"
    >
      <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
