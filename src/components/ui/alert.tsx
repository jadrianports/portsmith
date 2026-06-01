/**
 * Alert banner primitive (02-UI-SPEC "Field error / inline alert" — banner).
 *
 * A full-width panel at the top of the auth card for form-level messages:
 *  - `error`   — failed confirm (`?error=auth`), generic login failure
 *                (destructive-bg tint, destructive text).
 *  - `success` — "email sent" confirmations (success-bg tint, success text).
 *  - `warning` — the provisional-legal note, the unconfirmed-account prompt
 *                (warning text on surface-muted).
 *
 * `role="alert"` so the message is announced; submit failures move focus here
 * (the parent assigns a ref/tabIndex). Color is paired with a leading glyph so
 * the state is never color-only. Presentational RSC.
 */
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';

type AlertVariant = 'error' | 'success' | 'warning';

export interface AlertProps {
  variant?: AlertVariant;
  children: React.ReactNode;
  className?: string;
}

const variants: Record<AlertVariant, { panel: string; Icon: typeof CircleAlert }> = {
  error: { panel: 'bg-destructive-bg text-destructive', Icon: CircleAlert },
  success: { panel: 'bg-success-bg text-success', Icon: CircleCheck },
  warning: { panel: 'bg-surface-muted text-warning', Icon: TriangleAlert },
};

export function Alert({ variant = 'error', children, className }: AlertProps) {
  const { panel, Icon } = variants[variant];
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-md p-4 text-sm ${panel}${className ? ` ${className}` : ''}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
