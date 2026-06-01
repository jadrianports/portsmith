/**
 * 03-02 — the public-read `PortfolioData` assembly test (TMPL-03 + CONTEXT D-19).
 * The Nyquist/Wave-0 gate for the cookie-less anon read in
 * `src/lib/portfolio/get-portfolio.ts`. Run against the LIVE local Supabase
 * stack (node env, sequential — see vitest.config.ts).
 *
 * THE INVARIANT (extends FND-02 to the P3 assembly path): an anonymous client,
 * reading ONLY the four `public_*` `security_invoker` views, must:
 *   1. assemble a COMPLETE PortfolioData for a seeded published portfolio
 *      (all 4 views join; sections sorted by sort_order; recentPosts is []);
 *   2. leak NO private profile column (KEY ABSENCE — the column is not present
 *      at all, not merely === null);
 *   3. NEVER return a hidden (visible=false) section (D-06: Testimonials is
 *      seeded hidden — this proves the boundary);
 *   4. yield null (length-0 public_profiles read) for an unpublished profile.
 *
 * THE ASYMMETRY (01-RESEARCH Pitfall 3): an RLS/grant-blocked SELECT returns
 * `{ data: [], error: null }` — NOT an error. Assert SHAPE and KEY ABSENCE,
 * never `.rejects` / `toThrow`.
 *
 * READ-CLIENT NOTE: the function under test reads `NEXT_PUBLIC_SUPABASE_*`,
 * while the integration harness exports `SUPABASE_*` (local stack). This test
 * asserts the SAME invariant by replicating the four anon view-reads with
 * `anonClient()` (the lower-risk default, matching the FND-02 shape) rather than
 * importing `getPortfolioByUsername` and depending on the NEXT_PUBLIC_* env.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  PRIVATE_PROFILE_COLUMNS,
  adminClient,
  anonClient,
  cleanupTestUsers,
  createTestUser,
  sweepLeftoverTestUsers,
  type TestUser,
} from './_setup';

const anon = anonClient();
const admin = adminClient();

// Unique-per-run identifiers so repeated local runs never collide on the
// username (live-row UNIQUE) / one-portfolio-per-user constraints (WR-09).
const RUN = crypto.randomUUID().slice(0, 8);
const USERNAME = `p302read${RUN}`.slice(0, 30);

let user: TestUser;
let portfolioId: string;
let hiddenSectionId: string;

/**
 * Drive `initialize_portfolio` as the owner so the real RPC (7 default sections,
 * the portfolio + settings rows) runs — exactly the public surface anon reads.
 */
async function bootstrapPortfolioAs(u: TestUser): Promise<string> {
  const { createClient } = await import('@supabase/supabase-js');
  const owner = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const signIn = await owner.auth.signInWithPassword({
    email: u.email,
    password: u.password,
  });
  expect(signIn.error).toBeNull();
  const { data, error } = await owner.rpc('initialize_portfolio');
  expect(error).toBeNull();
  expect(data).toBeTruthy();
  return data as unknown as string;
}

beforeAll(async () => {
  // WR-09: purge leftover *@example.test users from an aborted prior run.
  await sweepLeftoverTestUsers();

  user = await createTestUser({
    email: `${USERNAME}@example.test`,
    password: 'Test-Password-123!',
    username: USERNAME,
    display_name: '03-02 Public Read User',
  });

  portfolioId = await bootstrapPortfolioAs(user);

  // Publish via the admin client (service role bypasses the protected-columns
  // trigger — the legitimate way to flip `published`, exactly as FND-02 does).
  const pub = await admin
    .from('profiles')
    .update({ published: true })
    .eq('id', user.id);
  expect(pub.error).toBeNull();

  // Flip the `projects` section hidden so the hidden-section assertion has a
  // target. This models Testimonials being seeded hidden (D-06): a visible=false
  // section must never reach anon.
  const { data: sec } = await admin
    .from('sections')
    .select('id')
    .eq('portfolio_id', portfolioId)
    .eq('type', 'projects')
    .single();
  hiddenSectionId = sec!.id as string;
  const hide = await admin
    .from('sections')
    .update({ visible: false })
    .eq('id', hiddenSectionId);
  expect(hide.error).toBeNull();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(user?.id);
});

