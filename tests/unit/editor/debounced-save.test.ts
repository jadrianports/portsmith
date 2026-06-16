/**
 * 13.1-01 (Wave 0, Nyquist) — D-20: the debounced-save hook's PURE decision logic.
 *
 * GREENED BY: the Wave-1 D-20 plan (`use-debounced-section-save.ts` — the shared
 * trailing-debounce + sequence-token save hook that folds the 08-REVIEW WR-04
 * `save-section-debounce` todo). RED now — the module + its pure exports do not yet
 * exist, so the imports below fail to resolve (the impl-driven RED, NOT a syntax error).
 *
 * WHY render-free (the storage-meter / skills-form precedent): the vitest `unit`
 * project is the `node` environment (NOT jsdom; the repo ships no @testing-library/
 * react). So — exactly as StorageMeter lifts its decision math and SkillsForm lifts
 * `buildSkillsContent`/`mapSaveResult` into pure exports asserted WITHOUT a DOM — the
 * D-20 hook's three testable decisions are exported as pure functions and asserted here:
 *
 *   1. BURST COALESCING (D-20): `createCoalescingSaver(flush, waitMs)` returns a
 *      `scheduleSave(content)` that, given a burst of N rapid calls inside the trailing
 *      window, invokes `flush` EXACTLY ONCE — with the LAST content (one
 *      saveSectionAction per keystroke burst, RESEARCH Pattern 4). Driven by vitest fake
 *      timers (pure setTimeout — works in `node`, no DOM).
 *   2. SEQUENCE-TOKEN STALE-DROP (Pitfall 7): `isLatestSeq(mySeq, latestSeq)` is the
 *      monotonic guard — a slow EARLIER save (lower seq) resolving AFTER a newer one
 *      must NOT drive the visible state. Only `mySeq === latestSeq` returns true.
 *   3. SKIP-INVALID (Pitfall 8, no-barrel): `isSaveableSnapshot(type, content)` is the
 *      LIGHTWEIGHT structural pre-check (required-field / alt presence) — NOT a Zod
 *      re-parse (the hook is a client island; it MUST NOT import `@/lib/validations`).
 *      A structurally-invalid snapshot returns false → NO network call, NO error.
 *
 * The hook does NOT import the Zod barrel (D-25) — the structural pre-check mirrors the
 * INTENT of `item-card.tsx:603-612` without Zod; the SERVER re-parse stays the authority.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

// Import the not-yet-existing pure exports of the D-20 hook module. RED until the
// Wave-1 plan ships `use-debounced-section-save.ts` (the import fails to resolve).
import {
  createCoalescingSaver,
  isLatestSeq,
  isSaveableSnapshot,
} from '@/components/editor/use-debounced-section-save';

afterEach(() => {
  vi.useRealTimers();
});

describe('D-20 — createCoalescingSaver (a keystroke burst coalesces to ONE flush)', () => {
  it('a burst of rapid scheduleSave calls within the window flushes exactly ONCE with the last content', () => {
    vi.useFakeTimers();
    const flush = vi.fn();
    const schedule = createCoalescingSaver(flush, 500);

    // A burst of 5 rapid edits (each well inside the 500ms trailing window).
    schedule({ heading: 'a' });
    vi.advanceTimersByTime(100);
    schedule({ heading: 'ab' });
    vi.advanceTimersByTime(100);
    schedule({ heading: 'abc' });
    vi.advanceTimersByTime(100);
    schedule({ heading: 'abcd' });
    vi.advanceTimersByTime(100);
    schedule({ heading: 'abcde' });

    // No flush yet — the trailing window has not elapsed since the LAST call.
    expect(flush).not.toHaveBeenCalled();

    // Let the trailing window elapse.
    vi.advanceTimersByTime(500);

    // ONE save for the whole burst, carrying the LAST content (D-20 coalescing).
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith({ heading: 'abcde' });
  });

  it('two bursts separated by a pause longer than the window flush twice', () => {
    vi.useFakeTimers();
    const flush = vi.fn();
    const schedule = createCoalescingSaver(flush, 500);

    schedule({ v: 1 });
    vi.advanceTimersByTime(500); // first burst flushes
    schedule({ v: 2 });
    vi.advanceTimersByTime(500); // second burst flushes

    expect(flush).toHaveBeenCalledTimes(2);
    expect(flush).toHaveBeenNthCalledWith(1, { v: 1 });
    expect(flush).toHaveBeenNthCalledWith(2, { v: 2 });
  });
});

describe('D-20 — isLatestSeq (the out-of-order stale-result guard, Pitfall 7)', () => {
  it('only the latest seq drives state; a slow earlier save (lower seq) is dropped', () => {
    // Two saves fire: seq 1 (slow) then seq 2 (fast). seq 2 wins (latest = 2).
    const latest = 2;
    expect(isLatestSeq(2, latest)).toBe(true); // the newer save drives state
    expect(isLatestSeq(1, latest)).toBe(false); // the stale earlier result is dropped
  });

  it('an equal seq is latest; any seq below the latest is stale', () => {
    expect(isLatestSeq(5, 5)).toBe(true);
    expect(isLatestSeq(4, 5)).toBe(false);
    expect(isLatestSeq(0, 0)).toBe(true);
  });
});

describe('D-20 — isSaveableSnapshot (skip-invalid structural pre-check, no Zod barrel)', () => {
  it('a freshly-added blank item (no required field) is NOT saveable → no doomed save', () => {
    // A blank services item (title required-but-empty) must not fire a network save.
    const blank = { heading: 'Services', items: [{ id: 's1', title: '' }] };
    expect(isSaveableSnapshot('services', blank)).toBe(false);
  });

  it('an image set without its required alt is NOT saveable (Pitfall 8 alt presence)', () => {
    // A moodboard image present but its required alt blank — the transient-invalid
    // state the skip-invalid pre-check must catch BEFORE the network.
    const noAlt = {
      heading: 'Moodboard',
      items: [{ id: 'm1', image: 'https://x/y.webp', image_alt: '' }],
    };
    expect(isSaveableSnapshot('moodboard', noAlt)).toBe(false);
  });

  it('a structurally-complete snapshot IS saveable (the server re-parse stays the authority)', () => {
    const ok = {
      heading: 'Services',
      items: [{ id: 's1', title: 'Consulting' }],
    };
    expect(isSaveableSnapshot('services', ok)).toBe(true);
    // An image WITH its alt present is saveable.
    const imgOk = {
      heading: 'Moodboard',
      items: [{ id: 'm1', image: 'https://x/y.webp', image_alt: 'A swatch' }],
    };
    expect(isSaveableSnapshot('moodboard', imgOk)).toBe(true);
  });

  // ── Regression: per-type required-key map (CR-01 / CR-02 / IN-02) ──
  // These four cases pin the Nyquist gap that let two whole section types become
  // silently un-saveable. Before the per-type REQUIRED_TEXT_KEYS map, the flat
  // allowlist had neither `degree`/`school` (education) nor an exemption for the
  // text-less moodboard gallery item, and `metrics` passed on `label` alone.

  it('CR-01: a valid education item (degree + school) IS saveable', () => {
    // educationItemSchema requires degree + school (both min 1) — neither was in the
    // old flat PRIMARY_TEXT_KEYS allowlist, so ANY non-empty education list probed
    // false and the save was skipped with no network call and no error.
    const edu = {
      heading: 'Education',
      items: [{ id: 'e1', degree: 'BSc', school: 'MIT' }],
    };
    expect(isSaveableSnapshot('education', edu)).toBe(true);

    // A half-filled education item (degree but no school) is correctly NOT saveable —
    // EVERY required key must be filled (AND, not OR).
    const eduPartial = {
      heading: 'Education',
      items: [{ id: 'e1', degree: 'BSc', school: '' }],
    };
    expect(isSaveableSnapshot('education', eduPartial)).toBe(false);
  });

  it('CR-02: a blank or caption-only moodboard gallery slot IS saveable', () => {
    // moodboardImageSchema makes image/image_alt/caption all optional — a freshly-
    // added { id } slot (before upload) and a caption-only item are SERVER-VALID, so
    // the probe must pass them (its only hard gate is the alt-when-image rule).
    const blankSlot = { heading: 'M', items: [{ id: 'm1' }] };
    expect(isSaveableSnapshot('moodboard', blankSlot)).toBe(true);

    const captionOnly = { heading: 'M', items: [{ id: 'm1', caption: 'Hero shot' }] };
    expect(isSaveableSnapshot('moodboard', captionOnly)).toBe(true);

    // The alt-when-image rule is PRESERVED: an image present with a blank alt is still
    // un-saveable (regression-guard for the existing image-bearing-moodboard case).
    const imageNoAlt = {
      heading: 'M',
      items: [{ id: 'm1', image: 'https://x/y.webp', image_alt: '' }],
    };
    expect(isSaveableSnapshot('moodboard', imageNoAlt)).toBe(false);
  });

  it('IN-02: a metric is saveable only when BOTH value and label are filled', () => {
    // metricItemSchema requires value + label (both min 1). The old allowlist passed a
    // metric as soon as `label` was filled, POSTing a doomed save the probe was meant
    // to prevent. The per-type map requires both.
    const labelOnly = { heading: 'Metrics', items: [{ id: 'x', label: 'Revenue' }] };
    expect(isSaveableSnapshot('metrics', labelOnly)).toBe(false);

    const valueOnly = { heading: 'Metrics', items: [{ id: 'x', value: '10M+' }] };
    expect(isSaveableSnapshot('metrics', valueOnly)).toBe(false);

    const both = {
      heading: 'Metrics',
      items: [{ id: 'x', value: '10M+', label: 'Revenue' }],
    };
    expect(isSaveableSnapshot('metrics', both)).toBe(true);
  });
});

// D-06 — out-of-order FLUSH-ordering stale-drop via a MOCK-SAVER seam.
//
// UX-02's correctness guarantee (Pitfall 7): when a slow EARLIER flush resolves AFTER a
// faster LATER one, the stale earlier result must NOT drive the visible saved/error
// state — only the latest (highest-seq) flush wins (the `seqRef`/`isLatestSeq` guard in
// `use-debounced-section-save.ts:270,288-295`).
//
// This is the FAST node sampling layer. The `unit` project is the `node` env (no jsdom,
// no @testing-library), so rather than render the hook we reproduce its flush dispatch/
// resolve discipline around a MOCK SAVER (two staggered promises) using the SAME pure
// exports the hook composes (`isLatestSeq`, the monotonic seq bump). The real-action
// proof — the same guard through the real `saveSectionAction` + real auth cookies — is
// Plan 08's Playwright e2e (Pitfall 6: a `node` test can't supply cookies).
describe('D-06 — out-of-order flush stale-drop (mock-saver seam, fast layer)', () => {
  /**
   * A controllable mock saver: each call returns a promise the test resolves by hand,
   * so an EARLIER-issued save can be made to resolve AFTER a LATER-issued one. Mirrors
   * the `saveSectionAction` seam the hook awaits at `use-debounced-section-save.ts:282`.
   */
  function makeMockSaver() {
    const resolvers: Array<(r: { ok: boolean }) => void> = [];
    const calls: unknown[] = [];
    const save = (content: unknown): Promise<{ ok: boolean }> => {
      calls.push(content);
      return new Promise((resolve) => {
        resolvers.push(resolve);
      });
    };
    return { save, resolvers, calls };
  }

  /**
   * A minimal re-creation of the hook's flush body (the seq-stamp → await saver →
   * drop-if-stale → set-visible-state sequence at `use-debounced-section-save.ts:268-296`),
   * sharing a single monotonic `seqRef` across flushes exactly like the hook. The
   * `setVisible` spy stands in for the hook's `setState` — it is called ONLY when the
   * resolving flush is still the latest (`isLatestSeq(mySeq, seqRef.current)`).
   */
  function makeFlushHarness(
    saver: (content: unknown) => Promise<{ ok: boolean }>,
    setVisible: (s: 'saved' | 'error') => void,
  ) {
    const seqRef = { current: 0 };
    async function flush(content: unknown): Promise<void> {
      const mySeq = ++seqRef.current; // hook :270 — capture this flush's seq
      const result = await saver(content); // hook :282 — the awaited save (mock seam)
      // hook :288 — out-of-order stale-drop: a non-latest flush returns without
      // touching the visible state.
      if (!isLatestSeq(mySeq, seqRef.current)) return;
      // hook :290-295 — only the latest flush drives the visible saved/error state.
      setVisible(result.ok ? 'saved' : 'error');
    }
    return { flush, seqRef };
  }

  it('a slow EARLIER flush resolving AFTER a faster LATER one does NOT set the visible state', async () => {
    const mock = makeMockSaver();
    const setVisible = vi.fn();
    const { flush } = makeFlushHarness(mock.save, setVisible);

    // Dispatch the EARLIER (slow) flush, then the LATER (fast) flush. Both are in
    // flight; the seq is now 2 and the earlier flush captured seq 1.
    const slowEarlier = flush({ heading: 'v1' });
    const fastLater = flush({ heading: 'v2' });
    expect(mock.calls).toEqual([{ heading: 'v1' }, { heading: 'v2' }]);

    // The LATER flush resolves FIRST → it is latest (seq 2 === 2) → it drives state.
    mock.resolvers[1]({ ok: true });
    await fastLater;
    expect(setVisible).toHaveBeenCalledTimes(1);
    expect(setVisible).toHaveBeenLastCalledWith('saved');

    // Now the slow EARLIER flush resolves LAST → it is stale (its seq 1 !== latest 2) →
    // it must be DROPPED: no further visible-state write, the saved state stands.
    mock.resolvers[0]({ ok: true });
    await slowEarlier;
    expect(setVisible).toHaveBeenCalledTimes(1); // still 1 — the stale result was dropped
    expect(setVisible).toHaveBeenLastCalledWith('saved');
  });

  it("a stale earlier ERROR cannot overwrite the latest flush's saved state", async () => {
    // The dangerous case the guard exists for: an earlier save that ultimately FAILS
    // resolving after a later save that SUCCEEDED must not flip the UI to 'error'.
    const mock = makeMockSaver();
    const setVisible = vi.fn();
    const { flush } = makeFlushHarness(mock.save, setVisible);

    const slowEarlier = flush({ heading: 'v1' });
    const fastLater = flush({ heading: 'v2' });

    // Later flush succeeds first and drives 'saved'.
    mock.resolvers[1]({ ok: true });
    await fastLater;
    expect(setVisible).toHaveBeenLastCalledWith('saved');

    // Earlier flush fails LAST — stale (seq 1 !== latest 2), so 'error' is dropped.
    mock.resolvers[0]({ ok: false });
    await slowEarlier;
    expect(setVisible).toHaveBeenCalledTimes(1); // the stale error never reached the UI
    expect(setVisible).toHaveBeenLastCalledWith('saved');
  });

  it('the latest flush DOES drive state even when an earlier one is still in flight', async () => {
    // Positive control: the highest-seq flush is always honored on resolve.
    const mock = makeMockSaver();
    const setVisible = vi.fn();
    const { flush, seqRef } = makeFlushHarness(mock.save, setVisible);

    const slowEarlier = flush({ heading: 'v1' });
    const fastLater = flush({ heading: 'v2' });
    expect(seqRef.current).toBe(2); // monotonic bump per flush (hook :270)

    // The latest (seq 2) resolves and wins, even though seq 1 has not resolved yet.
    mock.resolvers[1]({ ok: true });
    await fastLater;
    expect(setVisible).toHaveBeenCalledTimes(1);
    expect(setVisible).toHaveBeenLastCalledWith('saved');

    // Drain the still-pending earlier promise so no unhandled rejection lingers.
    mock.resolvers[0]({ ok: true });
    await slowEarlier;
  });
});

