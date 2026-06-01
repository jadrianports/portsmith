/**
 * CMS-01 / D-P4-07 — new-account bootstrap, proven against the live local stack.
 *
 * The dashboard RSC calls `ensurePortfolio()` (src/lib/cms/bootstrap-portfolio.ts)
 * on every load; it wraps the SECURITY DEFINER, idempotent `initialize_portfolio`
 * RPC. This spec proves the contract that action relies on, driving the RPC as a
 * real authenticated user (the same surface the server action uses under RLS):
 *
 *   1. FIRST call creates exactly one portfolio + one settings row + the 7
 *      default sections with the documented types / sort_order / visible flags.
 *   2. The seeded placeholder content is the ENRICHED, NEUTRAL D-P4-07 set
 *      (migration 006): a `[Your Name]` edit-me token (NOT a fake persona), a
 *      fuller about bio, a contact subheading, and a SECOND realistic project —
 *      with NO fake name/photo identity.
 *   3. SECOND call is IDEMPOTENT — same portfolio id, no duplicate sections.
 *
 * This is the GREEN of the Wave-0 CMS-01 row (04-VALIDATION.md). It requires
 * migration 006 to be APPLIED to the live local stack (the [BLOCKING] Task 2),
 * otherwise the enriched-content assertions fail at runtime — a false-positive
 * guard: tsc + the generated types pass without the push, but this does not.
 *
 * LOCAL STACK ONLY — `*@example.test` is a reserved test domain; `_setup.ts`
 * reads local-stack creds only and never touches production.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  adminClient,
  cleanupTestUsers,
  createTestUser,
  sweepLeftoverTestUsers,
  type TestUser,
} from '../_setup';

const admin = adminClient();
// WR-09: collision-proof per-run token so an aborted prior run can't wedge
// createTestUser via a colliding username.
const RUN = crypto.randomUUID().slice(0, 8);

// Documented default sections + visible/hidden flags
// (002_functions_triggers.sql / 006 — body-only change preserves these):
// hero/about/projects/contact visible; experience/testimonials/blog_preview hidden.
const EXPECTED_SECTIONS: Record<string, boolean> = {
  hero: true,
  about: true,
  projects: true,
  experience: false,
  testimonials: false,
  contact: true,
  blog_preview: false,
};

// Canonical single-scroll sort_order (0-based, contiguous) the RPC seeds.
const EXPECTED_SORT_ORDER: Record<string, number> = {
  hero: 0,
  about: 1,
  projects: 2,
  experience: 3,
  testimonials: 4,
  contact: 5,
  blog_preview: 6,
};

let user: TestUser;
let owner: SupabaseClient;
let portfolioId: string;

async function signIn(u: TestUser): Promise<SupabaseClient> {
  const c = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await c.auth.signInWithPassword({
    email: u.email,
    password: u.password,
  });
  expect(error).toBeNull();
  return c;
}

beforeAll(async () => {
  // WR-09: purge leftover *@example.test users from an aborted prior run.
  await sweepLeftoverTestUsers();
  const name = `boot${RUN}`.slice(0, 30);
  user = await createTestUser({
    email: `${name}@example.test`,
    password: 'Test-Password-123!',
    username: name,
    display_name: 'Bootstrap User',
  });
  owner = await signIn(user);
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(user?.id);
});

describe('initialize_portfolio — first call seeds a populated, neutral 7-section portfolio (CMS-01 / D-P4-07)', () => {
  it('creates exactly one portfolio + one settings row + 7 sections with the documented flags and sort_order', async () => {
    const { data, error } = await owner.rpc('initialize_portfolio');
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    portfolioId = data as unknown as string;

    // Exactly one portfolio for the user, and it's the returned id.
    const { data: portfolios } = await admin
      .from('portfolios')
      .select('id')
      .eq('user_id', user.id);
    expect(portfolios).toHaveLength(1);
    expect(portfolios![0].id).toBe(portfolioId);

    // Exactly one settings row.
    const { data: settings } = await admin
      .from('portfolio_settings')
      .select('portfolio_id')
      .eq('portfolio_id', portfolioId);
    expect(settings).toHaveLength(1);

    // The 7 default sections with the documented visible/hidden flags + sort_order.
    const { data: sections } = await admin
      .from('sections')
      .select('type, visible, sort_order')
      .eq('portfolio_id', portfolioId);
    expect(sections).toHaveLength(7);

    const visibleByType = Object.fromEntries(
      (sections ?? []).map((s) => [s.type as string, s.visible as boolean]),
    );
    expect(Object.keys(visibleByType).sort()).toEqual(
      Object.keys(EXPECTED_SECTIONS).sort(),
    );
    for (const [type, visible] of Object.entries(EXPECTED_SECTIONS)) {
      expect(visibleByType[type]).toBe(visible);
    }

    // sort_order is the contiguous 0..6 canonical order.
    const sortByType = Object.fromEntries(
      (sections ?? []).map((s) => [s.type as string, s.sort_order as number]),
    );
    for (const [type, order] of Object.entries(EXPECTED_SORT_ORDER)) {
      expect(sortByType[type]).toBe(order);
    }
  });

  it('seeds the ENRICHED, NEUTRAL placeholder content from migration 006 — no fake identity (D-P4-07)', async () => {
    const { data: sections, error } = await admin
      .from('sections')
      .select('type, content')
      .eq('portfolio_id', portfolioId);
    expect(error).toBeNull();

    const byType = Object.fromEntries(
      (sections ?? []).map((s) => [
        s.type as string,
        s.content as Record<string, unknown>,
      ]),
    );

    // Hero keeps the NEUTRAL [Your Name] edit-me token — NOT a fake persona.
    const heroHeading = String(byType.hero?.heading ?? '');
    expect(heroHeading).toContain('[Your Name]');

    // About bio is the enriched, fuller generic introduction (006), not the
    // terse Phase-1 stub. Proven by length + a phrase unique to the 006 copy.
    const aboutBio = String(byType.about?.bio ?? '');
    expect(aboutBio.length).toBeGreaterThan(120);
    expect(aboutBio).toContain('turns ideas into');

    // Contact keeps its subheading (present since 002, preserved by 006).
    const contactSub = String(byType.contact?.subheading ?? '');
    expect(contactSub.length).toBeGreaterThan(0);

    // Projects now reads as a populated showcase: a SECOND realistic project.
    const projectItems = (byType.projects?.items ?? []) as Array<
      Record<string, unknown>
    >;
    expect(projectItems.length).toBeGreaterThanOrEqual(2);
    const projectTitles = projectItems.map((p) => String(p.title ?? ''));
    expect(projectTitles).toContain('A Second Project');

    // NO fake identity leaked into the placeholder content anywhere.
    const allContent = JSON.stringify(sections ?? []);
    expect(allContent).not.toMatch(/avatar_url|photo_url/i);
  });
});

describe('initialize_portfolio — second call is idempotent (CMS-01)', () => {
  it('returns the SAME portfolio id and creates no duplicate portfolio/sections', async () => {
    const { data, error } = await owner.rpc('initialize_portfolio');
    expect(error).toBeNull();
    expect(data as unknown as string).toBe(portfolioId);

    // Still exactly one portfolio and 7 sections — no duplication.
    const { data: portfolios } = await admin
      .from('portfolios')
      .select('id')
      .eq('user_id', user.id);
    expect(portfolios).toHaveLength(1);

    const { data: sections } = await admin
      .from('sections')
      .select('id')
      .eq('portfolio_id', portfolioId);
    expect(sections).toHaveLength(7);
  });
});
