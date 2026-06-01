'use client';

/**
 * CharCounter primitive (04-UI-SPEC §6) — the Zod-max-driven character counter.
 *
 * A 13px Caption (the `field-error.tsx` caption idiom) with tabular numerals (the
 * `tnum` font-feature is already global on `body`), formatted `{n}/{max}` (e.g.
 * `412/2000`). Color tracks the budget through three chrome tokens — never an
 * inline hex (SHARED-E):
 *   - under budget        → `--color-muted-foreground` (text-muted-foreground)
 *   - last 10% of the max → `--color-warning`          (text-warning)
 *   - at / over the max   → `--color-destructive`      (text-destructive)
 *
 * `aria-live` is OFF by default (the counter would be far too chatty): the field's
 * `<FieldError>` (which carries `role="alert"`) announces an over-limit instead.
 *
 * The `max` is the field's Zod `.max(...)` bound — passed by the CONSUMER straight
 * from the schema (e.g. `about.bio` 2000, `display_name` 100, `heading` 100), so
 * there are no magic numbers here (04-UI-SPEC field→max table). The counter is a
 * pure display of `value.length` against `max`.
 */

export interface CharCounterProps {
  /** The current field value (its length is counted). */
  value: string;
  /** The Zod `.max(...)` bound for the field — passed by the consumer. */
  max: number;
  /** Optional extra classes (e.g. layout). */
  className?: string;
}

/** The fraction of `max` at which the counter shifts to the warning token. */
const WARNING_THRESHOLD = 0.9;

export function CharCounter({ value, max, className }: CharCounterProps) {
  const count = value.length;

  const colorToken =
    count >= max
      ? 'text-destructive'
      : count >= Math.floor(max * WARNING_THRESHOLD)
        ? 'text-warning'
        : 'text-muted-foreground';

  return (
    <span className={`text-[13px] leading-tight tabular-nums ${colorToken}${className ? ` ${className}` : ''}`}>
      {count}/{max}
    </span>
  );
}