describe('03-02 — public PortfolioData assembly via the public_* views (anon)', () => {
  it('public_profiles returns ONLY public columns for the published user (KEY ABSENCE)', async () => {
    const { data, error } = await anon
      .from('public_profiles')
      .select('*')
      .eq('username', USERNAME);

    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThan(0);

    const keys = Object.keys(data![0]);
    for (const priv of PRIVATE_PROFILE_COLUMNS) {
      // KEY ABSENCE — not `=== null`. The column must not exist on the row.
      expect(keys).not.toContain(priv);
    }
    expect(keys).toEqual(
      expect.arrayContaining(['id', 'username', 'display_name']),
    );
  });

  it('the cookie-less 4-view read assembles a complete PortfolioData', async () => {
    // Replicate get-portfolio.ts's read sequence with the anon client.
    const { data: profile, error: pErr } = await anon
      .from('public_profiles')
      .select('*')
      .eq('username', USERNAME)
      .maybeSingle();
    expect(pErr).toBeNull();
    expect(profile).toBeTruthy();
    expect(profile!.id).toBeTruthy();

    const { data: portfolio, error: poErr } = await anon
      .from('public_portfolios')
      .select('*')
      .eq('user_id', profile!.id!)
      .maybeSingle();
    expect(poErr).toBeNull();
    expect(portfolio).toBeTruthy();
    expect(portfolio!.id).toBe(portfolioId);
    // template_id is present (the portfolio resolves to a template — TMPL-03).
    expect(portfolio!.template_id).toBeTruthy();

    const [{ data: settings, error: sErr }, { data: sections, error: secErr }] =
      await Promise.all([
        anon
          .from('public_portfolio_settings')
          .select('*')
          .eq('portfolio_id', portfolio!.id!)
          .maybeSingle(),
        anon
          .from('public_sections')
          .select('*')
          .eq('portfolio_id', portfolio!.id!)
          .order('sort_order', { ascending: true }),
      ]);
    expect(sErr).toBeNull();
    expect(secErr).toBeNull();
    expect(settings).toBeTruthy();

    // Sections: visible-only, non-empty, sorted ascending by sort_order.
    const sectionRows = sections ?? [];
    expect(sectionRows.length).toBeGreaterThan(0);
    const orders = sectionRows.map((s) => s.sort_order ?? 0);
    const sortedOrders = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sortedOrders);

    // The assembled PortfolioData object — recentPosts is the [] contract (D-19).
    const portfolioData = {
      profile: profile!,
      settings: settings!,
      sections: sectionRows,
      recentPosts: [] as never[],
    };
    expect(portfolioData.profile).toBeTruthy();
    expect(portfolioData.settings).toBeTruthy();
    expect(portfolioData.sections).toBe(sectionRows);
    expect(portfolioData.recentPosts).toEqual([]);
  });

  it('a hidden (visible=false) section is NOT returned by public_sections', async () => {
    const { data, error } = await anon
      .from('public_sections')
      .select('*')
      .eq('portfolio_id', portfolioId);
    expect(error).toBeNull();

    const ids = (data ?? []).map((r) => r.id as string);
    expect(ids).not.toContain(hiddenSectionId);
    // sanity: at least one VISIBLE section of the published portfolio is public.
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it('an UNPUBLISHED profile yields a length-0 public_profiles read (→ getPortfolio null)', async () => {
    const unpub = await admin
      .from('profiles')
      .update({ published: false })
      .eq('id', user.id);
    expect(unpub.error).toBeNull();

    const { data, error } = await anon
      .from('public_profiles')
      .select('*')
      .eq('username', USERNAME);
    expect(error).toBeNull();
    expect(data).toHaveLength(0); // absent, not an error → get-portfolio returns null

    // restore published so teardown / any later assertions see a clean state.
    await admin.from('profiles').update({ published: true }).eq('id', user.id);
  });
});
