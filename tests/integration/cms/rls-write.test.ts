// CMS-02/03/04 — turned GREEN by 04-03 (the section save action under RLS).
// Threat ref: T-cross-tenant-write.
//
// Wave-0 RED scaffold (04-01). INTENTIONALLY failing: it imports the not-yet-built
// `saveSectionAction` so the import fails to resolve until 04-03 ships it (RED is
// the contract — 04-VALIDATION.md). The DB-level RLS assertions below describe the
// invariant the action must uphold; 04-03 turns this file GREEN (action + the
// owner-succeeds / cross-tenant-rejected proof against the live local stack).
//
// Behavior under test (RLS is THE tenant boundary):
//   - user A's authenticated UPDATE on their OWN section SUCCEEDS;
//   - user A's UPDATE targeting user B's section is REJECTED (0 rows changed) —
//     verified by reading B's row back with the service-role admin client.
//
// THE ASYMMETRY (01-RESEARCH Pitfall 3): a blocked UPDATE silently affects 0 rows
// (the USING clause filters them) — assert "no row changed" via admin read-back,
// never `.rejects`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from './_cms-fixtures';

// @ts-expect-error — RED: 04-03 creates this server action; module does not exist yet.
import { saveSectionAction } from '@/lib/cms/save-section-action';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

let ctx: TwoUsers;
let sectionA: string;
let sectionB: string;

beforeAll(async () => {
  ctx = await setupTwoUsers('cmswr', RUN);

  const { data: secA } = await admin
    .from('sections')
    .select('id')
    .eq('portfolio_id', ctx.portfolioA)
    .eq('type', 'hero')
    .single();
  sectionA = secA!.id as string;

  const { data: secB } = await admin
    .from('sections')
    .select('id')
    .eq('portfolio_id', ctx.portfolioB)
    .eq('type', 'hero')
    .single();
  sectionB = secB!.id as string;
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('CMS-02/03/04 — section write under RLS (owner vs cross-tenant)', () => {
  it('A can UPDATE their OWN section', async () => {
    // Reference the action so 04-03 wires the real save path here.
    expect(typeof saveSectionAction).toBe('function');
    const { error } = await ctx.clientA
      .from('sections')
      .update({ content: { heading: 'A owns this' } })
      .eq('id', sectionA)
      .select();
    expect(error).toBeNull();

    const { data } = await admin
      .from('sections')
      .select('content')
      .eq('id', sectionA)
      .single();
    expect((data!.content as Record<string, unknown>).heading).toBe('A owns this');
  });

  it("A's UPDATE of B's section changes nothing (cross-tenant REJECTED)", async () => {
    await ctx.clientA
      .from('sections')
      .update({ content: { hacked: true } })
      .eq('id', sectionB);

    const { data } = await admin
      .from('sections')
      .select('content')
      .eq('id', sectionB)
      .single();
    expect((data!.content as Record<string, unknown>).hacked).toBeUndefined();
  });
});
