'use client';

/**
 * ExampleChip (17-UI-SPEC Surface 1 / D-01) — the NEW chrome composite that marks
 * a SEEDED section block as "this is example DATA you can clear in one tap" and
 * resolves the original "is this mine or an example?" ambiguity the onboarding
 * todo flagged.
 *
 * A first-run account is bootstrapped (migration 006) with polished, real-LOOKING
 * placeholder content so the live draft preview reads filled (the "hard to make
 * ugly" wedge). The cost of that polish is ambiguity: a nervous first-timer cannot
 * tell the seed apart from their own publishable words. This chip is the quiet,
 * unmistakable "Example" affordance with a one-tap clear that removes the doubt.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ THE CALM MUTED/SURFACE-MUTED CHORD — NEVER ACCENT (UI-SPEC Surface 1 / Color):│
 * │ the chip is `--color-surface-muted` fill + `--color-muted-foreground` Caption │
 * │ (13/400) text + `--radius-sm`. Accent (copper) stays scarce (focus-ring /     │
 * │ link-hover / "available" only) — the chip is deliberately NOT a colored       │
 * │ "interactive = accent" signal. It joins the rail badge family tone (the muted │
 * │ "Hidden" / "Not shown on {Template}" tags, `section-list-row.tsx`).           │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * COLOR-INDEPENDENCE (UI-SPEC hard rule): the chip carries the WORD "Example"
 * (+ the `x` clear glyph), never color alone — so the state survives a colorblind /
 * high-contrast read.
 *
 * Anatomy: an inline tag reading "Example · tap to clear" (the middot is the
 * inherited separator idiom) with an inline `x` (lucide-react) clear control in a
 * 44px touch target (WCAG 2.5.5), `aria-label="Clear example content"`, the glyph
 * `aria-hidden`, and the chrome focus ring (`focus-visible:outline-2
 * focus-visible:-outline-offset-2 focus-visible:outline-ring`). On hover the `x`
 * brightens to `--color-foreground`. Clearing is non-destructive (safe + the user
 * can re-add) so there is NO confirm.
 *
 * The chip's PRESENCE is owned by the host (`section-form.tsx`): it renders the chip
 * IFF the block still holds untouched seed values — the moment any seeded field is
 * user-touched (or cleared), the host stops rendering the chip and it never returns
 * (the "chip vanishes on edit" load-bearing rule). This component is purely
 * presentational chrome — it holds no seeded-vs-touched state itself; `onClear` is
 * its only behavior.
 *
 * Token-driven chrome ONLY — zero inline hex, zero template-token reach (two-layer
 * identity). Imports NEITHER `@/lib/validations` NOR `registry.ts` (keeps Zod off
 * the public First Load JS — D-25).
 */
import { X } from 'lucide-react';

export interface ExampleChipProps {
  /**
   * Clear the seeded block: the host resets the block's fields to empty, removes
   * the chip (and the rail "Example" tag), moves focus to the first field, and
   * politely announces "Example content cleared". No confirm (clearing example
   * data is safe + re-addable).
   */
  onClear: () => void;
}

export function ExampleChip({ onClear }: ExampleChipProps) {
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-sm bg-surface-muted py-1 pl-2 ' +
        'text-[13px] leading-tight text-muted-foreground'
      }
    >
      {/* The WORD carries the state (color-independence) — "Example · tap to clear". */}
      <span>Example · tap to clear</span>

      {/* The one-tap clear: a 44px touch target (WCAG 2.5.5), the `x` glyph
          aria-hidden, the accessible name on the button, the chrome focus ring,
          and a hover brighten to --color-foreground. */}
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear example content"
        className={
          'flex size-11 items-center justify-center text-muted-foreground outline-none ' +
          'transition-colors hover:text-foreground focus-visible:outline-2 ' +
          'focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none'
        }
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </span>
  );
}
