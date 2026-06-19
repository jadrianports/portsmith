/**
 * FND-02 — the signature negative anon-column-read test ("if only one test
 * defines done, it is this one" — 01-CONTEXT D-08). Run against the LIVE local
 * Supabase stack (node env, sequential — see vitest.config.ts).
 *
 * THE INVARIANT: an anonymous client — through the `public_*` security_invoker
 * views AND via a crafted `select=*` straight at the base `profiles` table —
 * must NEVER see any private column (email / role / storage_used_bytes / locked
 * / locked_reason / deleted_at / created_at), and must NEVER see an
 * unpublished / locked / soft-deleted profile or a hidden (visible=false)
 * section.
 *
 * THE ASYMMETRY (01-RESEARCH Pitfall 3): an RLS/grant-blocked SELECT returns
 * `{ data: [], error: null }` — NOT an error. So we assert SHAPE and KEY
 * ABSENCE on returned rows, never `.rejects` / `toThrow`. KEY ABSENCE means the
 * key is not present at all (`Object.keys(row)` excludes it), not that its value
 * is null — a null value would still be a leak of the column's existence/shape.
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
const A_USERNAME = `fnd02a${RUN}`.slice(0, 30);

let userA: TestUser;
let portfolioA: string;
let hiddenSectionId: string;

/**
 * Drive `initialize_portfolio` as the owner so the real RPC (7 sections, the
 * portfolio + settings rows) runs — exactly the public surface anon will read.
 * Returns the created portfolio id.
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

beforeAll(async () => {
  // WR-09: purge leftover *@example.test users from an aborted prior run.
  await sweepLeftoverTestUsers();
  userA = await createTestUser({
    email: `${A_USERNAME}@example.test`,
    password: 'Test-Password-123!',
    username: A_USERNAME,
    display_name: 'FND-02 User A',
  });

  portfolioA = await bootstrapPortfolioAs(userA);

  // Publish A via the admin client (service role bypasses the protected-columns
  // trigger, so this is the legitimate way to flip `published`).
  const pub = await admin
    .from('profiles')
    .update({ published: true })
    .eq('id', userA.id);
  expect(pub.error).toBeNull();

  // Grab a section id to make hidden; the projects section is visible=true by
  // default — flip it hidden so we can assert hidden sections never go public.
  const { data: sec } = await admin
    .from('sections')
    .select('id')
    .eq('portfolio_id', portfolioA)
    .eq('type', 'projects')
    .single();
  hiddenSectionId = sec!.id as string;
  const hide = await admin
    .from('sections')
    .update({ visible: false })
    .eq('id', hiddenSectionId);
  expect(hide.error).toBeNull();

  // SHOW-05 (Phase 31, Wave-0 RED): opt A INTO the showcase via the service role
  // so the new `public_showcase_profiles` anon read returns A's row (and we can
  // assert its KEY ABSENCE). `showcase_opt_in` is the NOT-YET-EXISTING column
  // (migration 028) — this write is RED until 028 lands. Best-effort so the
  // existing FND-02 assertions above still run on a pre-028 tree: a failure here
  // only affects the new SHOW-05 describe block below.
  await admin
    .from('profiles')
    .update({ showcase_opt_in: true })
    .eq('id', userA.id);
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(userA?.id);
});

describe('FND-02 — anon column safety (the signature negative test)', () => {
  it('public_profiles returns ONLY public columns for a published user (KEY ABSENCE)', async () => {
    const { data, error } = await anon
      .from('public_profiles')
      .select('*')
      .eq('id', userA.id);

    // A blocked read would be []; here A is published so it MUST be visible.
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

  it('crafted select=* on the BASE profiles table leaks no private key to anon', async () => {
    // With the column GRANT (005), a base `select('*')` resolves to the granted
    // public columns only; an RLS/grant block would instead return []. Either
    // way, NO private key may appear on any returned row.
    const { data } = await anon.from('profiles').select('*');
    for (const row of data ?? []) {
      const keys = Object.keys(row);
      for (const priv of PRIVATE_PROFILE_COLUMNS) {
        expect(keys).not.toContain(priv);
      }
    }
  });

  it('anon cannot read an UNPUBLISHED profile via public_profiles', async () => {
    const unpub = await admin
      .from('profiles')
      .update({ published: false })
      .eq('id', userA.id);
    expect(unpub.error).toBeNull();

    const { data, error } = await anon
      .from('public_profiles')
      .select('*')
      .eq('id', userA.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(0); // absent, not an error

    // restore published for the subsequent locked/deleted assertions
    await admin.from('profiles').update({ published: true }).eq('id', userA.id);
  });

  it('anon cannot read a LOCKED profile via public_profiles', async () => {
    await admin.from('profiles').update({ locked: true }).eq('id', userA.id);

    const { data } = await anon
      .from('public_profiles')
      .select('*')
      .eq('id', userA.id);
    expect(data).toHaveLength(0);

    await admin.from('profiles').update({ locked: false }).eq('id', userA.id);
  });

  it('anon cannot read a soft-DELETED profile via public_profiles', async () => {
    await admin
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userA.id);

    const { data } = await anon
      .from('public_profiles')
      .select('*')
      .eq('id', userA.id);
    expect(data).toHaveLength(0);

    await admin.from('profiles').update({ deleted_at: null }).eq('id', userA.id);
  });

  it('a hidden (visible=false) section is NOT returned by public_sections', async () => {
    // A is published again at this point; the projects section was hidden in setup.
    const { data, error } = await anon
      .from('public_sections')
      .select('*')
      .eq('portfolio_id', portfolioA);
    expect(error).toBeNull();

    const ids = (data ?? []).map((r) => r.id as string);
    expect(ids).not.toContain(hiddenSectionId);
    // sanity: at least one VISIBLE section of A's published portfolio is public
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});

/**
 * SHOW-05 (Phase 31, Wave-0 RED) — the NEW `public_showcase_profiles` view must
 * never leak a private column to anon. This clones the FND-02 per-view
 * KEY-ABSENCE block above for the showcase view: an anon read of an eligible
 * (opted-in + published + non-locked) profile must expose ONLY the public
 * columns — every `PRIVATE_PROFILE_COLUMNS` key (email / role /
 * storage_used_bytes / locked / locked_reason / deleted_at / created_at, plus
 * the implicitly-private updated_at / user_id) must be ABSENT from the returned
 * object, exactly as the existing `public_profiles` block proves for the public
 * portfolio read (31-RESEARCH Q2 / Pitfall 3).
 *
 * RED until Plan 31-02 lands migration 028 (the `public_showcase_profiles`
 * `security_invoker` view + the `profile_is_showcased` DEFINER helper + the anon
 * GRANT). Today the relation does not exist → the anon read returns a non-null
 * PGRST205 error and an empty result, so the eligible-row assertion fails. Do NOT
 * modify the FND-02 `public_profiles` / `public_sections` blocks above — their
 * staying-green is the no-regression half.
 */
describe('SHOW-05 — public_showcase_profiles exposes NO private column to anon (KEY ABSENCE)', () => {
  it('an eligible showcase profile returns ONLY public columns (no PRIVATE_PROFILE_COLUMNS key)', async () => {
    const { data, error } = await anon
      .from('public_showcase_profiles')
      .select('*')
      .eq('id', userA.id);

    // A is opted-in + published + non-locked in setup, so once 028 lands the row
    // MUST be visible (a blocked/filtered read would be [], a missing relation a
    // non-null error — both fail here, which is the RED contract pre-028).
    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThan(0);

    const keys = Object.keys(data![0]);
    for (const priv of PRIVATE_PROFILE_COLUMNS) {
      // KEY ABSENCE — not `=== null`. The private column must not exist at all.
      expect(keys).not.toContain(priv);
    }
    // updated_at + user_id are private too (not in the 7-col public SELECT).
    expect(keys).not.toContain('updated_at');
    expect(keys).not.toContain('user_id');
    // sanity: the public surface the Explore card needs IS present.
    expect(keys).toEqual(
      expect.arrayContaining(['id', 'username', 'display_name']),
    );
  });
});
