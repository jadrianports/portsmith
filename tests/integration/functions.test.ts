/**
 * T3 database functions — the bootstrap + history behavior the rest of the app
 * relies on, proven against the live local stack.
 *
 *  - handle_new_user: creating an auth user (via admin.createUser with
 *    user_metadata) fires the AFTER INSERT trigger on auth.users and provisions
 *    the matching `profiles` row.
 *  - initialize_portfolio: SECURITY DEFINER RPC, IDEMPOTENT (returns the same
 *    portfolio id on re-call, never duplicates) and creates exactly one
 *    portfolio + one portfolio_settings + the 7 default sections with the
 *    documented visible/hidden flags.
 *  - save_section_history: BEFORE UPDATE OF content prunes each section's history
 *    to the 10 most-recent rows.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  adminClient,
  cleanupTestUsers,
  createTestUser,
  type TestUser,
} from './_setup';

const admin = adminClient();
const RUN = Date.now().toString(36);

// Documented default sections + visible/hidden flags (002_functions_triggers.sql
// initialize_portfolio): hero/about/projects/contact visible;
// experience/testimonials/blog_preview hidden.
const EXPECTED_SECTIONS: Record<string, boolean> = {
  hero: true,
  about: true,
  projects: true,
  experience: false,
  testimonials: false,
  contact: true,
  blog_preview: false,
};

let userA: TestUser;
let ownerA: SupabaseClient;

async function signIn(user: TestUser): Promise<SupabaseClient> {
  const c = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await c.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  expect(error).toBeNull();
  return c;
}

beforeAll(async () => {
  const name = `fns${RUN}`.slice(0, 30);
  userA = await createTestUser({
    email: `${name}@example.test`,
    password: 'Test-Password-123!',
    username: name,
    display_name: 'Functions User A',
  });
  ownerA = await signIn(userA);
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(userA?.id);
});

describe('handle_new_user — profile provisioned on signup', () => {
  it('creates a matching profiles row from user_metadata', async () => {
    const { data, error } = await admin
      .from('profiles')
      .select('id, username, display_name, email, role, published')
      .eq('id', userA.id)
      .single();
    expect(error).toBeNull();
    expect(data!.username).toBe(userA.username);
    expect(data!.display_name).toBe(userA.display_name);
    expect(data!.email).toBe(userA.email);
    expect(data!.role).toBe('user'); // default, not admin
    expect(data!.published).toBe(false); // default unpublished
  });
});

describe('initialize_portfolio — idempotent bootstrap + 7 sections', () => {
  let portfolioId: string;

  it('first call creates a portfolio + settings + 7 sections', async () => {
    const { data, error } = await ownerA.rpc('initialize_portfolio');
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    portfolioId = data as unknown as string;

    // Exactly one portfolio for the user.
    const { data: portfolios } = await admin
      .from('portfolios')
      .select('id')
      .eq('user_id', userA.id);
    expect(portfolios).toHaveLength(1);
    expect(portfolios![0].id).toBe(portfolioId);

    // Exactly one settings row.
    const { data: settings } = await admin
      .from('portfolio_settings')
      .select('portfolio_id')
      .eq('portfolio_id', portfolioId);
    expect(settings).toHaveLength(1);

    // The 7 default sections with the documented visible/hidden flags.
    const { data: sections } = await admin
      .from('sections')
      .select('type, visible')
      .eq('portfolio_id', portfolioId);
    expect(sections).toHaveLength(7);

    const byType = Object.fromEntries(
      (sections ?? []).map((s) => [s.type as string, s.visible as boolean]),
    );
    expect(Object.keys(byType).sort()).toEqual(
      Object.keys(EXPECTED_SECTIONS).sort(),
    );
    for (const [type, visible] of Object.entries(EXPECTED_SECTIONS)) {
      expect(byType[type]).toBe(visible);
    }
  });

  it('second call is idempotent — same id, no duplicate rows', async () => {
    const { data, error } = await ownerA.rpc('initialize_portfolio');
    expect(error).toBeNull();
    expect(data as unknown as string).toBe(portfolioId);

    // Still exactly one portfolio and 7 sections.
    const { data: portfolios } = await admin
      .from('portfolios')
      .select('id')
      .eq('user_id', userA.id);
    expect(portfolios).toHaveLength(1);

    const { data: sections } = await admin
      .from('sections')
      .select('id')
      .eq('portfolio_id', portfolioId);
    expect(sections).toHaveLength(7);
  });
});

describe('save_section_history — prunes to the 10 most-recent rows', () => {
  it('caps history at 10 after >10 content changes', async () => {
    // Use the owner's own portfolio + hero section.
    const { data: hero } = await admin
      .from('sections')
      .select('id, portfolio_id')
      .eq('type', 'hero')
      .in(
        'portfolio_id',
        (
          await admin.from('portfolios').select('id').eq('user_id', userA.id)
        ).data!.map((p) => p.id),
      )
      .single();
    const sectionId = hero!.id as string;

    // 15 distinct content edits => 15 BEFORE-UPDATE captures, pruned to 10.
    for (let i = 0; i < 15; i++) {
      const { error } = await ownerA
        .from('sections')
        .update({ content: { heading: `v${i}`, subheading: `edit ${i}` } })
        .eq('id', sectionId);
      expect(error).toBeNull();
    }

    const { data: history, error } = await admin
      .from('section_history')
      .select('id')
      .eq('section_id', sectionId);
    expect(error).toBeNull();
    expect((history ?? []).length).toBeLessThanOrEqual(10);
    // And it actually captured history (the trigger fired at all).
    expect((history ?? []).length).toBeGreaterThan(0);
  });
});
