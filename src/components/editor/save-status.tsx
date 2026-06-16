'use client';

/**
 * SaveStatus (17-UI-SPEC Surface 4 / D-04 / D-05) — the ONE unified save-status
 * vocabulary, rendered per-section near the active form, IDENTICAL across BOTH
 * shipped save models so a non-technical user never perceives the difference
 * between the explicit-Save simple forms and the debounced auto-save managers.
 *
 * WHY THIS EXISTS (the D-04/D-05 asymmetry it closes):
 *   - The EXPLICIT model (`section-form.tsx` → `form-panel-header.tsx`) ALREADY
 *     renders the warning-dot "Unsaved changes" idiom + the "Saved — your page is
 *     live" beat (via the SaveButton).
 *   - The AUTO-SAVE managers (`item-card.tsx` / `skills-nested-manager.tsx` /
 *     `moodboard-manager.tsx`) rendered ONLY an error `Alert` — no visible
 *     unified status line, and the dopamine beat never fired in that model.
 *   This presentational island maps the SHIPPED `DebouncedSaveState` enum
 *   (`use-debounced-section-save.ts:229`) to the exact UI-SPEC Surface 4 words so
 *   the auto-save managers now read identically to the explicit model — the beat
 *   included. It is NOT a new state machine; the enum + the never-claim-live-early
 *   beat (`onSavedAndLive`, fired only on the latest `{ ok: true }`) already exist
 *   and are owned by the hook. The CONSUMER wires the beat (it holds the ~2.2s
 *   `live` window after `onSavedAndLive` fires); this renderer only draws it.
 *
 * THE EXACT STATE → GLYPH → WORD → TOKEN TABLE (UI-SPEC Surface 4, verbatim):
 *   pending  → a `--radius-full` warning dot     · "Unsaved changes"            · --color-warning
 *   saving   → `loader-circle` spinner (aria-busy)· "Saving…"                    · --color-muted-foreground
 *   saved    → (settles to none)                 · "Saved"                       · --color-muted-foreground
 *   BEAT     → `circle-check` (--color-accent)   · "Saved — your page is live"   · --color-success on a brief
 *              (the `live` prop window)             --color-success-bg wash, settling ~2.2s
 *   error    → (the inherited save-error Alert in the manager — NOT drawn here)  · --color-destructive
 *   idle     → (nothing — the resting blank state)
 *
 * COLOR-INDEPENDENCE (UI-SPEC hard rule): EVERY state carries a glyph AND the WORD
 * — so the status survives a colorblind / high-contrast read (never color alone).
 * Announced politely: the whole line is `aria-live="polite"` so a screen-reader
 * user hears "Saving…" → "Saved — your page is live".
 *
 * REDUCED MOTION (UI-SPEC): under `prefers-reduced-motion` the saved-&-live wash +
 * the spinner animation drop to a static state change — the caption + glyph still
 * appear (the `motion-reduce:*` utilities suppress the animation/transition only).
 *
 * Two-layer identity (SHARED-E) — chrome `--color-*` tokens ONLY (the saved-&-live
 * beat uses the `--color-accent` glyph + `--color-success` word on the
 * `--color-success-bg` wash; the unsaved dot is `--color-warning`); zero inline
 * hex, zero template-token reach. The `DebouncedSaveState` is imported as a TYPE
 * ONLY — this island imports NEITHER `@/lib/validations` NOR `templates/registry.ts`
 * (keeps Zod off the public First Load JS — D-25).
 */
import { CircleCheck, LoaderCircle } from 'lucide-react';

import type { DebouncedSaveState } from './use-debounced-section-save';

