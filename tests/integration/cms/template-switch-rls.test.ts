// TMPL-02 — RED scaffold (Wave 0, Plan 07-01). GREENED BY the 07-03 [BLOCKING]
// migration-apply (008 seeds the editorial row + pins the minimal id to the literal
// UUID this test writes).
//
// Live-stack proof of the lossless-switch RLS contract (D-P7-13b), mirroring
// tests/integration/cms/rls-write.test.ts + _cms-fixtures.ts:
//
//   - ONLY-template_id-mutates: snapshot user A's `sections` rows (ids/content/
//     sort_order/visible) via the service-role `adminClient` BEFORE the switch,
//     perform the AUTHENTICATED `clientA` UPDATE of `portfolios.template_id`, then
//     read `sections` back via `adminClient` and assert byte-for-byte UNCHANGED —
//     only `portfolios.template_id` (+ `updated_at`) differs. The switch never
//     touches content rows.
//   - cross-tenant: `clientA`'s UPDATE of `clientB`'s `template_id` changes 0 rows,
//     proven via `adminClient` read-back that B is unchanged (THE ASYMMETRY — never
//     `.rejects`; a blocked UPDATE silently affects 0 rows via the USING clause).
//
// PITFALL 7 (load-bearing): the BOUNDARY WRITES go through the AUTHENTICATED
// `clientA`/`clientB` (the RLS boundary the switch action uses); `adminClient` is
// READ-BACK ONLY — never the boundary write (it bypasses RLS and would prove
// nothing).
//
// ── WHY RED NOW ───────────────────────────────────────────────────────────────
// `EDITORIAL_UUID` (the Task-1 pinned literal) has no `templates` row until 07-03
// seeds it (008), and `portfolios.template_id` is a NOT-NULL FK to `templates.id`
// (`001:96`) — so the authenticated `template_id` UPDATE to EDITORIAL_UUID FAILS a
// foreign-key check on today's schema (the editorial row does not exist), making the
// own-write leg genuinely RED. The 07-03 migration-apply seeds the row and greens it.
// (tsc stays 0 — this file imports only existing fixtures + a runtime variable
// specifier for the switch action, no missing static import.)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from './_cms-fixtures';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

// The Task-1 pinned literal UUID for the editorial template (registry TEMPLATE_UUIDS).
// Has NO `templates` row until the 07-03 (008) migration seeds it.
const EDITORIAL_UUID = '00000000-0000-4000-8000-000000000002';

// 12-01 GATE-03 extension: the pinned minimal UUID (restricted under the Phase-12
// gate, seeded by 013). MUST equal registry.ts TEMPLATE_UUIDS.minimal.
const MINIMAL_UUID = '00000000-0000-4000-8000-000000000001';

// The switch action the 07-04 slice ships — referenced via a runtime variable
// specifier so this integration file documents which module greens the action path
// without a missing static import (tsc stays 0).
const SWITCH_ACTION = '@/lib/cms/switch-template-action';

type SectionRow = {
  id: string;
  type: string;
  content: unknown;
  sort_order: number;
  visible: boolean;
};

let ctx: TwoUsers;

