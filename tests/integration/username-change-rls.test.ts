/**
 * HANDLE-03 — the sanctioned onboarded-username-change RLS boundary (Wave-0 RED).
 *
 * Phase 30 adds a SIBLING of migration 026's `set_onboarding_username`: a
 * `change_username(new_username)` SECURITY DEFINER RPC scoped to the caller's OWN
 * ALREADY-ONBOARDED row (`onboarded_at IS NOT NULL`), plus a new sanctioned
 * short-circuit clause in `enforce_protected_profile_columns` honoring the
 * txn-local `portsmith.sanctioned_username_change` GUC. The RPC also writes a
 * `username_history` row atomically in the same transaction (30-RESEARCH.md, the
 * RPC sketch lines 71-132 + trigger clause 138-153).
 *
 * This file asserts the FINAL HANDLE-03 contract. It is RED now because migration
 * 027 (the `change_username` RPC + the sanctioned clause + the `username_history`
 * table) does not exist yet — every RPC call below errors with a missing-function
 * reference, and the protected-column snapshot proves the trigger clause holds.
 *
 * The FIVE behaviors pinned (30-01-PLAN.md Task 1):
 *   1. sanctioned RPC swap — an onboarded owner's `change_username` succeeds and
 *      `profiles.username` is updated;
 *   2. a RAW authenticated `.from('profiles').update({ username })` is STILL
 *      rejected by the trigger (the GUC sanction is the only path);
 *   3. the RPC cannot change ANY OTHER protected column — role/email/
 *      storage_used_bytes/locked are byte-for-byte unchanged across the call
 *      (clause (d): `IS NOT DISTINCT FROM OLD`);
 *   4. cross-user — caller A cannot change caller B's handle (auth.uid() own-row
 *      → B's row sees 0 updates);
 *   5. the no-op — `change_username` to the CURRENT handle writes NO
 *      `username_history` row and leaves `username` unchanged.
 *
 * ERROR-SHAPE NOTE (mirrors the other RLS suites): a trigger RAISE / a missing
 * function surfaces as a NON-NULL PostgREST error; we assert on OUTCOME (row state
 * / error presence), never on the exact message text. These run against the LIVE
 * local Supabase stack — no DB stubbing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  adminClient,
  cleanupTestUsers,
  createTestUser,
  sweepLeftoverTestUsers,
  type TestUser,
} from './_setup';

const admin = adminClient();
// WR-09: collision-proof per-run token (see _setup.ts sweepLeftoverTestUsers).
const RUN = crypto.randomUUID().slice(0, 8);

const createdIds: string[] = [];

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

/**
 * Create a test user and stamp it ONBOARDED (`onboarded_at` non-null) — the
 * eligibility window the change_username RPC requires (`onboarded_at IS NOT NULL`,
 * the complement of set_onboarding_username). `onboarded_at` is NOT a protected
 * column, so the owner writes it directly under RLS (onboarding-publish precedent).
 */
async function createOnboardedUser(
  label: string,
  handle: string,
): Promise<{ user: TestUser; client: SupabaseClient }> {
  const user = await createTestUser({
    email: `${handle}@example.test`,
    password: 'Test-Password-123!',
    username: handle,
    display_name: label,
  });
  createdIds.push(user.id);
  const client = await signIn(user);
  const { error } = await client
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', user.id);
  expect(error).toBeNull();
  return { user, client };
}

beforeAll(async () => {
  await sweepLeftoverTestUsers();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(...createdIds.filter(Boolean));
});

describe('HANDLE-03 — the sanctioned change_username RPC swaps an onboarded owner handle', () => {
  it('an onboarded owner can change_username; profiles.username is updated', async () => {
    const handle = `h3a${RUN}`.slice(0, 30);
    const next = `h3a2${RUN}`.slice(0, 30);
    const { user, client } = await createOnboardedUser('HANDLE-03 swap', handle);

    const { error } = await client.rpc('change_username', { new_username: next });
    expect(error).toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    expect(data!.username).toBe(next);
  });
});

