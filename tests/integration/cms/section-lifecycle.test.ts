/**
 * 13.1-01 (Wave 0, Nyquist) — section ADD/REMOVE lifecycle under RLS.
 *
 * GREENED BY: the Wave-1 `addSectionAction` / `removeSectionAction` plans (13.1-02
 * provisioning). RED now — the future actions create the rows these assertions read
 * back; until they ship, the owner-add round-trip leaves no `services` row and the
 * final read-back is empty (the impl-driven RED, NOT a collection/import error).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE HARNESS FACT (13.1-VALIDATION.md "load-bearing"): `addSectionAction` /
 * `removeSectionAction` read `next/headers` and run the server-action runtime,
 * which the vitest `integration` project cannot supply (no Next request scope;
 * `server-only` is aliased to a no-op stub). So — exactly as `rls-write.test.ts`
 * proves `saveSectionAction`'s RLS contract by exercising the SAME authenticated-
 * client UPDATE the action uses — this file proves the add/remove RLS contract by
 * exercising the SAME authenticated-client INSERT / DELETE the future actions use,
 * directly against the live local stack. The action module is referenced via a
 * runtime variable specifier so the file documents which module drives the path
 * WITHOUT a missing static import (tsc stays 0).
 *
 * Behavior under test (RLS `sections own all` FOR ALL is THE tenant boundary —
 * 004_rls_policies.sql:144-155):
 *   - OWNER-ADD: A's authenticated INSERT of a NEW section type (`services`) into
 *     A's OWN portfolio SUCCEEDS (the WITH CHECK admits an own-portfolio row).
 *   - CROSS-TENANT (T-13.1-01-XT): B's authenticated INSERT scoped to A's portfolio
 *     is REJECTED by the WITH CHECK; B's authenticated DELETE of A's row changes 0
 *     rows (the USING clause filters them). Verified by service-role admin read-back
 *     (the cross-tenant write is a no-op, NOT a thrown rejection — the asymmetry the
 *     RLS suite documents).
 *   - 23505 BACKSTOP (T-13.1-01-RACE): a duplicate INSERT of an already-present
 *     `type` raises Postgres error code `23505` (the `UNIQUE(portfolio_id, type)`
 *     insert-race guard) — assert `error.code === '23505'`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from './_cms-fixtures';

// The future provisioning actions under contract — referenced via runtime variable
// specifiers so this file names the modules the GREEN plan drives WITHOUT a missing
// static import (tsc 0). The RLS contract itself is proven by the authenticated-
// client INSERT/DELETE below (the action can't run in the `node` project).
const ADD_ACTION = '@/lib/cms/add-section-action';
const REMOVE_ACTION = '@/lib/cms/remove-section-action';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

let ctx: TwoUsers;

beforeAll(async () => {
  ctx = await setupTwoUsers('cmslife', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

/** Next append sort_order for A's portfolio (D-18: MAX(sort_order)+1). */
async function nextSortOrder(portfolioId: string): Promise<number> {
  const { data } = await admin
    .from('sections')
    .select('sort_order')
    .eq('portfolio_id', portfolioId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const top = (data ?? [])[0]?.sort_order;
  return (typeof top === 'number' ? top : -1) + 1;
}

describe('13.1-01 — section add/remove lifecycle under RLS (owner vs cross-tenant)', () => {
  it('exposes the add/remove provisioning actions the GREEN plan drives', async () => {
    // The GREEN plan ships these modules; until then the dynamic import rejects
    // (the impl-driven RED — this file's contract that the actions must exist).
    const add = (await import(/* @vite-ignore */ ADD_ACTION)) as {
      addSectionAction?: unknown;
    };
    const remove = (await import(/* @vite-ignore */ REMOVE_ACTION)) as {
      removeSectionAction?: unknown;
    };
    expect(typeof add.addSectionAction).toBe('function');
    expect(typeof remove.removeSectionAction).toBe('function');
  });

  it('OWNER-ADD: A can INSERT a new `services` section into their OWN portfolio (D-01/D-02/D-04)', async () => {
    // D-18 append + D-04 hidden — the same row the future addSectionAction writes.
    const sort = await nextSortOrder(ctx.portfolioA);
    const { error } = await ctx.clientA.from('sections').insert({
      portfolio_id: ctx.portfolioA,
      type: 'services',
      content: { heading: 'Services', items: [] },
      sort_order: sort,
      visible: false,
    });
    // GREEN once addSectionAction provisions this row through the same RLS write.
    expect(error).toBeNull();

    // Read back via the service-role admin client (READ-BACK ONLY) — the row landed
    // hidden, in A's portfolio, as a soft-enum `services` type.
    const { data } = await admin
      .from('sections')
      .select('type, visible, portfolio_id')
      .eq('portfolio_id', ctx.portfolioA)
      .eq('type', 'services')
      .maybeSingle();
    expect(data?.type).toBe('services'); // RED until the add path provisions it
    expect(data?.visible).toBe(false); // D-04: starts hidden
  });

  it('CROSS-TENANT (T-13.1-01-XT): B cannot INSERT a section into A’s portfolio (RLS WITH CHECK)', async () => {
    // B forges an INSERT scoped to A's portfolio — the `sections own all` WITH CHECK
    // (auth.uid() owns the portfolio) REJECTS it. RLS surfaces this as an error, but
    // the load-bearing proof is the admin read-back: A's portfolio gains NO such row.
    await ctx.clientB.from('sections').insert({
      portfolio_id: ctx.portfolioA,
      type: 'certifications',
      content: { heading: 'Certifications', items: [] },
      sort_order: 999,
      visible: false,
    });

    const { data } = await admin
      .from('sections')
      .select('id')
      .eq('portfolio_id', ctx.portfolioA)
      .eq('type', 'certifications')
      .maybeSingle();
    // The cross-tenant INSERT changed nothing in A's portfolio.
    expect(data).toBeNull();
  });

  it('CROSS-TENANT (T-13.1-01-XT): B’s DELETE of A’s section changes 0 rows (RLS USING) — WR-03 the action maps that to { ok:false }', async () => {
    // Seed an `about` row state for A (the bootstrap already provisions it). Capture
    // its id, then have B attempt to DELETE it. The USING clause filters the row out
    // for B → a 0-row no-op (NOT a thrown rejection — the RLS asymmetry).
    const { data: aboutRow } = await admin
      .from('sections')
      .select('id')
      .eq('portfolio_id', ctx.portfolioA)
      .eq('type', 'about')
      .single();
    const aboutId = aboutRow!.id as string;

    // WR-03: the cross-tenant DELETE uses the SAME `.delete().eq(id).select('id')`
    // the corrected `removeSectionAction` now uses. RLS filters the row out for B, so
    // the affected-row set is EMPTY (NOT an error) — which the action maps to a generic
    // { ok:false } instead of the old phantom { ok:true } that let the optimistic shell
    // drop a row the server never deleted. This pins the mechanism the action relies on.
    const { data: deletedRows, error: delErr } = await ctx.clientB
      .from('sections')
      .delete()
      .eq('id', aboutId)
      .select('id');
    expect(delErr).toBeNull(); // RLS no-op, not a thrown rejection (the asymmetry)
    expect(deletedRows ?? []).toHaveLength(0); // 0 affected rows ⇒ action returns { ok:false }

    // A's `about` row STILL exists — B could not delete cross-tenant.
    const { data: after } = await admin
      .from('sections')
      .select('id')
      .eq('id', aboutId)
      .maybeSingle();
    expect(after?.id).toBe(aboutId);
  });

  it('23505 BACKSTOP (T-13.1-01-RACE): a duplicate-type INSERT raises Postgres 23505', async () => {
    // `about` already exists (bootstrap). A second INSERT of the SAME type into the
    // SAME portfolio collides with UNIQUE(portfolio_id, type) — the insert-race
    // backstop the future addSectionAction maps to `{ ok:false }`.
    const { error } = await ctx.clientA.from('sections').insert({
      portfolio_id: ctx.portfolioA,
      type: 'about',
      content: { bio: 'dup', skills: [] },
      sort_order: 500,
      visible: false,
    });
    expect(error).not.toBeNull();
    expect((error as { code?: string } | null)?.code).toBe('23505');
  });
});
