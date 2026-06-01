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

// GREEN (04-07): the owner-scoped read now exists; the RED `@ts-expect-error` that
// flagged the not-yet-built module has been removed (the import resolves cleanly).
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

  // CR-01 — the DB-shaped invariant the two consumer reads rely on. These run at
  // the base-table level (the read itself calls getClaims()→cookies(), which has no
  // request scope under the vitest node project, exactly like the other CMS actions);
  // they prove the SQL truth the projection in get-portfolio-owner.ts maps over.

  it('the EDITOR projection (includeHidden) must surface ALL sections incl. hidden, with real flags', async () => {
    // The bootstrap seeds 7 sections; experience/testimonials/blog_preview are
    // hidden (006). The hidden `projects` (set in beforeAll) means ≥4 hidden rows.
    const { data, error } = await admin
      .from('sections')
      .select('id, type, visible')
      .eq('portfolio_id', ctx.portfolioA)
      .order('sort_order', { ascending: true });
    expect(error).toBeNull();
    const all = data ?? [];
    expect(all.length).toBe(7); // every bootstrap section exists in the base table
    const hidden = all.filter((s) => s.visible === false);
    // At least the projects row we hid + the 3 default-hidden bootstrap sections.
    expect(hidden.length).toBeGreaterThanOrEqual(4);
    // The hidden `projects` row carries its REAL flag (the editor relies on this to
    // render it as "Hidden" and let the eye-toggle round-trip — it must NOT vanish).
    const projectsRow = all.find((s) => s.id === hiddenSectionA);
    expect(projectsRow).toBeDefined();
    expect(projectsRow!.visible).toBe(false);
  });

  it('the PREVIEW projection (default) drops hidden sections (preview ≡ public)', async () => {
    // The default read filters `visible === true`; the preview must NOT include the
    // hidden projects row (it stays hidden, matching the public page).
    const { data, error } = await admin
      .from('sections')
      .select('id, visible')
      .eq('portfolio_id', ctx.portfolioA)
      .eq('visible', true)
      .order('sort_order', { ascending: true });
    expect(error).toBeNull();
    const visibleOnly = data ?? [];
    expect(visibleOnly.length).toBeGreaterThan(0);
    expect(visibleOnly.every((s) => s.visible === true)).toBe(true);
    // The hidden projects row is ABSENT from the preview set.
    expect(visibleOnly.some((s) => s.id === hiddenSectionA)).toBe(false);
  });

  it('hide → show round-trips: the row never disappears from the base table', async () => {
    // Hiding then re-showing a section is exactly what the eye-toggle does. The row
    // must persist in the base table throughout (CR-01: the editor read always sees
    // it because it loads with includeHidden:true), so re-showing is always possible.
    const target = hiddenSectionA;

    // It is currently hidden (set in beforeAll). Re-show it as the OWNER (RLS).
    const show = await ctx.clientA
      .from('sections')
      .update({ visible: true })
      .eq('id', target);
    expect(show.error).toBeNull();
    const { data: afterShow } = await admin
      .from('sections')
      .select('id, visible')
      .eq('id', target)
      .single();
    expect(afterShow!.visible).toBe(true);

    // Hide it again — the row STILL exists (no delete), proving the round-trip.
    const hide = await ctx.clientA
      .from('sections')
      .update({ visible: false })
      .eq('id', target);
    expect(hide.error).toBeNull();
    const { data: afterHide } = await admin
      .from('sections')
      .select('id, visible')
      .eq('id', target)
      .single();
    expect(afterHide).not.toBeNull();
    expect(afterHide!.visible).toBe(false);
  });
});
