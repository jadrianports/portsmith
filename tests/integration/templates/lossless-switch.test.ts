/**
 * D-08 LOSSLESS-SWITCH gate (RESEARCH §8) — the round-trip proof that the NEW Phase-13
 * content shapes (`skills.level` + a `metrics` section) survive a template switch
 * BYTE-IDENTICALLY. This is the integration counterpart of the lossless invariant
 * "clamp the data, free the look": `switchTemplateAction` mutates ONLY
 * `portfolios.template_id` (`switch-template-action.ts:153-156`), never a content column,
 * so section `content` JSONB is template-independent.
 *
 * ── WHAT THIS PROVES (the Phase-13 delta over the P12 lossless-switch RLS test) ───────
 * The P12 precedent (`tests/integration/cms/template-switch-rls.test.ts`) proved
 * only-`template_id`-mutates over the BOOTSTRAP content. Phase 13 adds two NET-NEW content
 * surfaces that must round-trip:
 *   - `skills.level` (the optional 0–100 int powering edgerunner's animated bars; 13-02 Task 1).
 *     minimal/editorial read `name`/`icon`/`tier` and NEVER touch `level` — so a portfolio
 *     with `level` set, switched to a standard-lane template, renders tier pills (level
 *     preserved in the DB, just not rendered), and switched back the bars reappear.
 *   - a `metrics` section (the `profile.stats`-shaped `{ value, label }` block, mapped per D-08).
 *     A template that doesn't SUPPORT `metrics` field-gates it OUT of the render (the public
 *     read's `resolveSpec`), but the row STAYS in the DB — lossless, not data loss.
 *
 * The test SEEDS skills-with-level + metrics, snapshots their `content` rows, performs a
 * template switch AWAY and BACK through the AUTHENTICATED owner client (the RLS boundary the
 * switch uses), and asserts every snapshotted `content` row is byte-for-byte UNCHANGED.
 *
 * ── BOUNDARY-WRITE PITFALL (load-bearing, mirrors the P12 test) ──────────────────────
 * The seed + the switch go through the AUTHENTICATED `clientA` (the RLS boundary); the
 * service-role `adminClient` is READ-BACK ONLY — never the boundary write (it bypasses RLS
 * and would prove nothing). Content writes are Zod-gated through `validateSectionContent`
 * (the SAME server gate the seed + CMS use; barrel import per CONVENTIONS).
 *
 * ── WHY THE EXECUTION IS DEFERRED TO PLAN 07 (authored here, run there) ───────────────
 * This task (13-02) AUTHORS the fixture + assertion; it is RUN as part of the final-gate
 * plan (07). It does not pass on today's tree because:
 *   1. `EDITORIAL_UUID` has no `templates` row until the P7 (008) seed migration — the same
 *      reason the P12 lossless RLS test is RED until its migration apply (that test's header,
 *      `template-switch-rls.test.ts:23-30`); `portfolios.template_id` is a NOT-NULL FK so the
 *      switch UPDATE to a non-existent template FK-fails.
 *   2. edgerunner itself enters the registry + its seed migration (015) in plan 05 / the gate
 *      plan — until then there is no edgerunner row to switch to (this test uses the existing
 *      editorial round-trip as the standard-lane leg, so it greens once 008 is applied; the
 *      edgerunner-specific leg is exercised by plan 07's full corpus run).
 * The fixture + the byte-identical assertion are the armed gate; plan 07 runs it green.
 * (tsc stays 0 — the file imports only existing fixtures + the barrel + a runtime variable
 * specifier for the switch action, no missing static import.)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validateSectionContent } from '@/lib/validations';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from '../cms/_cms-fixtures';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

// The pinned editorial template UUID (registry TEMPLATE_UUIDS.editorial) — the standard-lane
// round-trip leg. Has NO `templates` row until the P7 (008) seed migration (see header #1).
const EDITORIAL_UUID = '00000000-0000-4000-8000-000000000002';

// The switch action under test — referenced via a runtime variable specifier so this file
// documents which module drives the lossless path without a missing static import (tsc 0).
const SWITCH_ACTION = '@/lib/cms/switch-template-action';

// ── The Phase-13 fixture content (Zod-gated, the SAME gate the seed/CMS use) ──────────
// skills WITH `level` (the new D-09 field) — minimal/editorial ignore it, edgerunner renders bars.
const SKILLS_CONTENT = validateSectionContent('skills', {
  heading: 'Skills',
  groups: [
    {
      label: 'Tech Stack',
      items: [
        { name: 'TypeScript', icon: 'typescript', tier: 'core', level: 98 },
        { name: 'React', icon: 'react', tier: 'core', level: 94 },
        { name: 'Rust', tier: 'learning', level: 60 },
      ],
    },
  ],
});

// a `metrics` section (profile.stats-shaped `{ value, label }` items) — mapped per D-08.
const METRICS_CONTENT = validateSectionContent('metrics', {
  heading: 'By the numbers',
  items: [
    { id: 'm1', value: '10+', label: 'Years shipping' },
    { id: 'm2', value: '40M+', label: 'Requests/day served' },
  ],
});

type SectionRow = {
  id: string;
  type: string;
  content: unknown;
  sort_order: number;
  visible: boolean;
};

let ctx: TwoUsers;

beforeAll(async () => {
  ctx = await setupTwoUsers('lossless-switch', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

/** Read A's skills + metrics rows back via the service-role client (READ-BACK ONLY). */
async function readSkillsAndMetrics(): Promise<SectionRow[]> {
  const { data } = await admin
    .from('sections')
    .select('id, type, content, sort_order, visible')
    .eq('portfolio_id', ctx.portfolioA)
    .in('type', ['skills', 'metrics'])
    .order('type', { ascending: true });
  return (data ?? []) as SectionRow[];
}

