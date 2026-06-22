'use client';

/**
 * FormPanelHeader (04-UI-SPEC §4) — the Save home, sticky at the panel top.
 *
 * Anatomy, left → right: the section TITLE (16/600 — Body weight-shifted to
 * Semibold, an allowed weight, NOT a 5th type role) · the DIRTY indicator ·
 * spacer · the SAVE button.
 *
 * The dirty indicator is a Caption "● Unsaved changes" in `--color-warning` with
 * a small `--radius-full` warning dot — it appears ONLY when the panel is dirty
 * and disappears on a successful save (quiet, not nagging; color-independent —
 * the dot + the word both carry the state). Announced politely (`aria-live`).
 *
 * Sticky to the top of the panel scroll so Save is always reachable on a long
 * form — Save proximity is part of the "saves go live" trust contract. Token-
 * driven chrome only (SHARED-E).
 */
import { type SaveState, SaveButton } from './save-button';

export interface FormPanelHeaderProps {
  /** The active section's title (e.g. "Hero", "About", "Contact"). */
  title: string;
  /** Whether the panel has unsaved edits (drives the dirty indicator). */
  dirty: boolean;
  /** The current save lifecycle state for the SaveButton. */
  saveState: SaveState;
  onSave?: () => void;
}

export function FormPanelHeader({ title, dirty, saveState, onSave }: FormPanelHeaderProps) {
  return (
    // 33-06 (UX-05 / D-16 form-panel polish): a touch more vertical weight (`pb-4`)
    // and a backdrop blur on the sticky header so a long scrolled form reads cleanly
    // UNDER the always-reachable Save row, sharpening the panel's visual hierarchy.
    // Chrome tokens only (Inter + Evergreen/Copper). The Save-proximity trust contract
    // and the `sticky`/`z-10`/dirty-indicator semantics are unchanged.
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/95 pb-4 pt-3 backdrop-blur-sm">
      <h2 className="text-[17px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
        {title}
      </h2>

      {dirty ? (
        // 33-06: the dirty indicator reads as a quiet chip (a soft `bg-surface-muted`
        // pill in the warning tone) so "Unsaved changes" registers at a glance without
        // nagging — color-independent (the dot + the word both carry the state). There
        // is no `--color-warning-bg` chrome token, so the neutral muted surface is the
        // sanctioned tint here (the warning hue lives in the text + dot).
        <span
          aria-live="polite"
          className="flex items-center gap-1.5 rounded-full bg-surface-muted px-2 py-0.5 text-[13px] leading-tight font-semibold text-warning"
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
          <span>Unsaved changes</span>
        </span>
      ) : null}

      <div className="ml-auto">
        <SaveButton state={saveState} onSave={onSave} />
      </div>
    </div>
  );
}