export interface SaveStatusProps {
  /** The hook's current save lifecycle state (the SHIPPED enum — mapped, not rebuilt). */
  state: DebouncedSaveState;
  /**
   * Whether the saved-&-live BEAT window is active (the consumer holds this true for
   * ~2.2s after the hook's `onSavedAndLive` fires, then settles it back to false —
   * mirroring the SAVED_BEAT_MS settle the explicit model already uses). While true
   * the line reads "Saved — your page is live" (the dopamine beat) instead of the
   * resting "Saved". The beat fires ONLY on a resolved-ok save (never-claim-live-
   * early) — this renderer trusts the consumer's window, it does not own the timing.
   */
  live?: boolean;
  /**
   * D-09 (BLOG-03) — an OPTIONAL "last saved at" stamp the consumer sets when a save
   * resolves ok. When present (and the resting `saved` state is showing, not the live
   * beat) the line reads "Saved · HH:MM" so the save is unmistakably timestamped. A
   * Date or a pre-formatted string; omitted ⇒ the plain "Saved" resting line (every
   * existing consumer that passes neither prop is unchanged).
   */
  savedAt?: Date | string;
}

/** Format a savedAt value to a stable "HH:MM" (locale 24h-ish), or '' when absent. */
function formatSavedAt(savedAt: Date | string | undefined): string {
  if (!savedAt) return '';
  const d = typeof savedAt === 'string' ? new Date(savedAt) : savedAt;
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** The shared Caption-tier line shell (13/400, tight leading, polite live region). */
const LINE = 'flex items-center gap-1.5 text-[13px] leading-tight';

/**
 * The unified save-status line. Returns `null` for `idle` (the resting blank state)
 * and for `error` (the manager's inherited save-error `Alert` owns that surface —
 * UI-SPEC Surface 4: "error → the inherited save-error Alert copy"). The beat takes
 * precedence over the resting "Saved" whenever the `live` window is open.
 */
export function SaveStatus({ state, live = false, savedAt }: SaveStatusProps) {
  // D-04 / D-05 — the saved-&-live BEAT (the load-bearing "the public internet just
  // changed" moment for a non-technical user). It outranks the resting "Saved" while
  // the consumer's `live` window is open: circle-check (--color-accent glyph) + the
  // "Saved — your page is live" WORD (--color-success) on a brief --color-success-bg
  // wash that settles ~2.2s. Under reduced motion the wash is a static state change.
  if (live && (state === 'saved' || state === 'idle')) {
    return (
      <span
        aria-live="polite"
        className={
          `${LINE} rounded-sm bg-success-bg px-2 py-1 text-success ` +
          'transition-colors motion-reduce:transition-none'
        }
      >
        <CircleCheck aria-hidden="true" className="size-4 text-accent" />
        <span>Saved — your page is live</span>
      </span>
    );
  }

  switch (state) {
    // pending — the panel is dirty (a debounce is queued). Mirror the
    // form-panel-header.tsx:36-44 warning-dot idiom verbatim (the explicit model's
    // "Unsaved changes" line) so both models read identically.
    case 'pending':
      return (
        <span aria-live="polite" className={`${LINE} text-warning`}>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
          <span>Unsaved changes</span>
        </span>
      );

    // saving — the save is in flight. The loader-circle spins (aria-busy); under
    // reduced motion the spin is suppressed but the glyph + the WORD remain.
    case 'saving':
      return (
        <span aria-live="polite" aria-busy="true" className={`${LINE} text-muted-foreground`}>
          <LoaderCircle
            aria-hidden="true"
            className="size-4 animate-spin motion-reduce:animate-none"
          />
          <span>Saving…</span>
        </span>
      );

    // saved (resting) — "you're up to date" after a save resolved ok and the live
    // beat has settled (the beat itself is the `live` branch above).
    case 'saved': {
      // D-09: append a "· HH:MM" stamp when the consumer supplies `savedAt`, so the
      // resting saved line is unmistakably timestamped ("Saved · 14:32"). Without the
      // prop it stays the plain "Saved" line (unchanged for every prior consumer).
      const stamp = formatSavedAt(savedAt);
      return (
        <span aria-live="polite" className={`${LINE} text-muted-foreground`}>
          <CircleCheck aria-hidden="true" className="size-4" />
          <span>{stamp ? `Saved · ${stamp}` : 'Saved'}</span>
        </span>
      );
    }

    // idle (resting blank) + error (the manager's inherited Alert owns it) → nothing.
    case 'idle':
    case 'error':
    default:
      return null;
  }
}
