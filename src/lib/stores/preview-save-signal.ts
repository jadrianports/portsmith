import { create } from 'zustand';

/**
 * The reflect-on-save bridge signal (Phase 27 — EDIT-03 / D-04 / D-14).
 *
 * A TINY, DEDICATED UI-only Zustand store — intentionally SEPARATE from `uiStore`
 * (whose header `uiStore.ts:3-17` forbids adding extra state: it owns ONLY
 * `activeSectionId`/`dirty`/`dragState`/`checklistOpen`). The live-preview pane needs
 * to know "a structured save just resolved `{ ok: true }` for section type X" so it can
 * (a) bump the iframe reload nonce → the iframe re-fetches the freshly `revalidatePath`'d
 * draft, and (b) record X as the D-14 post-reload scroll target. Threading a callback
 * prop through all five form islands (SectionForm / ContactSocialsForm / ProfileForm /
 * BlogPreviewForm / item managers) would be invasive; this one-action signal store lets
 * each form fire `notifySaved(type)` on its success branch with no prop plumbing
 * (RESEARCH Pattern 5 / OQ-2 A6 — the "notifySaved signal" path).
 *
 * UI-ONLY, NOT SERVER DATA (CLAUDE.md state-split): this holds ONLY an ephemeral
 * monotonically-increasing `nonce` + the last-saved `sectionType`. It NEVER mirrors
 * section/profile content (that stays in TanStack Query). The `nonce` makes every save a
 * distinct signal even when the SAME section is saved twice in a row (the value changes,
 * so the editor's subscribing effect always re-fires). The preview is the ONLY subscriber;
 * the draft route's own server read remains the single data path for the rendered HTML
 * (D-04 "no second data path").
 */
interface PreviewSaveSignalState {
  /** Monotonic save counter — bumps on EVERY `{ ok: true }` so repeated saves still fire. */
  nonce: number;
  /**
   * The soft-enum `type` of the most-recently-saved section (e.g. `'hero'`), or a sentinel
   * region tag, or `null` when a save has no meaningful preview anchor. Drives the D-14
   * post-reload re-scroll.
   */
  sectionType: string | null;
  /** A form island calls this on its resolved `{ ok: true }` branch. */
  notifySaved: (sectionType: string | null) => void;
}

export const usePreviewSaveSignal = create<PreviewSaveSignalState>((set) => ({
  nonce: 0,
  sectionType: null,
  notifySaved: (sectionType) => set((s) => ({ nonce: s.nonce + 1, sectionType })),
}));

/**
 * The non-hook accessor for `notifySaved` — for form islands that want to fire the signal
 * from an async callback WITHOUT subscribing to the store (no re-render on save). Reads the
 * live action off the store state, mirroring the `flushAllActiveSaves` non-subscription idiom.
 */
export function notifyPreviewSaved(sectionType: string | null): void {
  usePreviewSaveSignal.getState().notifySaved(sectionType);
}
