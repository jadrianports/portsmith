'use client';

/**
 * SegmentedControl (04-UI-SPEC §7, CMS-04 / D-P4-06) — the closed-enum picker.
 *
 * For SMALL CLOSED enums only (≤3 options): the skill tier `Core / Proficient /
 * Learning` and the portfolio `theme_mode` default `Light / Dark`. NOT for
 * soft-enum / open growth (use the native `<select>` for those) — a closed,
 * fixed set is the whole reason a segmented control is appropriate here.
 *
 * A `role="radiogroup"` of pill segments inside a `--color-surface-muted` track
 * (`--radius-md`). The SELECTED segment is a FILLED `--color-surface` raised pill
 * with `--color-foreground` semibold Label text (color-INDEPENDENT: it is raised +
 * bold, never color-only — so it reads in high-contrast / monochrome too). 44px
 * row on touch.
 *
 * KEYBOARD a11y (the radiogroup pattern): Tab moves focus INTO the group (the
 * selected, or first, segment is the single tab stop via roving `tabIndex`);
 * ArrowLeft/Up + ArrowRight/Down move the selection (and focus) between segments;
 * Home/End jump to the first/last. The focus ring sits on the focused segment.
 *
 * Token-driven chrome only (SHARED-E): zero inline hex, zero template-token reach.
 * Reduced-motion-safe.
 *
 * Source: the radiogroup-ish a11y + 44px-hit + focus-ring idiom from
 * `ui/checkbox.tsx`; the token composition from the 02-UI-SPEC chrome system. The
 * theme_mode default value is persisted by the settings write path — this control
 * is a CONTROLLED component (`value` + `onChange`), so the editor shell wires it
 * to the settings save (a thin reuse of the SHARED-A action skeleton).
 */
import { useId, useRef, type ReactNode } from 'react';

/** One selectable segment: a stable value + the visible Label. */
export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  /** The group's accessible name (a `<label>`-style heading above the track). */
  label: ReactNode;
  /** The closed set of options (≤3). */
  options: SegmentOption<T>[];
  /** The currently-selected value (controlled). */
  value: T;
  /** Change handler — receives the newly-selected value. */
  onChange: (value: T) => void;
  /** Optional explicit id base; auto-generated otherwise. */
  id?: string;
  /** Disables the whole group. */
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  id: idProp,
  disabled,
}: SegmentedControlProps<T>) {
  const reactId = useId();
  const id = idProp ?? reactId;
  const labelId = `${id}-label`;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  /** Move selection + focus to a new index (wrapping), then fire onChange. */
  function move(toIndex: number) {
    const len = options.length;
    const next = ((toIndex % len) + len) % len; // wrap both directions
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        move(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        move(index - 1);
        break;
      case 'Home':
        e.preventDefault();
        move(0);
        break;
      case 'End':
        e.preventDefault();
        move(options.length - 1);
        break;
    }
  }

  return (
    <div>
      <span
        id={labelId}
        className="mb-2 block text-sm font-semibold text-foreground"
      >
        {label}
      </span>

      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={
          'inline-flex min-h-11 items-center gap-1 rounded-md bg-surface-muted p-1 ' +
          (disabled ? 'opacity-60' : '')
        }
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              // Roving tabindex: only the selected (or first) segment is tabbable.
              tabIndex={index === selectedIndex ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={
                'min-h-9 rounded-sm px-3 text-sm outline-none transition-colors ' +
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
                'motion-reduce:transition-none ' +
                (selected
                  ? // SELECTED: raised filled surface pill + semibold (color-independent).
                    'bg-surface font-semibold text-foreground shadow-card'
                  : 'bg-transparent font-normal text-muted-foreground hover:text-foreground')
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
