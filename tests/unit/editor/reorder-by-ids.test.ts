/**
 * 17-01 (Wave 0, Nyquist) — D-13 / WR-04: the hardened `reorderByIds` pure helper.
 *
 * GREENED BY: the 17-01 Task-1 change to `section-list-row.tsx` that (1) EXPORTS
 * `reorderByIds` (currently inline/un-exported, so the import below fails to resolve —
 * the impl-driven RED, NOT a syntax error — exactly the `debounced-save.test.ts`
 * precedent), (2) rebuilds the leftover-append from a `Set(orderedIds)` membership test
 * iterating `sections` in ORIGINAL index order (dropping the lone `Array.includes` scan
 * at line 103), and (3) adds a NON-throwing dev-only id-set assertion that fires when
 * `orderedIds` and `sections` cover different id sets.
 *
 * WHY render-free (the storage-meter / debounced-save precedent): the vitest `unit`
 * project is the `node` environment (no jsdom, no @testing-library). `reorderByIds` is a
 * pure array helper, so its reorder/append/identity behavior + the dev id-set assertion
 * are asserted here WITHOUT a DOM. The dev assertion writes via `console.error` (the
 * `delete-object.ts` / `error-boundary.tsx` diagnostic idiom) guarded by
 * `process.env.NODE_ENV !== 'production'`; we spy on it to prove it fires (mismatch) and
 * stays silent (matched id set) WITHOUT ever throwing.
 *
 * The reorder commit BOTH drag AND the future D-10 move buttons ride is
 * `reorderByIds` → `reorderSectionsAction`; hardening + pinning it here is the
 * prerequisite for Plan 08's mobile reorder.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Import the pure export of the rail row module. RED until 17-01 Task 1 changes
// `function reorderByIds` → `export function reorderByIds` (the import fails to resolve).
import { reorderByIds, type EditorSection } from '@/components/editor/section-list-row';

/** A minimal EditorSection factory — only `id` matters for the reorder math. */
function sec(id: string): EditorSection {
  return { id, type: 'projects', title: id, visible: true, hasContent: true };
}

describe('D-13 / WR-04 — reorderByIds (single byId source of truth)', () => {
  it('reorders a full ordered list through the byId map (every id, once, in orderedIds order)', () => {
    const sections = [sec('a'), sec('b'), sec('c')];
    const result = reorderByIds(sections, ['c', 'a', 'b']);

    expect(result.map((s) => s.id)).toEqual(['c', 'a', 'b']);
    // Same object identities, just reordered (looked up through byId, not reconstructed).
    expect(result[0]).toBe(sections[2]);
    expect(result[1]).toBe(sections[0]);
    expect(result[2]).toBe(sections[1]);
  });

  it('an ordered SUBSET reorders the named ids, then appends the leftovers by ORIGINAL index', () => {
    const sections = [sec('a'), sec('b'), sec('c'), sec('d')];
    // Only c + a are named (and out of order); b + d are leftovers.
    const result = reorderByIds(sections, ['c', 'a']);

    // Named ids come first in orderedIds order; leftovers (b, d) follow in their
    // ORIGINAL `sections` index order — NOT orderedIds order, NOT reversed.
    expect(result.map((s) => s.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('appends multiple leftovers preserving their original relative order', () => {
    const sections = [sec('a'), sec('b'), sec('c'), sec('d'), sec('e')];
    // Name only the LAST element; a, b, c, d are all leftovers and must keep a→b→c→d.
    const result = reorderByIds(sections, ['e']);

    expect(result.map((s) => s.id)).toEqual(['e', 'a', 'b', 'c', 'd']);
  });

  it('is a no-op-safe identity when orderedIds already matches the sections order', () => {
    const sections = [sec('a'), sec('b'), sec('c')];
    const result = reorderByIds(sections, ['a', 'b', 'c']);

    expect(result.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    // Every original object survives exactly once, in place.
    expect(result[0]).toBe(sections[0]);
    expect(result[1]).toBe(sections[1]);
    expect(result[2]).toBe(sections[2]);
  });

  it('an empty input is a safe identity (no throw, empty out)', () => {
    expect(reorderByIds([], []).map((s) => s.id)).toEqual([]);
  });
});

describe('D-13 / WR-04 — reorderByIds dev-only id-set assertion (non-throwing)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Force the dev branch so the assertion is evaluated (it is guarded by
    // NODE_ENV !== 'production'). Vitest defaults NODE_ENV to 'test' which already
    // satisfies the guard, but pin it explicitly for intent + isolation. `vi.stubEnv`
    // is the type-safe setter; `vi.unstubAllEnvs()` (afterEach) restores it.
    vi.stubEnv('NODE_ENV', 'development');
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('fires a dev diagnostic when orderedIds is MISSING an id present in sections (and still returns every row)', () => {
    const sections = [sec('a'), sec('b'), sec('c')];
    // 'c' is in sections but absent from orderedIds — an id-set mismatch.
    const result = reorderByIds(sections, ['a', 'b']);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    // Never throws: the leftover is still appended so no row is dropped from the view.
    expect(result.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('fires a dev diagnostic when orderedIds carries an EXTRA id not present in sections (no phantom row added)', () => {
    const sections = [sec('a'), sec('b')];
    // 'z' is named in orderedIds but does not exist in sections — an id-set mismatch.
    const result = reorderByIds(sections, ['a', 'b', 'z']);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    // The unknown id is skipped (byId.get('z') is undefined) — no phantom row, no throw.
    expect(result.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('does NOT fire when orderedIds and sections cover the same id set (a plain reorder)', () => {
    const sections = [sec('a'), sec('b'), sec('c')];
    const result = reorderByIds(sections, ['b', 'c', 'a']);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(result.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });
});
