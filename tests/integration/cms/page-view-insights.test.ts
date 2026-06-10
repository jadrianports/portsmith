// ANLY-02 / ANLY-03 / ANLY-04 — RED scaffold (Wave 0, Plan 15-01). GREENED BY 15-02
// (migration 019 adds `utm_source`/`utm_medium` columns + the five SECURITY DEFINER
// aggregate RPCs, each self-gating on `is_admin()`; the `page_views own select` RLS
// already exists from migration 004). The data-layer guarantees this proves —
// owner-only `page_views` reads, cross-tenant denial, and the per-RPC admin self-gate
// (Elevation-of-Privilege coverage) — green the moment 019 lands + `database.ts` is
// regenerated.
//
// Live-stack proof, mirroring `template-gating-admin.test.ts`:
//   setupTwoUsers (two NORMAL owners) + setupAdminUser (a role='admin' user) +
//   adminClient() (service-role) used ONLY to seed/read-back page_views rows.
//
//   (1) ANLY-02 — `page_views own select` RLS: user A's AUTHENTICATED (anon-key)
//       client reads ONLY A's own page_views rows; user B's authenticated client
//       reads ZERO of A's rows (cross-tenant denial — the tenant boundary).
//   (2) ANLY-03/04 — each of the five DEFINER aggregate RPCs, called by a NON-admin
//       authenticated client, RAISEs (the inner `IF NOT public.is_admin()` self-gate;
//       DEFINER bypasses RLS so the body owns authz); the SAME RPC called by the
//       ADMIN authenticated client returns aggregate data (a numeric total / a rows
//       array) WITHOUT error.
//
// ── WHY SKIPPED (suite stays GREEN this plan) ─────────────────────────────────
// TODAY there are NO `page_view_total_count` / `page_view_top_portfolios` /
// `page_view_daily_series` / `rate_limit_events_by_bucket` / `report_volume_series`
// RPCs (and no `utm_source`/`utm_medium` columns) — so the RPC calls error
// (function absent) for the WRONG reason vs the asserted self-gate, and the suite
// would RED against the live stack. Per the sequential-executor RED-scaffold contract
// (a RED suite blocks the next plan's gates), the contract is authored inside ONE
// wrapping `describe.skip(...)`: committed + visible, but inert — the live-stack
// fixture hooks (beforeAll/afterAll) are nested inside it, so NO real users are
// provisioned this plan. Plan 15-02 applies migration 019, regenerates `database.ts`,
// then FLIPS this single `describe.skip` → `describe` to green the whole file.
//
// `tsc --noEmit` stays 0: imports are existing fixtures only; the new-shape table/RPC
// access is untyped string table/function access (the generated `Database` type does
// not yet carry the new columns/RPCs) — exactly the 12-01 scaffold posture.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupAdminUser,
  setupTwoUsers,
  teardownAdminUser,
  teardownTwoUsers,
  type AdminUser,
  type TwoUsers,
} from './_cms-fixtures';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

// The five SECURITY DEFINER aggregate RPCs migration 019 adds (15-RESEARCH Code
// Examples §3). Each self-gates on is_admin() and returns ONLY aggregates.
const DEFINER_RPCS = [
  { name: 'page_view_total_count', args: { p_days: 30 } },
  { name: 'page_view_top_portfolios', args: { p_days: 30, p_limit: 10 } },
  { name: 'page_view_daily_series', args: { p_days: 30 } },
  { name: 'rate_limit_events_by_bucket', args: { p_days: 7 } },
  { name: 'report_volume_series', args: { p_days: 14 } },
] as const;

let ctx: TwoUsers;
let adminUser: AdminUser;

