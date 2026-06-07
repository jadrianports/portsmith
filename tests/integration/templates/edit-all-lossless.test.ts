/**
 * 13.1-01 (Wave 0, Nyquist) — SC-1 EDIT-ALL + LOSSLESS: an UNSUPPORTED-on-the-current-
 * template section, added via the picker, survives a template switch AWAY and BACK
 * BYTE-IDENTICALLY.
 *
 * GREENED BY:
 *   - the Wave-1 `addSectionAction` plan (13.1-02) provisions the unsupported section
 *     row the picker creates (D-01/D-02: "add `services` while on `minimal`"). RED now:
 *     until that action ships, the add round-trip leaves NO `services` row, so the
 *     round-trip read-back has nothing to assert byte-identity over (the impl-driven RED).
 *   - the existing `switchTemplateAction` (mutates ONLY `portfolios.template_id`,
 *     never a content column) carries the lossless leg — proven here by the same
 *     authenticated-client switch the action uses (mirrors lossless-switch.test.ts).
 *
 * THE CONTRACT (the heart of the phase — "clamp the data, free the look"): editing is
 * exposed for EVERY form-having type regardless of the active template; the template
 * gates RENDERING only; switching never drops/hides authored content. A `services`
 * section added while on `minimal` (which doesn't render it) stays in the DB untouched,
 * and a switch away-and-back leaves its `content` JSONB byte-for-byte identical.
 *
 * ── BOUNDARY-WRITE PITFALL (mirrors lossless-switch.test.ts) ──────────────────────
 * The seed + the switch go through the AUTHENTICATED `clientA` (the RLS boundary the
 * add/switch actions use); the service-role `adminClient` is READ-BACK ONLY — never
 * the boundary write (it bypasses RLS and would prove nothing).
 *
 * (tsc stays 0 — imports only existing fixtures + a runtime variable specifier for the
 * add/switch actions, no missing static import.)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from '../cms/_cms-fixtures';

// The pinned editorial template UUID (registry TEMPLATE_UUIDS.editorial) — the
// switch-away leg. Has NO `templates` row until the P7 (008) seed migration (the same
// reason lossless-switch.test.ts is deferred), so the round-trip leg is exercised by
// the gate plan once 008 is applied.
const EDITORIAL_UUID = '00000000-0000-4000-8000-000000000002';

// The future add action + the existing switch action — runtime specifiers so this file
// documents which modules drive the EDIT-ALL/lossless path WITHOUT a missing static
// import (tsc 0). `addSectionAction` does NOT exist until 13.1-02 (the impl-driven RED).
const ADD_ACTION = '@/lib/cms/add-section-action';
const SWITCH_ACTION = '@/lib/cms/switch-template-action';

type SectionRow = {
  id: string;
  type: string;
  content: unknown;
  sort_order: number;
  visible: boolean;
};

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);
let ctx: TwoUsers;

beforeAll(async () => {
  ctx = await setupTwoUsers('editall', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

/** Read A's `services` (the unsupported-on-minimal) section rows via service-role (READ-BACK ONLY). */
async function readServices(): Promise<SectionRow[]> {
  const { data } = await admin
    .from('sections')
    .select('id, type, content, sort_order, visible')
    .eq('portfolio_id', ctx.portfolioA)
    .eq('type', 'services')
    .order('id', { ascending: true });
  return (data ?? []) as SectionRow[];
}

describe('13.1-01 — SC-1 EDIT-ALL + lossless: an unsupported added section round-trips byte-identically', () => {
  it('exposes the addSectionAction (the picker write) + switchTemplateAction (the lossless switch)', async () => {
    // RED until 13.1-02: addSectionAction is the picker's provisioning write.
    const add = (await import(/* @vite-ignore */ ADD_ACTION)) as {
      addSectionAction?: unknown;
    };
    const sw = (await import(/* @vite-ignore */ SWITCH_ACTION)) as {
      switchTemplateAction?: unknown;
    };
    expect(typeof add.addSectionAction).toBe('function');
    expect(typeof sw.switchTemplateAction).toBe('function');
  });

  it('adds an UNSUPPORTED-on-minimal `services` section (the EDIT-ALL provisioning the picker drives)', async () => {
    // D-02: you can add `services` while on `minimal` (it won't render until you switch).
    // The future addSectionAction writes this row through the same authenticated RLS
    // INSERT; the seed here mirrors that write so the lossless leg has content to assert.
    const { error } = await ctx.clientA.from('sections').insert({
      portfolio_id: ctx.portfolioA,
      type: 'services',
      content: {
        heading: 'Services',
        items: [
          { id: 's1', title: 'Consulting', description: 'Strategy', icon: 'briefcase' },
        ],
      },
      sort_order: 80,
      visible: false, // D-04: starts hidden
    });
    expect(error).toBeNull();

    // The unsupported section row is present, filled, hidden — EDIT-ALL: editable even
    // though `minimal` cannot render it.
    const rows = await readServices();
    expect(rows.length).toBe(1);
    const services = rows[0];
    expect((services.content as { items: unknown[] }).items).toHaveLength(1);
    expect(services.visible).toBe(false);
  });

  it('a switch AWAY (editorial) then BACK leaves the unsupported `services` content byte-for-byte unchanged (lossless)', async () => {
    // 1) Snapshot the services content row BEFORE the round-trip.
    const before = await readServices();
    expect(before.length).toBe(1);

    // Record A's current template so we can return to it (the home leg).
    const { data: pf0 } = await admin
      .from('portfolios')
      .select('template_id')
      .eq('user_id', ctx.userA.id)
      .single();
    const homeTemplate = pf0!.template_id;

    // 2) Switch AWAY to editorial through the AUTHENTICATED owner (the RLS boundary the
    //    switch action uses). RED until 008: EDITORIAL_UUID has no templates row → FK
    //    violation today (the lossless-switch deferral).
    const { error: awayErr } = await ctx.clientA
      .from('portfolios')
      .update({ template_id: EDITORIAL_UUID })
      .eq('user_id', ctx.userA.id);
    expect(awayErr).toBeNull();

    // 3) Switch BACK to the home template (the round-trip's second leg).
    const { error: backErr } = await ctx.clientA
      .from('portfolios')
      .update({ template_id: homeTemplate })
      .eq('user_id', ctx.userA.id);
    expect(backErr).toBeNull();

    // 4) The unsupported `services` content row is byte-for-byte identical to before —
    //    the template switch NEVER dropped or mutated the authored content (SC-1 lossless).
    const after = await readServices();
    expect(after).toEqual(before);
  });
});
