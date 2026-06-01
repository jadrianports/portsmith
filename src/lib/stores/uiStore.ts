import { create } from 'zustand';

/**
 * Ephemeral UI state ONLY (repo-root CLAUDE.md "TanStack Query v5 + Zustand").
 *
 * Zustand holds editor/UI flags that never persist and are never the source of
 * truth for anything stored in the database. Server data (portfolio, sections,
 * items) lives exclusively in TanStack Query — NEVER mirror it here, or you
 * reintroduce the cache-sync bug TanStack Query exists to kill.
 *
 * P4 editor extension (this change): adds the editor's UI-ONLY surface — which
 * section is active in the form panel, the current drag phase, and whether the
 * completeness panel is open. These are ephemeral interaction flags, NOT data.
 * Do NOT persist this to localStorage — UI state is intentionally ephemeral
 * (handoff convention). Do NOT add section/profile/item CONTENT here (the
 * no-server-data rule above) — that belongs to TanStack Query via `cmsKeys`.
 */

/** Coarse drag phase for the dnd-kit sortable lists (sections + work items). */
export type DragState = 'idle' | 'dragging';

interface UIState {
  /** Whether the section editor panel is open. */
  editorOpen: boolean;
  /** Whether there are unsaved edits in the open editor (drives the CMS-07 guard). */
  dirty: boolean;
  /**
   * The id of the section currently selected into the form panel (D-P4-04
   * "list selects into one form"; panel state, not a route). `null` = no
   * section selected. This is the SECTION ROW id (UI selection), never section
   * content — content stays in TanStack Query.
   */
  activeSectionId: string | null;
  /** Current dnd-kit drag phase, for cursor/overlay affordances during reorder. */
  dragState: DragState;
  /** Whether the advisory completeness checklist panel is expanded (ONB-01). */
  checklistOpen: boolean;
  setEditorOpen: (open: boolean) => void;
  setDirty: (dirty: boolean) => void;
  setActiveSectionId: (id: string | null) => void;
  setDragState: (state: DragState) => void;
  setChecklistOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  editorOpen: false,
  dirty: false,
  activeSectionId: null,
  dragState: 'idle',
  checklistOpen: false,
  setEditorOpen: (open) => set({ editorOpen: open }),
  setDirty: (dirty) => set({ dirty }),
  setActiveSectionId: (id) => set({ activeSectionId: id }),
  setDragState: (state) => set({ dragState: state }),
  setChecklistOpen: (open) => set({ checklistOpen: open }),
}));
