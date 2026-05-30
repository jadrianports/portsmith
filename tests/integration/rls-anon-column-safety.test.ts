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
  type TestUser,
} from './_setup';

const anon = anonClient();
const admin = adminClient();

// Unique-per-run identifiers so repeated local runs never collide on the
// username UNIQUE / one-portfolio-per-user constraints.
const RUN = Date.now().toString(36);
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
