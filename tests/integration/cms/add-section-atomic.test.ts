// D-12 / WR-02 — the ATOMIC append RPC (migration 020) the addSectionAction now
// calls. Today the action used to read MAX(sort_order)+1 then INSERT in a separate
// statement; two near-simultaneous "Add section" clicks could both read the same
// MAX and produce a non-deterministic rail/public order (there is NO
// UNIQUE(portfolio_id, sort_order) constraint — only UNIQUE(portfolio_id, type) —
// so equal sort_order values never ERROR; the failure mode is non-deterministic
// ORDER, not a DB error). The single-statement `INSERT … SELECT MAX(sort_order)+1`
// closes that race.
//
// This drives the `add_section` RPC DIRECTLY as the owner (clientA) — the PRIMITIVE,
// allowed in the node `integration` project. The cookie-reading `addSectionAction`
// calls `getVerifiedClaims()` and so cannot run directly here (the cookie-context
// constraint, 17-PATTERNS § Integration-test harness); the e2e suite covers the
// real-action-through-real-cookies path. Driving the RPC as the OWNER proves it
// (a) is owner-callable under SECURITY INVOKER RLS, (b) appends at a distinct
// contiguous sort_order even under concurrency, and (c) still trips the orthogonal
// UNIQUE(portfolio_id, type) → 23505 on a duplicate type.
//
// Requires the local Supabase stack with migration 020 applied (Plan 17-03 Task 2).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from './_cms-fixtures';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

let ctx: TwoUsers;

/** Read every section's sort_order for a portfolio, ascending. */
async function readOrders(portfolioId: string): Promise<number[]> {
  const { data } = await admin
    .from('sections')
    .select('sort_order')
    .eq('portfolio_id', portfolioId)
    .order('sort_order', { ascending: true });
  return (data ?? []).map((s) => s.sort_order as number);
}

/** The current MAX(sort_order) for a portfolio (-1 if empty). */
async function maxOrder(portfolioId: string): Promise<number> {
  const orders = await readOrders(portfolioId);
  return orders.length === 0 ? -1 : Math.max(...orders);
}

beforeAll(async () => {
  ctx = await setupTwoUsers('addatomic', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('D-12 — add_section appends atomically with distinct contiguous sort_order', () => {
  it('two CONCURRENT add_section RPCs yield distinct, contiguous sort_order (no duplicate)', async () => {
    // A freshly-bootstrapped portfolio seeds a known set of types; capture the
    // starting MAX so the assertion is independent of the exact bootstrap count.
    const startMax = await maxOrder(ctx.portfolioA);
    const seedContent = { heading: 'X', items: [] };

    // Two distinct, currently-absent addable types fired CONCURRENTLY as the owner.
    // If the read+insert were non-atomic, both could read `startMax` and land on the
    // SAME sort_order (startMax+1) — the corruption this RPC prevents.
    const [r1, r2] = await Promise.all([
      ctx.clientA.rpc('add_section', {
        p_portfolio_id: ctx.portfolioA,
        p_type: 'education',
        p_content: seedContent,
      }),
      ctx.clientA.rpc('add_section', {
        p_portfolio_id: ctx.portfolioA,
        p_type: 'certifications',
        p_content: seedContent,
      }),
    ]);

    // Both inserts SUCCEEDED (each returns the new row id under SECURITY INVOKER RLS).
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();
    expect(typeof r1.data).toBe('string');
    expect(typeof r2.data).toBe('string');

    // The two new sections occupy DISTINCT sort_order values — the appended pair is
    // exactly {startMax+1, startMax+2}, contiguous with no collision.
    const { data: newRows } = await admin
      .from('sections')
      .select('type, sort_order')
      .eq('portfolio_id', ctx.portfolioA)
      .in('type', ['education', 'certifications'])
      .order('sort_order', { ascending: true });
    const newOrders = (newRows ?? []).map((s) => s.sort_order as number);
    expect(newOrders).toEqual([startMax + 1, startMax + 2]);

    // No two sections in the whole portfolio share a sort_order, and the full set is
    // contiguous 0..n-1 — the rail/public order is deterministic after concurrent adds.
    const allOrders = await readOrders(ctx.portfolioA);
    expect(new Set(allOrders).size).toBe(allOrders.length); // no duplicates
    expect(allOrders).toEqual(allOrders.map((_, i) => i)); // contiguous 0..n-1
  });

  it('adding a type the portfolio already has raises 23505 (UNIQUE(portfolio_id, type) — the orthogonal axis)', async () => {
    // `hero` is part of the bootstrap seed, so a second `hero` collides with
    // UNIQUE(portfolio_id, type). The atomic-append RPC does NOT change that axis —
    // it only changes how sort_order is computed.
    const before = await readOrders(ctx.portfolioA);

    const { error } = await ctx.clientA.rpc('add_section', {
      p_portfolio_id: ctx.portfolioA,
      p_type: 'hero',
      p_content: { heading: 'Dup' },
    });

    // The RPC raises the Postgres unique_violation (23505) — the action maps this to
    // ALREADY_PRESENT; here we assert the raw collision the map depends on.
    expect(error).not.toBeNull();
    expect((error as { code?: string } | null)?.code).toBe('23505');

    // The failed insert left the portfolio's order untouched (no partial write).
    const after = await readOrders(ctx.portfolioA);
    expect(after).toEqual(before);
  });
});
