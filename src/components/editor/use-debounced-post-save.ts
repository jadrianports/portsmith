'use client';

/**
 * useDebouncedPostSave (13.2-06 / D-20) — the post-content auto-save hook, the
 * first-class-row analog of `useDebouncedSectionSave`. It REUSES the 13.1 shared
 * debounce infra wholesale (`createCoalescingSaver` + `isLatestSeq` +
 * `SAVE_DEBOUNCE_MS` from `use-debounced-section-save.ts`) — only the save target
 * (`savePostAction` over `blog_posts` rows) and the skip-invalid probe differ.
 *
 * THE PROBLEM IT SOLVES (identical to the section hook):
 *   1. COALESCING — a keystroke burst in the Markdown body / meta fields coalesces
 *      into ONE `savePostAction` flush carrying the LAST content (shared timer).
 *   2. OUT-OF-ORDER STALE-DROP — a slow earlier flush resolving after a newer one
 *      must NOT drive the visible saved/error state (the monotonic `seqRef`).
 *   3. SKIP-INVALID — a structurally-incomplete draft (no title OR no body) fires
 *      NO network call and raises NO error. An empty new post is skipped, not saved.
 *   4. NEVER CLAIM LIVE EARLY — the saved beat fires ONLY on the LATEST flush's
 *      resolved `{ ok: true }` (content saves are non-optimistic).
 *
 * D-02 / D-20 DRAFT-BY-DEFAULT (LOAD-BEARING): this hook drives ONLY the CONTENT
 * save (`savePostAction`), which never writes the `published` flag. The
 * publish/unpublish toggle is a SEPARATE, IMMEDIATE (non-debounced) call to
 * `publishPostAction` in the editor — it never flows through this hook, so an
 * auto-save can never push a draft live.
 *
 * BUNDLE RULE (CLAUDE.md / D-25 — LOAD-BEARING): this `'use client'` island MUST
 * NOT import the validations barrel or the template registry module — both drag
 * Zod onto the public First Load JS bundle. The skip-invalid check here is a
 * LIGHTWEIGHT, Zod-FREE STRUCTURAL pre-check (title present AND body present)
 * mirroring the INTENT of `postContentSchema`'s required keys (title `min(1)`,
 * body_md a string) WITHOUT importing the schema. The SERVER re-parse inside
 * `savePostAction` (the `postContentSchema.parse`) stays the authoritative gate —
 * this only avoids POSTing a payload the server is certain to reject (an empty
 * title fails the schema; an empty draft body is intentionally just-not-saved).
 *
 * RENDER-FREE PURE HELPER: the structural probe (`isSaveablePostSnapshot`) is
 * exported as a pure function (the `createCoalescingSaver` / `isLatestSeq`
 * precedent) so the `node` vitest project can assert it WITHOUT a DOM.
 *
 * Source: the coalescing/seq machinery re-imported from
 * `use-debounced-section-save.ts:78-104`; the save target + result union from
 * `save-post-action.ts` (`savePostAction` / `SavePostResult`); the publish target
 * from `publish-post-action.ts` (`publishPostAction`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  publishPostAction,
  type PublishPostInput,
  type PublishPostResult,
} from '@/lib/cms/publish-post-action';
import {
  savePostAction,
  type SavePostInput,
  type SavePostResult,
} from '@/lib/cms/save-post-action';

import {
  createCoalescingSaver,
  isLatestSeq,
  SAVE_DEBOUNCE_MS,
} from './use-debounced-section-save';

/** A loose record for probing the post content shape without the Zod schema. */
type LoosePostContent = Record<string, unknown>;