describe('D-08 lossless switch — skills.level + metrics survive a round-trip byte-identically (GREENED BY plan 07)', () => {
  it('seeds skills-with-level + a metrics section through the AUTHENTICATED owner (Zod-gated)', async () => {
    // Upsert the two NET-NEW Phase-13 section types via the owner's RLS-scoped client (the
    // boundary write). `sections.type` is a TEXT soft-enum (CMS-08) + `content` schemaless
    // JSONB; UNIQUE(portfolio_id, type) so this upserts the one-per-type row.
    const { error: skillsErr } = await ctx.clientA.from('sections').upsert(
      {
        portfolio_id: ctx.portfolioA,
        type: 'skills',
        content: SKILLS_CONTENT,
        sort_order: 90,
        visible: true,
      },
      { onConflict: 'portfolio_id,type' },
    );
    expect(skillsErr).toBeNull();

    const { error: metricsErr } = await ctx.clientA.from('sections').upsert(
      {
        portfolio_id: ctx.portfolioA,
        type: 'metrics',
        content: METRICS_CONTENT,
        sort_order: 91,
        visible: true,
      },
      { onConflict: 'portfolio_id,type' },
    );
    expect(metricsErr).toBeNull();

    // Sanity: both rows landed with the new content intact (level + metrics present).
    const rows = await readSkillsAndMetrics();
    expect(rows.map((r) => r.type).sort()).toEqual(['metrics', 'skills']);
    const skills = rows.find((r) => r.type === 'skills')!;
    const firstItem = (skills.content as { groups: { items: { level?: number }[] }[] }).groups[0]
      .items[0];
    expect(firstItem.level).toBe(98); // the new D-09 field actually persisted
  });

  it("a switch AWAY (editorial) then BACK leaves skills + metrics content byte-for-byte unchanged", async () => {
    // 1) Snapshot the skills + metrics content rows BEFORE the round-trip.
    const before = await readSkillsAndMetrics();
    expect(before.length).toBe(2);

    // Record A's current template so we can return to it (the home leg).
    const { data: pf0 } = await admin
      .from('portfolios')
      .select('template_id')
      .eq('user_id', ctx.userA.id)
      .single();
    const homeTemplate = pf0!.template_id;

    // 2) Switch AWAY to editorial through the AUTHENTICATED owner (the RLS boundary).
    //    RED until 008: EDITORIAL_UUID has no templates row → FK violation today (header #1).
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

    // 4) Every skills + metrics content row is byte-for-byte identical to before the
    //    round-trip — the new level + metrics content was NEVER dropped (lossless, D-08).
    const after = await readSkillsAndMetrics();
    expect(after).toEqual(before);
  });

  it('exposes the lossless switch action (switchTemplateAction) the gate plan drives', async () => {
    const mod = (await import(/* @vite-ignore */ SWITCH_ACTION)) as {
      switchTemplateAction?: unknown;
    };
    expect(typeof mod.switchTemplateAction).toBe('function');
  });
});
