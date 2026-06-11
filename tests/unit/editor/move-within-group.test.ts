/**
 * 17-08 (Wave 2) — D-10: the pure within-group ±1 move helper the chevron move
 * buttons commit.
 *
 * GREENED BY: the 17-08 Task-2 change to `section-list-row.tsx` that EXPORTS a pure
 * `moveWithinGroup(allIds, groupIds, sectionId, direction)` helper (currently
 * non-existent, so the import below fails to resolve — the impl-driven RED, the
 * `reorder-by-ids.test.ts` / `debounced-save.test.ts` precedent), computing the NEW
 * FULL ordered id list for a one-step move WITHIN a group, leaving every other
 * group's ids in place. The move buttons feed this into the SAME optimistic
 * `commitOrder` → `reorderSectionsAction` the drag uses (riding the D-13-hardened
 * `reorderByIds`).
 *
 * WHY render-free (the storage-meter / debounced-save / reorder-by-ids precedent):
 * the vitest `unit` project is the `node` environment (no jsdom, no
 * @testing-library). `moveWithinGroup` is a pure array helper, so the move math
 * (within-group swap, edge no-ops, other-group preservation, group-bounding) is
 * asserted here WITHOUT a DOM. The button rendering / a11y / optimistic rollback are
 * proven by the Plan-08 Playwright e2e (`move-buttons-reorder.spec.ts`).
 *
 * THE GROUP-BOUNDING GUARANTEE (the load-bearing safety): a move NEVER crosses
 * groups — it only ever permutes ids WITHIN `groupIds`, so the full result is the
 * original `allIds` with this group's slots filled in the new within-group order and
 * every non-group id untouched (parity with the per-group drag SortableContexts).
 */
import { describe, expect, it } from 'vitest';

// Import the pure export of the rail row module. RED until 17-08 Task 2 adds
// `export function moveWithinGroup` (the import fails to resolve until then).
import { moveWithinGroup } from '@/components/editor/section-list-row';

describe('D-10 — moveWithinGroup (within-group ±1 move, whole-order rebuild)', () => {
  it('moves a middle id UP one slot within its group (swaps with its predecessor)', () => {
    const allIds = ['a', 'b', 'c', 'd'];
    const groupIds = ['a', 'b', 'c', 'd'];
    expect(moveWithinGroup(allIds, groupIds, 'c', 'up')).toEqual(['a', 'c', 'b', 'd']);
  });

  it('moves a middle id DOWN one slot within its group (swaps with its successor)', () => {
    const allIds = ['a', 'b', 'c', 'd'];
    const groupIds = ['a', 'b', 'c', 'd'];
    expect(moveWithinGroup(allIds, groupIds, 'b', 'down')).toEqual(['a', 'c', 'b', 'd']);
  });

  it('is a no-op when moving the group FIRST row up (already at the top edge)', () => {
    const allIds = ['a', 'b', 'c'];
    const groupIds = ['a', 'b', 'c'];
    expect(moveWithinGroup(allIds, groupIds, 'a', 'up')).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op when moving the group LAST row down (already at the bottom edge)', () => {
    const allIds = ['a', 'b', 'c'];
    const groupIds = ['a', 'b', 'c'];
    expect(moveWithinGroup(allIds, groupIds, 'c', 'down')).toEqual(['a', 'b', 'c']);
  });

  it('moves WITHIN the group only — ids in OTHER groups keep their absolute positions', () => {
    // Full shared order interleaves two groups: the "onpage" group [a, c, e] and the
    // "other" group [b, d] (the shared sort_order the page reads). Moving `e` up
    // within its own group swaps it with `c` (the group-relative predecessor); the
    // "other" group ids b, d never move, and the group's slots in allIds are refilled
    // in the new within-group order.
    const allIds = ['a', 'b', 'c', 'd', 'e'];
    const groupIds = ['a', 'c', 'e']; // the supported group (non-contiguous in allIds)
    // group order a,c,e → move e up → a,e,c; refill the group's slots (indices 0,2,4):
    //   index0 ← a, index2 ← e, index4 ← c; b (1) and d (3) stay.
    expect(moveWithinGroup(allIds, groupIds, 'e', 'up')).toEqual(['a', 'b', 'e', 'd', 'c']);
  });

  it('moves a non-contiguous group member DOWN, leaving the other group fixed', () => {
    const allIds = ['a', 'b', 'c', 'd', 'e'];
    const groupIds = ['a', 'c', 'e'];
    // group order a,c,e → move a down → c,a,e; refill slots 0,2,4: c,a,e; b,d fixed.
    expect(moveWithinGroup(allIds, groupIds, 'a', 'down')).toEqual(['c', 'b', 'a', 'd', 'e']);
  });

  it('returns the original full order unchanged when the id is not in the group (group-bounded)', () => {
    const allIds = ['a', 'b', 'c'];
    const groupIds = ['a', 'b']; // 'c' is in another group
    expect(moveWithinGroup(allIds, groupIds, 'c', 'up')).toEqual(['a', 'b', 'c']);
  });

  it('handles a single-row group as a no-op in both directions', () => {
    const allIds = ['x', 'a', 'b'];
    const groupIds = ['x'];
    expect(moveWithinGroup(allIds, groupIds, 'x', 'up')).toEqual(['x', 'a', 'b']);
    expect(moveWithinGroup(allIds, groupIds, 'x', 'down')).toEqual(['x', 'a', 'b']);
  });
});
