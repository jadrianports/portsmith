// GATE-02 — RED scaffold (Wave 0, Plan 12-01). GREENED BY 12-02
// (migration 011 creates `template_grants`; migration 012 enables RLS +
// `template_grants own select` (own-row SELECT) + `template_grants admin all`;
// migration 013 seeds visibility). The allowed-list shape this proves is consumed
// by 12-04 (`available-templates.ts`) — but the data-layer isolation it asserts is
// pure RLS, greened the moment 012 lands.
//
// Live-stack proof of the GATE-02 data-layer enforcement (NOT just the UI):
//
//   - `template_grants own select` ISOLATION: an admin INSERTs a grant giving
//     user A the minimal template; A's signed-in (anon-key, RLS-scoped) client
//     SELECT of `template_grants` returns EXACTLY A's row, and user B's client
//     SELECT returns ZERO of A's rows. A user can read only their OWN grants — the
//     `template_grants own select` boundary (RESEARCH Rec 2).
//   - ALLOWED-LIST contract (public ∪ granted-to-me): A's reachable set is
//     `public ∪ {minimal}` and EXCLUDES a non-granted restricted template; B's is
//     `public` only. This is the data-layer source the GATE-02 picker reads — the
//     UI shows only allowed templates because the DATA only yields allowed ones.
//
// The admin grant INSERT goes through `setupAdminUser`'s admin client (Task-1
// fixture) — the admin-RLS `template_grants admin all` write path.
//
// ── WHY RED NOW (and tsc stays 0) ─────────────────────────────────────────────
// TODAY there is NO `template_grants` table and NO `visibility` column — so the
// admin INSERT errors (relation absent), and the own-select / allowed-list reads
// have nothing to read. RED for the RIGHT reason (the asserted schema + RLS policy
// are absent), NOT an import or stack-connection error. 12-02 greens it.
//
// `tsc --noEmit` stays 0: imports are existing fixtures only; the new-shape table
// reads are untyped string table/column access (the generated `Database` type does
// not yet carry `template_grants`).
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

// Pinned literal UUIDs — MUST equal registry.ts TEMPLATE_UUIDS (registry.ts:73-80).
const MINIMAL_UUID = '00000000-0000-4000-8000-000000000001'; // PUBLIC now (migration 015 step 4)
const EDITORIAL_UUID = '00000000-0000-4000-8000-000000000002'; // public (seed D-P12-03)
const AURORA_UUID = '00000000-0000-4000-8000-000000000003'; // restricted — the GRANTED exemplar
const EDGERUNNER_UUID = '00000000-0000-4000-8000-000000000005'; // restricted, NEVER granted — the exclusion

let ctx: TwoUsers;
let adminUser: AdminUser;

beforeAll(async () => {
  ctx = await setupTwoUsers('tggrant', RUN);
  adminUser = await setupAdminUser('tggrant', RUN);

  // The admin grants user A the (restricted) aurora template, via the admin-RLS
  // `template_grants admin all` write path. (minimal is PUBLIC now — 015 step 4 — so
  // aurora is the restricted exemplar a grant is meaningful on.)
  await adminUser.client
    .from('template_grants')
    .insert({ template_id: AURORA_UUID, user_id: ctx.userA.id });
}, 45_000);

afterAll(async () => {
  await admin
    .from('template_grants')
    .delete()
    .eq('template_id', AURORA_UUID)
    .eq('user_id', ctx.userA.id);
  await teardownAdminUser(adminUser);
  await teardownTwoUsers(ctx);
});

describe('GATE-02 — template_grants own select isolation + allowed-list (GREENED BY 12-02)', () => {
  it('user A reads exactly their OWN grant row (own select)', async () => {
    const { data } = await ctx.clientA
      .from('template_grants')
      .select('template_id, user_id');
    const rows = (data ?? []) as { template_id: string; user_id: string }[];
    // A sees their aurora grant — and ONLY rows scoped to A.
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.template_id === AURORA_UUID)).toBe(true);
    for (const r of rows) expect(r.user_id).toBe(ctx.userA.id);
  });

  it('user B reads ZERO of A’s grants (cross-user isolation — the GATE-02 boundary)', async () => {
    const { data } = await ctx.clientB
      .from('template_grants')
      .select('template_id, user_id')
      .eq('user_id', ctx.userA.id); // explicitly try to read A's rows
    // RLS `template_grants own select` filters them all out for B.
    expect((data ?? []).length).toBe(0);
  });

  it('allowed-list: A reaches public ∪ {aurora}, EXCLUDES the non-granted restricted (edgerunner-v2)', async () => {
    // Public templates A can read (visibility='public'): editorial + minimal.
    const { data: pub } = await ctx.clientA
      .from('templates')
      .select('id, slug, visibility')
      .eq('is_active', true)
      .eq('visibility', 'public');
    const publicIds = new Set(((pub ?? []) as { id: string }[]).map((t) => t.id));
    expect(publicIds.has(EDITORIAL_UUID)).toBe(true); // editorial is public
    expect(publicIds.has(MINIMAL_UUID)).toBe(true); // minimal is public (015 step 4)

    // A's granted restricted templates (own grant rows → aurora).
    const { data: grants } = await ctx.clientA
      .from('template_grants')
      .select('template_id');
    const grantedIds = new Set(
      ((grants ?? []) as { template_id: string }[]).map((g) => g.template_id),
    );

    const reachable = new Set<string>([...publicIds, ...grantedIds]);
    // A's reachable set INCLUDES aurora (granted) and editorial (public)...
    expect(reachable.has(AURORA_UUID)).toBe(true);
    expect(reachable.has(EDITORIAL_UUID)).toBe(true);
    // ...and EXCLUDES edgerunner-v2 (restricted + NOT granted to A) — the GATE-02 exclusion.
    expect(reachable.has(EDGERUNNER_UUID)).toBe(false);
  });

  it('allowed-list: B reaches public only (no grants → no restricted)', async () => {
    const { data: pub } = await ctx.clientB
      .from('templates')
      .select('id, visibility')
      .eq('is_active', true)
      .eq('visibility', 'public');
    const publicIds = new Set(((pub ?? []) as { id: string }[]).map((t) => t.id));

    const { data: grants } = await ctx.clientB.from('template_grants').select('template_id');
    const grantedIds = ((grants ?? []) as { template_id: string }[]).map((g) => g.template_id);

    // B has no grants → reachable set is exactly the public templates (editorial +
    // minimal), excluding BOTH restricted templates (aurora + edgerunner-v2).
    expect(grantedIds.length).toBe(0);
    expect(publicIds.has(AURORA_UUID)).toBe(false);
    expect(publicIds.has(EDGERUNNER_UUID)).toBe(false);
    expect(publicIds.has(MINIMAL_UUID)).toBe(true); // minimal is PUBLIC now
    expect(publicIds.has(EDITORIAL_UUID)).toBe(true);
  });
});