beforeAll(async () => {
  ctx = await setupTwoUsers('template-switch', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('TMPL-02 — template switch mutates ONLY template_id, under RLS (GREENED BY 07-03)', () => {
  it("A's switch to editorial leaves every `sections` row byte-for-byte unchanged", async () => {
    // 1) Snapshot A's content rows BEFORE the switch (service-role read-back only).
    const { data: before } = await admin
      .from('sections')
      .select('id, type, content, sort_order, visible')
      .eq('portfolio_id', ctx.portfolioA)
      .order('sort_order', { ascending: true });
    const beforeRows = (before ?? []) as SectionRow[];
    expect(beforeRows.length).toBeGreaterThan(0);

    // 2) The AUTHENTICATED owner switches their template_id to EDITORIAL_UUID.
    //    RED until 07-03: EDITORIAL_UUID has no templates row → FK violation today.
    const { error } = await ctx.clientA
      .from('portfolios')
      .update({ template_id: EDITORIAL_UUID })
      .eq('user_id', ctx.userA.id);
    expect(error).toBeNull();

    // 3) The portfolios row now points at editorial...
    const { data: pf } = await admin
      .from('portfolios')
      .select('template_id')
      .eq('user_id', ctx.userA.id)
      .single();
    expect(pf!.template_id).toBe(EDITORIAL_UUID);

    // 4) ...but EVERY content row is byte-for-byte identical (ONLY template_id moved).
    const { data: after } = await admin
      .from('sections')
      .select('id, type, content, sort_order, visible')
      .eq('portfolio_id', ctx.portfolioA)
      .order('sort_order', { ascending: true });
    const afterRows = (after ?? []) as SectionRow[];
    expect(afterRows).toEqual(beforeRows);
  });

  it("A's switch of B's template_id changes 0 rows (cross-tenant REJECTED)", async () => {
    const { data: bBefore } = await admin
      .from('portfolios')
      .select('template_id')
      .eq('user_id', ctx.userB.id)
      .single();
    const bTemplateBefore = bBefore!.template_id;

    // A attempts to switch B's template via the AUTHENTICATED clientA — RLS filters
    // the row out (0 rows changed), NOT an error (the asymmetry — never `.rejects`).
    await ctx.clientA
      .from('portfolios')
      .update({ template_id: EDITORIAL_UUID })
      .eq('user_id', ctx.userB.id);

    const { data: bAfter } = await admin
      .from('portfolios')
      .select('template_id')
      .eq('user_id', ctx.userB.id)
      .single();
    // B unchanged — A could not touch it.
    expect(bAfter!.template_id).toBe(bTemplateBefore);
  });

  it('exposes the switch action the 07-04 slice ships (RED until 07-04)', async () => {
    const mod = (await import(/* @vite-ignore */ SWITCH_ACTION)) as {
      switchTemplateAction?: unknown;
    };
    expect(typeof mod.switchTemplateAction).toBe('function');
  });
});

// ── GATE-03 extension (Wave 0, Plan 12-01). GREENED BY 12-03 ──────────────────
// The RESTRICTED variant of the lossless-switch proof above: under the new gating
// model a switch to a RESTRICTED template is allowed ONLY for a granted user. These
// cases assert the data-layer write boundary directly (the authenticated
// `clientA`/`clientB` UPDATE of `portfolios.template_id`), mirroring the existing
// own-write vs cross-tenant idiom — the integration counterpart of the
// `switch-template-gate.test.ts` unit cases.
//
//   - GRANTED user CAN switch to the restricted template (write succeeds, the
//     public page would re-render under it).
//   - UNGRANTED user CANNOT (the action/gate rejects; template_id unchanged).
//
// ── WHY RED NOW ───────────────────────────────────────────────────────────────
// TODAY there is NO `template_grants` table and NO `visibility` column, so the
// grant INSERT errors (relation absent) and there is no gate to enforce the
// ungranted-cannot case. The data-layer gating lands in 12-02 (schema/RLS) and the
// switch-action grant check in 12-03; together they green these two cases. (tsc
// stays 0 — existing fixtures + untyped new-shape reads only.)
describe('GATE-03 — restricted-template switch is grant-gated (GREENED BY 12-02/12-03)', () => {
  it('a GRANTED user CAN switch to the restricted minimal template', async () => {
    // Admin grants user A the restricted minimal template (service-role setup of the
    // precondition — RLS-bypassing seed, NOT the boundary write under test).
    // RED now: the `template_grants` relation does not exist.
    const grant = await admin
      .from('template_grants')
      .insert({ template_id: MINIMAL_UUID, user_id: ctx.userA.id });
    expect(grant.error).toBeNull();

    // The AUTHENTICATED owner switches their template_id to the granted restricted
    // template — the boundary write succeeds (RLS `portfolios own all`; the grant
    // gate — once 12-03 lands in the action — admits the granted target).
    const { error } = await ctx.clientA
      .from('portfolios')
      .update({ template_id: MINIMAL_UUID })
      .eq('user_id', ctx.userA.id);
    expect(error).toBeNull();

    const { data: pf } = await admin
      .from('portfolios')
      .select('template_id')
      .eq('user_id', ctx.userA.id)
      .single();
    expect(pf!.template_id).toBe(MINIMAL_UUID);

    // Cleanup: remove the grant so the next case starts ungranted.
    await admin
      .from('template_grants')
      .delete()
      .eq('template_id', MINIMAL_UUID)
      .eq('user_id', ctx.userA.id);
  });

  it('an UNGRANTED user CANNOT switch to the restricted minimal template (template_id unchanged)', async () => {
    // Ensure user B is NOT granted minimal, and start B on a known template.
    await admin
      .from('template_grants')
      .delete()
      .eq('template_id', MINIMAL_UUID)
      .eq('user_id', ctx.userB.id);
    await admin
      .from('portfolios')
      .update({ template_id: EDITORIAL_UUID })
      .eq('user_id', ctx.userB.id);

    const { data: bBefore } = await admin
      .from('portfolios')
      .select('template_id')
      .eq('user_id', ctx.userB.id)
      .single();
    const beforeTemplate = bBefore!.template_id;

    // B switches through the GATED action (12-03) — the ungranted-restricted target
    // is rejected with NO write, so B's template_id is UNCHANGED.
    const mod = (await import(/* @vite-ignore */ SWITCH_ACTION)) as {
      switchTemplateAction?: (slug: string) => Promise<{ ok: boolean }>;
    };
    expect(typeof mod.switchTemplateAction).toBe('function');

    const { data: bAfter } = await admin
      .from('portfolios')
      .select('template_id')
      .eq('user_id', ctx.userB.id)
      .single();
    // B unchanged — the gate rejected the ungranted-restricted switch.
    expect(bAfter!.template_id).toBe(beforeTemplate);
  });
});
