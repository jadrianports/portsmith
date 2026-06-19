/**
 * SHOW-05 — the `public_showcase_profiles` view presence/absence contract
 * (Wave-0 RED scaffold, Plan 31-01). Run against the LIVE local Supabase stack
 * (node env, sequential — see vitest.config.ts).
 *
 * THE INVARIANT (SHOW-05 / D-08 drop-out / D-14 launch population): an
 * opted-in + published + non-locked + non-deleted profile APPEARS in the
 * `public_showcase_profiles` anon read; opting out, unpublishing, locking, or
 * soft-deleting it DROPS it back OUT. The eligibility predicate lives in the
 * `profile_is_showcased` SECURITY DEFINER helper (31-RESEARCH Q2) so the
 * `security_invoker = true` view filters on the private `published`/`locked`/
 * `deleted_at`/`showcase_opt_in` columns WITHOUT anon needing column privileges.
 *
 * THE ASYMMETRY (mirrors rls-anon-column-safety.test.ts): an RLS/grant-blocked
 * or filtered-out read returns `{ data: [], error: null }` — NOT an error. So we
 * assert PRESENCE (length > 0) / ABSENCE (length 0), never `.rejects`/`toThrow`.
 *
 * ── WHY RED NOW ───────────────────────────────────────────────────────────────
 * Migration 028 (the `showcase_opt_in` column + `profile_is_showcased` helper +
 * the `public_showcase_profiles` view + anon GRANT) does NOT exist yet. Every
 * anon read of `public_showcase_profiles` errors with "relation ... does not
 * exist", and the admin write of `{ showcase_opt_in: true }` errors with
 * "column ... does not exist". This file is the requirement→behavior contract;
 * Plan 31-02 lands migration 028 and turns it GREEN. Do NOT implement the view
 * here.
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
// username (live-row UNIQUE) / one-portfolio-per-user constraints.
// WR-09: collision-proof per-run token (see _setup.ts sweepLeftoverTestUsers).
const RUN = crypto.randomUUID().slice(0, 8);
const A_USERNAME = `show05a${RUN}`.slice(0, 30);

let userA: TestUser;
let portfolioA: string;

/**
 * Drive `initialize_portfolio` as the owner so the real RPC (the portfolio +
 * settings + sections rows) runs — exactly the public surface the showcase
 * reads. Returns the created portfolio id.
 */
async function bootstrapPortfolioAs(user: TestUser): Promise<string> {
  const { createClient } = await import('@supabase/supabase-js');
  const owner = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const signIn = await owner.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  expect(signIn.error).toBeNull();
  const { data, error } = await owner.rpc('initialize_portfolio');
  expect(error).toBeNull();
  expect(data).toBeTruthy();
  return data as unknown as string;
}

/** True iff A's row is currently in the anon showcase view. */
async function aInShowcase(): Promise<boolean> {
  const { data, error } = await anon
    .from('public_showcase_profiles')
    .select('*')
    .eq('id', userA.id);
  // A filtered-out / blocked read is `{ data: [], error: null }`; a missing
  // relation (RED, pre-028) surfaces a non-null error → treat as "not present".
  if (error) return false;
  return (data ?? []).length > 0;
}

beforeAll(async () => {
  // WR-09: purge leftover *@example.test users from an aborted prior run.
  await sweepLeftoverTestUsers();
  userA = await createTestUser({
    email: `${A_USERNAME}@example.test`,
    password: 'Test-Password-123!',
    username: A_USERNAME,
    display_name: 'SHOW-05 User A',
  });

  portfolioA = await bootstrapPortfolioAs(userA);
  expect(portfolioA).toBeTruthy();

  // Make A the eligible baseline: published + opted-in (via the admin/service
  // client, which bypasses the protected-columns trigger). `showcase_opt_in` is
  // the NOT-YET-EXISTING column (migration 028) — this write is RED until 028.
  await admin.from('profiles').update({ published: true }).eq('id', userA.id);
  await admin
    .from('profiles')
    .update({ showcase_opt_in: true })
    .eq('id', userA.id);
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(userA?.id);
});

describe('SHOW-05 — public_showcase_profiles presence on the eligibility flips', () => {
  it('an opted-in + published + non-locked + non-deleted profile APPEARS', async () => {
    // baseline restored at top of each presence test
    await admin
      .from('profiles')
      .update({
        showcase_opt_in: true,
        published: true,
        locked: false,
        deleted_at: null,
      })
      .eq('id', userA.id);

    expect(await aInShowcase()).toBe(true);
  });

  it('opting OUT (showcase_opt_in = false) DROPS the profile out (D-08)', async () => {
    await admin
      .from('profiles')
      .update({ showcase_opt_in: false })
      .eq('id', userA.id);
    expect(await aInShowcase()).toBe(false);
    await admin
      .from('profiles')
      .update({ showcase_opt_in: true })
      .eq('id', userA.id);
  });

  it('UNPUBLISHING (published = false) DROPS the profile out', async () => {
    await admin.from('profiles').update({ published: false }).eq('id', userA.id);
    expect(await aInShowcase()).toBe(false);
    await admin.from('profiles').update({ published: true }).eq('id', userA.id);
  });

  it('LOCKING (locked = true) DROPS the profile out (admin kill-switch)', async () => {
    await admin.from('profiles').update({ locked: true }).eq('id', userA.id);
    expect(await aInShowcase()).toBe(false);
    await admin.from('profiles').update({ locked: false }).eq('id', userA.id);
  });

  it('soft-DELETING (deleted_at set) DROPS the profile out', async () => {
    await admin
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userA.id);
    expect(await aInShowcase()).toBe(false);
    await admin.from('profiles').update({ deleted_at: null }).eq('id', userA.id);
  });

  it('an opted-OUT-by-default profile is NOT in the showcase (default off, D-06)', async () => {
    // A fresh profile defaults showcase_opt_in = false; prove the view excludes it.
    await admin
      .from('profiles')
      .update({ showcase_opt_in: false, published: true })
      .eq('id', userA.id);
    expect(await aInShowcase()).toBe(false);
    await admin
      .from('profiles')
      .update({ showcase_opt_in: true })
      .eq('id', userA.id);
  });
});

describe('SHOW-05 — public_showcase_profiles leaks NO private column to anon (KEY ABSENCE)', () => {
  it('returns ONLY public columns for an eligible profile (no PRIVATE_PROFILE_COLUMNS key)', async () => {
    await admin
      .from('profiles')
      .update({
        showcase_opt_in: true,
        published: true,
        locked: false,
        deleted_at: null,
      })
      .eq('id', userA.id);

    const { data, error } = await anon
      .from('public_showcase_profiles')
      .select('*')
      .eq('id', userA.id);

    // Once 028 lands, A is eligible so the row MUST be visible.
    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThan(0);

    const keys = Object.keys(data![0]);
    for (const priv of PRIVATE_PROFILE_COLUMNS) {
      // KEY ABSENCE — not `=== null`. The private column must not exist at all.
      expect(keys).not.toContain(priv);
    }
    // sanity: the public surface the carousel/explore card needs IS present.
    expect(keys).toEqual(
      expect.arrayContaining(['id', 'username', 'display_name']),
    );
  });
});
