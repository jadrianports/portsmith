import { create } from 'zustand';

/**
 * Ephemeral UI state ONLY (repo-root CLAUDE.md "TanStack Query v5 + Zustand").
 *
 * Zustand holds editor/UI flags that never persist and are never the source of
 * truth for anything stored in the database. Server data (portfolio, sections,
 * items) lives exclusively in TanStack Query — NEVER mirror it here, or you
 * reintroduce the cache-sync bug TanStack Query exists to kill.
 *
 * This is a Phase-1 stub. Real editor UI state (active section, drag state, panel
 * layout) is added when the CMS dashboard lands (P4). Do NOT persist this to
 * localStorage — UI state is intentionally ephemeral (handoff convention).
 */
interface UIState {
  /** Whether the section editor panel is open. */
  editorOpen: boolean;
  /** Whether there are unsaved edits in the open editor. */
  dirty: boolean;
  setEditorOpen: (open: boolean) => void;
  setDirty: (dirty: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  editorOpen: false,
  dirty: false,
  setEditorOpen: (open) => set({ editorOpen: open }),
  setDirty: (dirty) => set({ dirty }),
}));
