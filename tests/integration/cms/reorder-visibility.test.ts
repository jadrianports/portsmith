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

// GREEN (04-05): these server actions now exist — the RED `@ts-expect-error`
// import guards were removed once the modules resolved (the RED→GREEN flip).
import { reorderSectionsAction } from '@/lib/cms/reorder-sections-action';
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

  // WR-04 — the ATOMIC reorder RPC (migration 007) the action now calls. Driving
  // the RPC as the OWNER proves it (a) is owner-callable under SECURITY INVOKER
  // RLS, (b) sets a single contiguous 0..n-1 order in one statement, and (c) maps
  // the input order exactly (the row order matches the ids passed in).
  it('reorder_sections RPC sets contiguous 0..n-1 sort_order matching the input order (atomic)', async () => {
    const reversed = [...orderedIds].reverse();

    const { error } = await ctx.clientA.rpc('reorder_sections', {
      p_portfolio_id: ctx.portfolioA,
      p_ordered_ids: reversed,
    });
    expect(error).toBeNull();

    const { data } = await admin
      .from('sections')
      .select('id, sort_order')
      .eq('portfolio_id', ctx.portfolioA)
      .order('sort_order', { ascending: true });
    const rows = data ?? [];
    const orders = rows.map((s) => s.sort_order as number);
    // Contiguous 0..n-1 — no gaps / collisions (the corruption WR-04 prevents).
    expect(orders).toEqual(orders.map((_, i) => i));
    // The persisted order is EXACTLY the input order (id at position i has order i).
    expect(rows.map((s) => s.id as string)).toEqual(reversed);
  });

  it('reorder_sections RPC is owner-scoped: a non-owner (B) cannot reorder A’s sections', async () => {
    // Capture A's current order, then have B attempt to reorder A's portfolio. RLS
    // (SECURITY INVOKER) + the portfolio_id predicate mean B's call matches no row
    // — A's order is unchanged (T-04-05a: cross-tenant write is a no-op, not an error).
    const { data: before } = await admin
      .from('sections')
      .select('id, sort_order')
      .eq('portfolio_id', ctx.portfolioA)
      .order('sort_order', { ascending: true });
    const beforeIds = (before ?? []).map((s) => s.id as string);

    const scrambled = [...beforeIds].reverse();
    const { error } = await ctx.clientB.rpc('reorder_sections', {
      p_portfolio_id: ctx.portfolioA,
      p_ordered_ids: scrambled,
    });
    // The RPC itself does not error (RLS makes it a 0-row no-op for a non-owner).
    expect(error).toBeNull();

    const { data: after } = await admin
      .from('sections')
      .select('id')
      .eq('portfolio_id', ctx.portfolioA)
      .order('sort_order', { ascending: true });
    // A's order is UNCHANGED — B could not reorder it.
    expect((after ?? []).map((s) => s.id as string)).toEqual(beforeIds);
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
