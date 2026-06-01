// CMS-05 — turned GREEN by 04-05 (reorder sections + toggle visible/hidden).
//
// Wave-0 RED scaffold (04-01). INTENTIONALLY failing: imports the not-yet-built
// reorder + visibility actions so the import fails to resolve until 04-05 ships
// them (RED is the contract — 04-VALIDATION.md). The DB-level assertions describe
// the invariant the actions must uphold; 04-05 turns this file GREEN.
//
// Behavior under test:
//   - writing a full ordered id list yields contiguous 0..n `sort_order`
//     (04-RESEARCH Pitfall 6: persist sort_order for ALL affected rows);
//   - toggling `visible` flips the column on a single section under RLS.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from './_cms-fixtures';

// @ts-expect-error — RED: 04-05 creates these server actions; module does not exist yet.
import { reorderSectionsAction } from '@/lib/cms/reorder-sections-action';
// @ts-expect-error — RED: 04-05 creates these server actions; module does not exist yet.
import { toggleVisibilityAction } from '@/lib/cms/toggle-visibility-action';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

let ctx: TwoUsers;
let orderedIds: string[];

beforeAll(async () => {
  ctx = await setupTwoUsers('cmsrv', RUN);

  const { data: sections } = await admin
    .from('sections')
    .select('id, sort_order')
    .eq('portfolio_id', ctx.portfolioA)
    .order('sort_order', { ascending: true });
  orderedIds = (sections ?? []).map((s) => s.id as string);
  expect(orderedIds.length).toBeGreaterThan(1);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('CMS-05 — reorder persists contiguous sort_order; visibility flips', () => {
  it('writing a reversed id list yields contiguous 0..n sort_order', async () => {
    expect(typeof reorderSectionsAction).toBe('function');
    const reversed = [...orderedIds].reverse();

    // Persist the new contiguous order (owner client; RLS scopes each row).
    for (let i = 0; i < reversed.length; i++) {
      const { error } = await ctx.clientA
        .from('sections')
        .update({ sort_order: i })
        .eq('id', reversed[i]);
      expect(error).toBeNull();
    }

    const { data } = await admin
      .from('sections')
      .select('id, sort_order')
      .eq('portfolio_id', ctx.portfolioA)
      .order('sort_order', { ascending: true });
    const orders = (data ?? []).map((s) => s.sort_order as number);
    // Contiguous 0..n-1, no gaps / collisions.
    expect(orders).toEqual(orders.map((_, i) => i));
  });

  it('toggling `visible` flips the column on a section', async () => {
    expect(typeof toggleVisibilityAction).toBe('function');
    const target = orderedIds[0];
    const { data: before } = await admin
      .from('sections')
      .select('visible')
      .eq('id', target)
      .single();

    const next = !(before!.visible as boolean);
    const { error } = await ctx.clientA
      .from('sections')
      .update({ visible: next })
      .eq('id', target);
    expect(error).toBeNull();

    const { data: after } = await admin
      .from('sections')
      .select('visible')
      .eq('id', target)
      .single();
    expect(after!.visible).toBe(next);
  });
});