// ONE wrapping `describe.skip` so the live-stack fixture hooks (beforeAll/afterAll)
// do NOT run this plan — a hook inside a skipped describe is inert, so no real users
// are provisioned until 15-02 flips this outer `.skip` → `describe`.
describe.skip('Phase 15 Insights — page_views RLS + DEFINER RPC self-gate (GREENED BY 15-02)', () => {
  beforeAll(async () => {
    ctx = await setupTwoUsers('pvins', RUN);
    adminUser = await setupAdminUser('pvins', RUN);
  }, 45_000);

  afterAll(async () => {
    // Best-effort seed cleanup (table/columns may not exist yet — ignore errors).
    await admin.from('page_views').delete().eq('portfolio_id', ctx?.portfolioA);
    await teardownAdminUser(adminUser);
    await teardownTwoUsers(ctx);
  });

  describe('ANLY-02 — page_views own select RLS', () => {
    it('owner reads ONLY own rows; a cross-tenant client reads ZERO of them', async () => {
      // Seed three page_views rows for user A's portfolio via service-role (RLS-bypass
      // seed of the precondition — untyped string access; columns settle in 019).
      const seed = await admin.from('page_views').insert([
        { portfolio_id: ctx.portfolioA, path: `/${ctx.userA.username}` },
        { portfolio_id: ctx.portfolioA, path: `/${ctx.userA.username}/services` },
        { portfolio_id: ctx.portfolioA, path: `/${ctx.userA.username}/blog/hello` },
      ]);
      expect(seed.error).toBeNull();

      // (a) User A's AUTHENTICATED client sees its own rows (the `page_views own select`
      //     policy scopes to auth.uid()'s portfolio — D-13). No portfolio filter needed;
      //     the policy IS the boundary.
      const aRead = await ctx.clientA
        .from('page_views')
        .select('id, path, portfolio_id')
        .eq('portfolio_id', ctx.portfolioA);
      expect(aRead.error).toBeNull();
      expect((aRead.data ?? []).length).toBeGreaterThanOrEqual(3);

      // (b) User B's AUTHENTICATED client sees ZERO of A's rows (cross-tenant denial —
      //     the RLS tenant boundary). Either an RLS-filtered empty set or 0 rows.
      const bRead = await ctx.clientB
        .from('page_views')
        .select('id, path, portfolio_id')
        .eq('portfolio_id', ctx.portfolioA);
      expect((bRead.data ?? []).length).toBe(0);
    });
  });

  describe('ANLY-03/04 — DEFINER aggregate RPCs self-gate on is_admin()', () => {
    it('every DEFINER RPC RAISEs for a NON-admin caller (Elevation-of-Privilege gate)', async () => {
      // DEFINER bypasses RLS, so the inner `IF NOT public.is_admin() THEN RAISE` is the
      // ONLY authorization. A non-admin (user B) call to each RPC must carry an error.
      for (const rpc of DEFINER_RPCS) {
        const { error } = await ctx.clientB.rpc(rpc.name, rpc.args);
        expect(error, `${rpc.name} must reject a non-admin`).not.toBeNull();
      }
    });

    it('every DEFINER RPC returns aggregates (no error) for an ADMIN caller', async () => {
      // The same RPCs called by the admin authenticated client (the layout proved
      // is_admin()) succeed and return aggregate shapes — a numeric total or a rows
      // array, never raw rows.
      for (const rpc of DEFINER_RPCS) {
        const { data, error } = await adminUser.client.rpc(rpc.name, rpc.args);
        expect(error, `${rpc.name} must succeed for an admin`).toBeNull();
        // page_view_total_count → a scalar BIGINT; the rest → a TABLE (array).
        if (rpc.name === 'page_view_total_count') {
          expect(Number.isNaN(Number(data))).toBe(false);
        } else {
          expect(Array.isArray(data)).toBe(true);
        }
      }
    });

    it('rate_limit_events_by_bucket / page_view_top_portfolios return aggregate columns only (no raw rows)', async () => {
      // Aggregate-shape spot-check: top-portfolios rows carry { username, views } and
      // bucket rows carry { bucket, events } — counts/labels only, never raw page_view
      // or rate_limit_event rows (D-16 — admin reach stays narrow).
      const top = await adminUser.client.rpc('page_view_top_portfolios', {
        p_days: 30,
        p_limit: 10,
      });
      expect(top.error).toBeNull();
      for (const row of (top.data ?? []) as Array<Record<string, unknown>>) {
        expect(Object.keys(row).sort()).toEqual(['username', 'views']);
      }

      const buckets = await adminUser.client.rpc('rate_limit_events_by_bucket', { p_days: 7 });
      expect(buckets.error).toBeNull();
      for (const row of (buckets.data ?? []) as Array<Record<string, unknown>>) {
        expect(Object.keys(row).sort()).toEqual(['bucket', 'events']);
      }
    });
  });
});
