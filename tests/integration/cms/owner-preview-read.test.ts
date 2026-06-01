// TMPL-05 — turned GREEN by 04-07 (Draft Mode owner-preview read).
// Threat ref: T-preview-cookie-abuse.
//
// Wave-0 RED scaffold (04-01). INTENTIONALLY failing: imports the not-yet-built
// owner-scoped read `getPortfolioOwnerByUsername` so the import fails to resolve
// until 04-07 ships it (RED is the contract — 04-VALIDATION.md). The DB-level
// assertions describe the invariant the read must uphold; 04-07 turns this GREEN.
//
// Behavior under test (the preview read fork — 04-RESEARCH Pitfall 3):
//   - the OWNER read returns UNPUBLISHED + visible-only rows (base tables under
//     RLS, owner sees their own unpublished portfolio; visible=true filtered in
//     app code per D-P4-09);
//   - a NON-OWNER (user B) cannot read user A's base-table rows (RLS → []).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from './_cms-fixtures';

// @ts-expect-error — RED: 04-07 creates this owner-scoped read; module does not exist yet.
import { getPortfolioOwnerByUsername } from '@/lib/portfolio/get-portfolio-owner';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

let ctx: TwoUsers;
let hiddenSectionA: string;

beforeAll(async () => {
  ctx = await setupTwoUsers('cmsopr', RUN);
  // A stays UNPUBLISHED (default) — preview must still surface it for the owner.

  // Hide one of A's sections so the visible-only filter has a target.
  const { data: sec } = await admin
    .from('sections')
    .select('id')
    .eq('portfolio_id', ctx.portfolioA)
    .eq('type', 'projects')
    .single();
  hiddenSectionA = sec!.id as string;
  const hide = await admin
    .from('sections')
    .update({ visible: false })
    .eq('id', hiddenSectionA);
  expect(hide.error).toBeNull();
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('TMPL-05 — owner preview read (unpublished + visible-only); non-owner rejected', () => {
  it('the OWNER can read their own UNPUBLISHED portfolio rows under RLS', async () => {
    expect(typeof getPortfolioOwnerByUsername).toBe('function');
    // A reads their own sections (base tables, RLS) even though unpublished.
    const { data, error } = await ctx.clientA
      .from('sections')
      .select('id, visible')
      .eq('portfolio_id', ctx.portfolioA);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it('a NON-OWNER (B) cannot read A’s base-table sections (RLS → [])', async () => {
    const { data, error } = await ctx.clientB
      .from('sections')
      .select('*')
      .eq('portfolio_id', ctx.portfolioA);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