// CR-01 (26-REVIEW) — the duplicate-CREATE guard on a brand-new post.
//
// `latest.current.postId` only re-syncs on render, so a SECOND debounced flush firing
// before the first CREATE's `onSaved` → `setPostId` propagates would still read
// `postId === undefined` and INSERT a SECOND row (two posts for "one"). The hook
// (`use-debounced-post-save.ts`) serializes the CREATE: the first writer publishes a
// `createInFlightRef` promise (set synchronously, before its first await) and records the
// resolved id in `createdIdRef`; any concurrent flush AWAITs that promise and then UPDATEs
// the created row instead of inserting its own. This is the fast node sampling layer (the
// real two-flush-through-savePostAction proof is the blog-editor Playwright e2e).
describe('CR-01 — duplicate-CREATE guard (a burst on a NEW post INSERTs exactly once)', () => {
  /**
   * A mock post saver that distinguishes a CREATE (no `postId` → mint a new id) from an
   * UPDATE (`postId` present), auto-resolving on a microtask so flush ordering is driven
   * deterministically by the create-serialization logic — not by hand-staggered resolvers.
   * Mirrors the `savePostAction` seam the hook awaits.
   */
  function makeMockPostSaver() {
    let nextId = 1;
    const inserts: unknown[] = [];
    const updates: Array<{ postId: string }> = [];
    const save = async (input: {
      postId?: string;
      content: unknown;
    }): Promise<{ ok: true; id: string }> => {
      await Promise.resolve(); // a network tick — lets a concurrent flush interleave
      if (input.postId == null) {
        const id = `post-${nextId++}`;
        inserts.push(input.content);
        return { ok: true, id };
      }
      updates.push({ postId: input.postId });
      return { ok: true, id: input.postId };
    };
    return { save, inserts, updates };
  }

  /**
   * A minimal re-creation of the hook's create-serialized flush slice
   * (`use-debounced-post-save.ts`): `createdIdRef` records the id the instant a CREATE
   * resolves; `createInFlightRef` lets a concurrent flush await the first CREATE and then
   * UPDATE that row. `initialId` seeds the existing-post case (the param `postId`).
   */
  function makeCreateGuardedHarness(
    saver: (input: { postId?: string; content: unknown }) => Promise<{ ok: true; id: string }>,
    initialId?: string,
  ) {
    const createdIdRef: { current: string | undefined } = { current: initialId };
    const createInFlightRef: { current: Promise<string | null> | null } = { current: null };
    async function flush(content: unknown): Promise<{ ok: true; id: string }> {
      let effectiveId = createdIdRef.current;
      if (!effectiveId && createInFlightRef.current) {
        effectiveId = (await createInFlightRef.current) ?? undefined;
      }
      let resolveCreate: ((id: string | null) => void) | null = null;
      if (!effectiveId) {
        createInFlightRef.current = new Promise<string | null>((res) => {
          resolveCreate = res;
        });
      }
      const result = await saver({ postId: effectiveId, content });
      if (resolveCreate) {
        createdIdRef.current = result.id;
        (resolveCreate as (id: string | null) => void)(result.id);
        createInFlightRef.current = null;
      }
      return result;
    }
    return { flush };
  }

  it('two concurrent flushes on a NEW post → exactly ONE INSERT; the 2nd UPDATEs the created row', async () => {
    const mock = makeMockPostSaver();
    const { flush } = makeCreateGuardedHarness(mock.save);

    // The race: two debounced flushes both fire before the first CREATE resolves.
    const [r1, r2] = await Promise.all([flush({ body_md: 'a' }), flush({ body_md: 'ab' })]);

    expect(mock.inserts).toHaveLength(1); // exactly ONE INSERT — no duplicate post
    expect(mock.updates).toEqual([{ postId: 'post-1' }]); // the 2nd flush UPDATED the created row
    expect(r1.id).toBe('post-1');
    expect(r2.id).toBe('post-1'); // both flushes resolve to the SAME row
  });

  it('a flush on an EXISTING post UPDATEs and never INSERTs', async () => {
    const mock = makeMockPostSaver();
    const { flush } = makeCreateGuardedHarness(mock.save, 'post-existing');

    await flush({ body_md: 'edit' });

    expect(mock.inserts).toHaveLength(0);
    expect(mock.updates).toEqual([{ postId: 'post-existing' }]);
  });

  it('serial flushes on a new post INSERT once, then UPDATE the same row', async () => {
    const mock = makeMockPostSaver();
    const { flush } = makeCreateGuardedHarness(mock.save);

    const first = await flush({ body_md: 'a' }); // CREATE
    const second = await flush({ body_md: 'ab' }); // UPDATE (createdIdRef now set)

    expect(mock.inserts).toHaveLength(1);
    expect(mock.updates).toEqual([{ postId: 'post-1' }]);
    expect(first.id).toBe('post-1');
    expect(second.id).toBe('post-1');
  });
});
