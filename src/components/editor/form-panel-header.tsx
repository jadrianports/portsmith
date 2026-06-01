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
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface py-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>

      {dirty ? (
        <span
          aria-live="polite"
          className="flex items-center gap-1.5 text-[13px] leading-tight text-warning"
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