/** True for a present, non-blank string. The single "field is filled" rule. */
function filled(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * isSaveablePostSnapshot — the Zod-FREE skip-invalid pre-check for a post (D-25).
 *
 * A post is structurally saveable only when it has BOTH a non-blank title AND a
 * non-blank body (the two `postContentSchema` keys the server is CERTAIN to reject
 * when empty: `title` is `min(1)`; an empty `body_md` is a not-yet-started draft we
 * deliberately skip rather than persist). The slug is NOT probed here — the editor
 * derives it from the title, and the server schema re-validates its charset; a
 * transiently-empty slug is the server's precise concern, not a reason to skip.
 *
 * It NEVER imports a Zod schema — a plain structural object check. The SERVER
 * re-parse inside `savePostAction` stays the authoritative gate.
 */
export function isSaveablePostSnapshot(content: unknown): boolean {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
  const c = content as LoosePostContent;
  return filled(c.title) && filled(c.body_md);
}

/** The visible save lifecycle the post editor renders (mirrors the section hook). */
export type DebouncedSaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/** What the hook needs to drive a post save. */
export interface DebouncedPostSaveParams {
  /** The target row id (absent ⇒ a CREATE on the next saveable flush). */
  postId?: string;
  /** The owner's portfolio id (scopes the CREATE; never client-trusted server-side). */
  portfolioId: string;
  /** The owner's username (drives the action's revalidate — never the request host). */
  username: string;
  /** Fired with the row id on the latest flush's resolved `{ ok: true }` (so a CREATE
   *  can promote the editor to an UPDATE on the returned id). */
  onSaved?: (id: string) => void;
}

export interface UseDebouncedPostSave {
  /** The current visible save state. */
  state: DebouncedSaveState;
  /** Schedule a debounced content save for a keystroke-burst edit (trailing, coalesced). */
  scheduleSave: (content: unknown) => void;
  /** Save the content immediately (no timer) — bumps seq, awaits. */
  immediateSave: (content: unknown) => Promise<SavePostResult>;
  /** Publish/unpublish — an IMMEDIATE, non-debounced lifecycle write (D-20). */
  setPublished: (slug: string, published: boolean) => Promise<PublishPostResult>;
}

/**
 * The post content auto-save hook. Owns the monotonic `seqRef`, the (once-created)
 * coalescing saver, and the saving/saved/error state. Content saves are
 * NON-optimistic. The publish toggle is a SEPARATE immediate call that never flows
 * through the debounced content path (D-20 draft-by-default).
 */
export function useDebouncedPostSave(
  params: DebouncedPostSaveParams,
): UseDebouncedPostSave {
  const seqRef = useRef(0);
  const [state, setState] = useState<DebouncedSaveState>('idle');

  // Keep the latest params in a ref so the once-created coalescing saver always
  // flushes against the current post (id/portfolio/username) without re-arming.
  const latest = useRef(params);
  latest.current = params;

  // CR-01 (duplicate-CREATE guard): `latest.current.postId` only re-syncs on render,
  // so on a BRAND-NEW post a second debounced flush firing before the first CREATE's
  // `onSaved` → `setPostId` propagates would still read `postId === undefined` and
  // INSERT a SECOND row (two posts for "one"). `createdIdRef` records the id the
  // instant a CREATE resolves (no render needed); `createInFlightRef` lets a concurrent
  // flush AWAIT the first CREATE and then UPDATE that row instead of inserting its own.
  const createdIdRef = useRef<string | undefined>(params.postId);
  const createInFlightRef = useRef<Promise<string | null> | null>(null);

  /** The content flush: seq-stamp → skip-invalid → save → drop-if-stale. */
  const flush = useCallback(async (content: unknown): Promise<SavePostResult> => {
    const { postId, portfolioId, username, onSaved } = latest.current;
    const mySeq = ++seqRef.current;

    // Skip-invalid (D-25 Zod-free probe): an incomplete draft (no title or no body)
    // fires NO network call, NO error.
    if (!isSaveablePostSnapshot(content)) {
      if (isLatestSeq(mySeq, seqRef.current)) setState('idle');
      return { ok: false }; // a skip, NOT a failure — the caller never toasts.
    }

    setState('saving');

    // CR-01: resolve the effective target id. Prefer the param; else the id a CREATE
    // already resolved this session; else, if a CREATE is in flight, AWAIT it so we
    // UPDATE that row rather than INSERT a duplicate.
    let effectiveId = postId ?? createdIdRef.current;
    if (!effectiveId && createInFlightRef.current) {
      effectiveId = (await createInFlightRef.current) ?? undefined;
    }

    // If still no id, THIS flush is the first writer for a brand-new post: publish an
    // in-flight promise SYNCHRONOUSLY (before the first await below) so any concurrent
    // flush serializes on it; `resolveCreate` settles it with the new id (or null).
    let resolveCreate: ((id: string | null) => void) | null = null;
    if (!effectiveId) {
      createInFlightRef.current = new Promise<string | null>((res) => {
        resolveCreate = res;
      });
    }

    const input: SavePostInput = { postId: effectiveId, portfolioId, content, username };
    let result: SavePostResult;
    try {
      result = await savePostAction(input);
    } catch {
      result = { ok: false, error: 'Something went wrong saving your post.' };
    }

    // Settle the CREATE promise (if this flush owned it) BEFORE the stale-drop below,
    // so a waiting concurrent flush always unblocks even when this flush is no longer
    // the latest. Record the resolved id so later flushes UPDATE rather than INSERT.
    if (resolveCreate) {
      if (result.ok) createdIdRef.current = result.id;
      (resolveCreate as (id: string | null) => void)(result.ok ? result.id : null);
      createInFlightRef.current = null;
    }

    // Out-of-order stale-drop: only the LATEST flush drives the visible state.
    if (!isLatestSeq(mySeq, seqRef.current)) return result;

    if (result.ok) {
      setState('saved');
      onSaved?.(result.id); // promote a CREATE → UPDATE on the returned id.
    } else {
      setState('error');
    }
    return result;
  }, []);

  // The coalescing saver is created ONCE (a burst must share one pending timer).
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
    (content: unknown): Promise<SavePostResult> => flush(content),
    [flush],
  );

  /**
   * The SEPARATE publish/unpublish path (D-20). An IMMEDIATE call to
   * `publishPostAction` — never debounced, never through the content flush, so the
   * lifecycle flag and the content auto-save can never cross. Requires a persisted
   * row; the editor only enables this once the post has an id.
   */
  const setPublished = useCallback(
    async (slug: string, published: boolean): Promise<PublishPostResult> => {
      const { postId, username } = latest.current;
      if (!postId) {
        return { ok: false, error: 'Save your post before publishing.' };
      }
      const input: PublishPostInput = { postId, username, slug, published };
      try {
        return await publishPostAction(input);
      } catch {
        return { ok: false, error: 'Something went wrong updating your post.' };
      }
    },
    [],
  );

  // Reset the visible state if the post being edited changes underfoot.
  useEffect(() => {
    setState('idle');
    // CR-01: a different post is now being edited — re-anchor the create-guard refs to
    // the new target so a prior post's resolved id / in-flight create can never make a
    // later flush touch the wrong row.
    createdIdRef.current = params.postId;
    createInFlightRef.current = null;
  }, [params.postId]);

  return { state, scheduleSave, immediateSave, setPublished };
}