describe('HANDLE-03 — a RAW authenticated UPDATE of username is STILL blocked by the trigger', () => {
  it('owner direct UPDATE username is rejected; username unchanged (GUC unset on this path)', async () => {
    const handle = `h3raw${RUN}`.slice(0, 30);
    const { user, client } = await createOnboardedUser('HANDLE-03 raw', handle);

    // No sanction GUC is set on a plain client UPDATE — the protected-columns
    // trigger must reject it exactly as it does for set_onboarding_username's window.
    const { error } = await client
      .from('profiles')
      .update({ username: `h3rawx${RUN}`.slice(0, 30) })
      .eq('id', user.id)
      .select();
    expect(error).not.toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    expect(data!.username).toBe(handle);
  });
});

describe('HANDLE-03 — the RPC cannot change ANY other protected column (clause (d) holds)', () => {
  it('role/email/storage_used_bytes/locked are byte-for-byte unchanged across change_username', async () => {
    const handle = `h3pc${RUN}`.slice(0, 30);
    const next = `h3pc2${RUN}`.slice(0, 30);
    const { user, client } = await createOnboardedUser('HANDLE-03 protected', handle);

    // Snapshot every OTHER protected column BEFORE the sanctioned change.
    const before = await admin
      .from('profiles')
      .select('role, email, storage_used_bytes, locked')
      .eq('id', user.id)
      .single();
    expect(before.error).toBeNull();

    const { error } = await client.rpc('change_username', { new_username: next });
    expect(error).toBeNull();

    // After the swap, ONLY username moved — clause (d) (IS NOT DISTINCT FROM OLD)
    // pins every other protected column.
    const after = await admin
      .from('profiles')
      .select('username, role, email, storage_used_bytes, locked')
      .eq('id', user.id)
      .single();
    expect(after.error).toBeNull();
    expect(after.data!.username).toBe(next); // the one mutable column moved
    expect(after.data!.role).toBe(before.data!.role);
    expect(after.data!.email).toBe(before.data!.email);
    expect(after.data!.storage_used_bytes).toBe(before.data!.storage_used_bytes);
    expect(after.data!.locked).toBe(before.data!.locked);
  });
});

describe('HANDLE-03 — cross-user: A cannot change another user handle (auth.uid() own-row)', () => {
  it('A change_username does NOT mutate B username (0 rows on B row)', async () => {
    const handleA = `h3xa${RUN}`.slice(0, 30);
    const handleB = `h3xb${RUN}`.slice(0, 30);
    const { client: clientA } = await createOnboardedUser('HANDLE-03 cross A', handleA);
    const { user: userB } = await createOnboardedUser('HANDLE-03 cross B', handleB);

    // A drives the RPC under A's own session. The RPC is scoped to auth.uid() —
    // it can ONLY touch A's own row, never B's, regardless of the argument value.
    // Even if A tries to grab a free handle, B's row is untouched.
    await clientA.rpc('change_username', { new_username: `h3xfree${RUN}`.slice(0, 30) });

    const { data } = await admin
      .from('profiles')
      .select('username')
      .eq('id', userB.id)
      .single();
    // B's handle is exactly what B started with — A could not mutate it.
    expect(data!.username).toBe(handleB);
  });
});

describe('HANDLE-03 — the no-op: change to the CURRENT handle writes no history and changes nothing', () => {
  it('change_username to the current handle leaves username unchanged and writes no username_history row', async () => {
    const handle = `h3noop${RUN}`.slice(0, 30);
    const { user, client } = await createOnboardedUser('HANDLE-03 no-op', handle);

    const { error } = await client.rpc('change_username', { new_username: handle });
    expect(error).toBeNull();

    // Username unchanged.
    const { data: prof } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    expect(prof!.username).toBe(handle);

    // No history row was written for a no-op (the cooldown is the action's concern;
    // the RPC RETURNs before any INSERT — 30-RESEARCH.md RPC sketch line 101).
    const { count } = await admin
      .from('username_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    expect(count ?? 0).toBe(0);
  });
});
