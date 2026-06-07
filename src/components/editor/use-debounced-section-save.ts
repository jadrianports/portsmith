'use client';

/**
 * useDebouncedSectionSave (13.1-03 / D-20 — folds the 08-REVIEW WR-04
 * `save-section-debounce` todo) — the SHARED trailing-debounce + monotonic
 * sequence-token + skip-invalid save hook every per-type form consumes.
 *
 * THE PROBLEM IT SOLVES (RESEARCH Pattern 4 + Pitfalls 7/8):
 *   1. COALESCING — a keystroke burst (one save per keystroke) would storm the
 *      server with doomed/superseded writes. A ~500ms TRAILING debounce coalesces
 *      a burst into ONE `saveSectionAction` flush, carrying the LAST content.
 *   2. OUT-OF-ORDER STALE-DROP (Pitfall 7) — a slow EARLIER flush resolving AFTER a
 *      newer one must NOT drive the visible saved/error state (it would claim a
 *      stale result). A monotonic `seq` token guards every resolution: only the
 *      LATEST flush's result is honored; an earlier (lower-seq) result is dropped.
 *   3. SKIP-INVALID (Pitfall 8) — a transient structurally-invalid snapshot (a
 *      freshly-added blank item, or an image set whose required alt is still empty)
 *      must fire NO network call and raise NO error (the "storm of doomed saves"
 *      seen in 05-05 UAT — mirrors `item-card.tsx:603-612`).
 *   4. NEVER CLAIM LIVE EARLY — the saved-&-live beat fires ONLY on the latest
 *      call's resolved `{ ok: true }` (UI-SPEC "optimistic UI honesty"); content
 *      saves are non-optimistic.
 *
 * add/remove/reorder are STRUCTURAL ops (not keystroke bursts) — they use the
 * `immediateSave` variant that bumps the seq then awaits at once (no timer).
 *
 * BUNDLE RULE (CLAUDE.md / D-25 — LOAD-BEARING): this `'use client'` island MUST
 * NOT import the `@/lib/validations` barrel or `templates/registry.ts` — both drag
 * Zod onto the public First Load JS bundle. The skip-invalid check here is a
 * LIGHTWEIGHT, Zod-FREE STRUCTURAL pre-check (required-field / required-alt
 * presence) mirroring the INTENT of `item-card.tsx`'s `validateSectionContent`
 * pre-check without the schema. The SERVER re-parse inside `saveSectionAction`
 * stays the authoritative gate — this only avoids POSTing a payload the server is
 * certain to reject.
 *
 * RENDER-FREE PURE HELPERS (the storage-meter / skills-form precedent): the three
 * testable decisions — coalescing (`createCoalescingSaver`), the sequence guard
 * (`isLatestSeq`), and the structural pre-check (`isSaveableSnapshot`) — are
 * exported as pure functions so the `node` vitest project asserts them WITHOUT a
 * DOM (no jsdom / @testing-library; tests/unit/editor/debounced-save.test.ts).
 *
 * Source: the debounce target + skip-invalid intent from `item-card.tsx:587-657`;
 * the result union + non-optimistic save from `save-section-action.ts`; the
 * pure-helper + bundle discipline from `skills-form.tsx`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  saveSectionAction,
  type SaveSectionInput,
  type SaveSectionResult,
} from '@/lib/cms/save-section-action';

/**
 * The trailing-debounce window (UX-only LITERAL, ~400-600ms per UI-SPEC Save Model).
 * A burst of edits inside this window coalesces into ONE flush. Not a schema bound —
 * a UX tuning constant, intentionally inline (no barrel import).
 */
export const SAVE_DEBOUNCE_MS = 500;

/* ──────────────────────────────────────────────────────────────────────────── *
 * PURE DECISION HELPERS (exported, render-free, node-unit-testable)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * createCoalescingSaver — the trailing-debounce primitive (D-20 coalescing).
 *
 * Returns a `scheduleSave(content)` that clears any pending timer and arms a fresh
 * `waitMs` trailing one; only when the window elapses since the LAST call does it
 * invoke `flush` ONCE, with the LAST content. A burst of N rapid calls inside the
 * window → exactly ONE `flush`. Pure `setTimeout` math — works in the `node` env
 * under vitest fake timers, no DOM.
 *
 * @param flush  the coalesced callback (runs once per settled burst).
 * @param waitMs the trailing window in ms.
 * @returns `scheduleSave(content)` — call it per keystroke; it coalesces.
 */
export function createCoalescingSaver<T>(
  flush: (content: T) => void,
  waitMs: number,
): (content: T) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: T;
  return (content: T): void => {
    pending = content;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      flush(pending);
    }, waitMs);
  };
}

/**
 * isLatestSeq — the monotonic out-of-order stale-result guard (Pitfall 7).
 *
 * A flush captures its own `mySeq` at dispatch; when it later resolves it is only
 * allowed to drive the visible state if it is STILL the latest (`mySeq === latest`).
 * A slow earlier flush (lower seq) resolving after a newer one returns false → its
 * result is dropped, so the UI never claims a stale saved/error state.
 */
