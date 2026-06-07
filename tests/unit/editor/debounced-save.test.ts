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
});
