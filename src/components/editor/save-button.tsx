'use client';

/**
 * SaveButton (04-UI-SPEC §5) — the "saves go live" beat. Extends Button(primary).
 *
 * The most trust-critical control in the editor. Its label + behavior encode the
 * live-in-seconds promise (D-P4-01), running through the UI-SPEC §5 state table:
 *
 *   - Idle (clean)  → "Saved", `--color-muted-foreground`, DISABLED (nothing to
 *                     save; "you're up to date").
 *   - Dirty (ready) → "Save changes", brand fill, enabled (the active CTA).
 *   - Saving        → spinner + "Saving…", `aria-busy`, disabled, width preserved
 *                     (reuses Button's loading spinner).
 *   - Saved & live  → the SUCCESS BEAT: a `circle-check` (`--color-accent` glyph,
 *                     sanctioned accent use #3) + the load-bearing Caption
 *                     "Saved — your page is live" in `--color-success` on a brief
 *                     `--color-success-bg` wash; settles back to Idle after ~2.2s.
 *   - Error         → returns to "Save changes" (the parent renders the error
 *                     Alert; this button just re-enables for retry).
 *
 * "your page is live" (not "Saved successfully") is the LOAD-BEARING copy — it
 * tells a non-technical user the public internet just changed (UI-SPEC line 402).
 *
 * Motion: the success wash + morph honor `prefers-reduced-motion` — under
 * reduced motion the beat degrades to the STATIC caption + glyph (no wash, no
 * transition), state/color/copy preserved (UI-SPEC Motion "saved & live").
 *
 * This is presentational state: the PARENT (SectionForm) owns the save lifecycle
 * (dirty → saving → ok/error) and passes the current `state` down. The content
 * Save is NOT optimistic — `saving` holds until the server action resolves.
 */
import { CircleCheck, LoaderCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';

/** The SaveButton lifecycle state, owned by the parent form island. */
export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved';

export interface SaveButtonProps {
  state: SaveState;
  /** Submit handler — wired to the form's onSubmit, so `type="submit"`. */
  onSave?: () => void;
}

export function SaveButton({ state, onSave }: SaveButtonProps) {
  // The saved-&-live success beat. The accent glyph + success caption carry the
  // load-bearing "your page is live" message; the wash is decorative + reduced-
  // motion-suppressed.
  if (state === 'saved') {
    return (
      <span
        aria-live="polite"
        className={
          'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 ' +
          'bg-success-bg text-[13px] font-semibold leading-tight text-success ' +
          'transition-colors motion-reduce:transition-none'
        }
      >
        <CircleCheck aria-hidden="true" className="size-4 text-accent" />
        <span>Saved — your page is live</span>
      </span>
    );
  }

  if (state === 'saving') {
    // The content Save is NOT optimistic: "Saving…" holds until the action
    // resolves (UI-SPEC: never claim "live" before the revalidate fires). We
    // render the spinner + the SPECIFIC "Saving…" copy (Button's built-in
    // loading label is the generic "Submitting…").
    return (
      <Button type="submit" disabled aria-busy className="w-auto">
        <LoaderCircle
          aria-hidden="true"
          className="size-4 animate-spin motion-reduce:animate-none"
        />
        <span>Saving…</span>
      </Button>
    );
  }

  if (state === 'idle') {
    // Clean: nothing to save. Disabled, muted — "you're up to date".
    return (
      <Button type="submit" variant="ghost" disabled className="w-auto text-muted-foreground">
        Saved
      </Button>
    );
  }

  // Dirty (ready): the active CTA.
  return (
    <Button type="submit" onClick={onSave} className="w-auto">
      Save changes
    </Button>
  );
}