export function isLatestSeq(mySeq: number, latestSeq: number): boolean {
  return mySeq === latestSeq;
}

/* ── Skip-invalid structural pre-check (Zod-FREE — D-25) ── */

/** A loose record for probing schemaless JSONB content without the schema union. */
type LooseContent = Record<string, unknown>;

/** True for a present, non-blank string. The single "field is filled" rule. */
function filled(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * PER-TYPE required-text-key map — the SINGLE SOURCE the structural probe keys off,
 * derived field-for-field from the `min(1)` string keys of each item schema in
 * `src/lib/validations/sections.ts` (NOT imported — D-25 bundle rule; this is a
 * hand-mirrored, Zod-free copy that the unit suite pins against the schemas).
 *
 * THE DRIFT BUG IT REPLACES (CR-01 / IN-02): a single flat `PRIMARY_TEXT_KEYS`
 * allowlist silently went stale every time a new soft-enum type was added —
 * `education` (requires `degree` + `school`) became un-saveable because neither key
 * was in the list, and `metrics` passed on `label` alone though `value` is ALSO
 * required. A per-type map cannot drift unnoticed: each item-bearing type names its
 * own required text keys, and an item is structurally complete only when EVERY one
 * of its type's required keys is filled (AND, not OR — IN-02).
 *
 * Each entry is the set of `z.string().min(1)` keys on the type's ITEM schema:
 *   - projects:       `title`              (projectItemSchema)
 *   - experience:     `company`, `role`    (experienceItemSchema)
 *   - testimonials:   `name`, `quote`      (testimonialItemSchema)
 *   - services:       `title`              (serviceItemSchema)
 *   - metrics:        `value`, `label`     (metricItemSchema — BOTH required, IN-02)
 *   - certifications: `title`              (certificationItemSchema)
 *   - education:      `degree`, `school`   (educationItemSchema — CR-01)
 *   - moodboard:      (none)               (moodboardImageSchema — only `id` + the
 *                       alt-when-image refine; a text-/image-less gallery slot is
 *                       SERVER-VALID, so it must pass the probe — CR-02)
 *
 * CONSERVATIVE DEFAULT (CLAUDE.md "skip only what the server is CERTAIN to reject"):
 * a type WITHOUT an entry here defaults to no required text keys → its items pass on
 * the alt-when-image rule alone, letting the server re-parse be the precise gate
 * rather than silently dropping a snapshot the probe is unsure about.
 */
const REQUIRED_TEXT_KEYS: Record<string, readonly string[]> = {
  projects: ['title'],
  experience: ['company', 'role'],
  testimonials: ['name', 'quote'],
  services: ['title'],
  metrics: ['value', 'label'],
  certifications: ['title'],
  education: ['degree', 'school'],
  moodboard: [], // gallery item: only the alt-when-image rule gates it (CR-02).
};

/** Item-bearing types whose content lives in a `content.items[]` array. */
const ITEM_BEARING = new Set<string>(Object.keys(REQUIRED_TEXT_KEYS));

/**
 * Per-item REQUIRED-field probe — the minimal "this item has its required field(s)"
 * structural rule, mirroring the INTENT of the section schemas WITHOUT importing
 * them (D-25). Two universal traps the per-type forms hit transiently:
 *   - a freshly-added item with one of its type's required text keys still empty
 *     (each item-bearing type names its own keys in `REQUIRED_TEXT_KEYS`);
 *   - an image set but its REQUIRED alt still empty (Pitfall 8 / D-13 alt presence):
 *     if `image` is present, the paired `image_alt` MUST be non-empty.
 *
 * EVERY required text key for the type must be filled (AND, not OR — so a metric with
 * `label` but no `value` is correctly skipped, IN-02). A type with NO required text
 * keys (e.g. `moodboard`) is governed by the alt-when-image rule ALONE — an
 * image-/text-less gallery slot is saveable (CR-02). The SERVER re-parse stays the
 * precise gate; this only skips a snapshot that is CERTAIN to be rejected.
 */
function itemIsStructurallyComplete(item: unknown, type: string): boolean {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const it = item as LooseContent;

  // Alt presence (Pitfall 8 / D-13): when an item carries an image its required alt
  // MUST be non-empty. An image-bearing item (e.g. a moodboard swatch) is governed
  // by this alt rule — such items legitimately carry no primary text.
  if (filled(it.image) && !filled(it.image_alt)) return false;
  if (filled(it.avatar) && !filled(it.avatar_alt)) return false;

  // Then EVERY required text key for this type must be filled (AND — a half-filled
  // item like a metric with `label` but no `value` is doomed and is skipped, IN-02).
  // A type with no required text keys (moodboard) passes on the alt rule alone (CR-02).
  const requiredKeys = REQUIRED_TEXT_KEYS[type] ?? [];
  return requiredKeys.every((k) => filled(it[k]));
}

/**
 * isSaveableSnapshot — the lightweight, Zod-FREE skip-invalid pre-check (Pitfall 8).
 *
 * Returns false for a snapshot that is STRUCTURALLY incomplete (so the hook fires NO
 * network call and raises NO error); true for a structurally-complete snapshot (the
 * server re-parse then stays the authoritative gate). It NEVER imports a Zod schema —
 * it is a structural probe only (D-25 bundle rule).
 *
 * For item-bearing types: EVERY present item must be structurally complete (a single
 * blank/alt-less item makes the whole snapshot un-saveable — exactly the transient
 * state `item-card.tsx` skips). A type with no items[] is treated as saveable here
 * (its required-field shape is the server's concern; the forms gate their own
 * section-level required fields inline).
 */
export function isSaveableSnapshot(type: string, content: unknown): boolean {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
  const c = content as LooseContent;

  if (ITEM_BEARING.has(type)) {
    const items = c.items;
    if (!Array.isArray(items)) return true; // no items array yet → nothing doomed.
    return items.every((item) => itemIsStructurallyComplete(item, type));
  }

  // Section-level image/alt pairing applies to non-item types too (e.g. about.avatar,
  // hero.background_image) — an image without its required alt is un-saveable.
  if (filled(c.image) && !filled(c.image_alt)) return false;
  if (filled(c.avatar) && !filled(c.avatar_alt)) return false;
  return true;
}

/* ──────────────────────────────────────────────────────────────────────────── *
 * THE HOOK (composes the three pure helpers)
 * ──────────────────────────────────────────────────────────────────────────── */

/** The visible save lifecycle the consuming form renders. */
export type DebouncedSaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/** What the form needs to drive a save: the target row + its owner username. */
export interface DebouncedSectionSaveParams {
  sectionId: string;
  type: string;
  username?: string;
  /** Fired ONLY on the latest flush's resolved `{ ok: true }` (never-claim-live-early). */
  onSavedAndLive?: () => void;
}

export interface UseDebouncedSectionSave {
  /** The current visible save state. */
  state: DebouncedSaveState;
  /** Schedule a debounced save for a keystroke-burst edit (trailing, coalesced). */
  scheduleSave: (content: unknown) => void;
  /** Save immediately (add/remove/reorder) — bumps seq, awaits, no timer. */
  immediateSave: (content: unknown) => Promise<SaveSectionResult>;
}

/**
 * The shared D-20 save hook. Owns the monotonic `seqRef`, the coalescing saver, and
 * the saving/saved/error state. Content saves are NON-optimistic — `state` shows
 * 'saving' until the action resolves and only transitions to 'saved' on the LATEST
 * flush's `{ ok: true }`.
 */
export function useDebouncedSectionSave(
  params: DebouncedSectionSaveParams,
): UseDebouncedSectionSave {
  const { sectionId, type, username, onSavedAndLive } = params;
  const seqRef = useRef(0);
  const [state, setState] = useState<DebouncedSaveState>('idle');

  // Keep the latest params/callback in a ref so the coalescing saver (created once)
  // always flushes against the current section without re-arming on every render.
  const latest = useRef({ sectionId, type, username, onSavedAndLive });
  latest.current = { sectionId, type, username, onSavedAndLive };

  /** The actual flush: seq-stamp → skip-invalid → save → drop-if-stale. */
  const flush = useCallback(async (content: unknown): Promise<SaveSectionResult> => {
    const { sectionId: id, type: t, username: u, onSavedAndLive: live } = latest.current;
    const mySeq = ++seqRef.current;

    // Skip-invalid (Pitfall 8): a doomed snapshot fires NO network call, NO error.
    if (!isSaveableSnapshot(t, content)) {
      if (isLatestSeq(mySeq, seqRef.current)) setState('idle');
      return { ok: false }; // a skip, NOT a failure — the caller never toasts.
    }

    setState('saving');
    const input: SaveSectionInput = { sectionId: id, type: t, content, username: u };
    let result: SaveSectionResult;
    try {
      result = await saveSectionAction(input);
    } catch {
      result = { ok: false, error: 'Something went wrong saving your changes.' };
    }

    // Out-of-order stale-drop (Pitfall 7): only the LATEST flush drives the state.
    if (!isLatestSeq(mySeq, seqRef.current)) return result;

    if (result.ok) {
      setState('saved');
      live?.(); // never-claim-live-early: only the latest resolved {ok:true}.
    } else {
      setState('error');
    }
    return result;
  }, []);

  // The coalescing saver is created ONCE (a burst must share one pending timer). It
  // marks 'pending' on each schedule and flushes via the stable `flush`.
  const coalesce = useRef<((content: unknown) => void) | null>(null);
  if (coalesce.current === null) {
    coalesce.current = createCoalescingSaver<unknown>((content) => {
      void flush(content);
    }, SAVE_DEBOUNCE_MS);
  }

  const scheduleSave = useCallback((content: unknown) => {
    setState('pending');
    coalesce.current?.(content);
  }, []);

  const immediateSave = useCallback(
    (content: unknown): Promise<SaveSectionResult> => flush(content),
    [flush],
  );

  // Reset the visible state if the section being edited changes underfoot.
  useEffect(() => {
    setState('idle');
  }, [sectionId]);

  return { state, scheduleSave, immediateSave };
}
