/**
 * FND-03 — protected-column immutability. RLS decides WHICH ROWS a user may
 * touch; the `enforce_protected_profile_columns` BEFORE UPDATE trigger decides
 * WHICH COLUMNS within the user's OWN row. A non-admin owner attempting to
 * change any of the 8 protected columns must be rejected by the trigger's
 * `RAISE EXCEPTION 'Attempt to modify a protected profile column'`.
 *
 * THE ASYMMETRY (01-RESEARCH): unlike a blocked SELECT (which returns
 * `{ data: [], error: null }`), a trigger RAISE surfaces as a NON-NULL `error`.
 * So here we assert `error` is non-null and its message matches
 * /protected profile column/i — the opposite shape from the cross-tenant SELECT
 * assertions. We add `.select()` so PostgREST returns the error to the client.
 *
 * The trigger must NOT over-block: a NON-protected column (display_name) still
 * updates successfully for the owner.
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

let userA: TestUser;
let ownerA: SupabaseClient;

// The 8 protected columns + a changed value of the correct type for each.
// (username, role, locked, locked_reason, storage_used_bytes, deleted_at,
//  email, created_at — see enforce_protected_profile_columns in 002.)
const PROTECTED_UPDATES: Array<[string, Record<string, unknown>]> = [
  ['username', { username: `hijacked-${RUN}`.slice(0, 30) }],
  ['role', { role: 'admin' }],
  ['locked', { locked: true }],
  ['locked_reason', { locked_reason: 'self-set reason' }],
  // Must DIFFER from the default 0 — the trigger uses IS DISTINCT FROM, so a
  // no-op (0 -> 0) correctly does NOT raise. Use a non-zero value.
  ['storage_used_bytes', { storage_used_bytes: 999999 }],
  ['deleted_at', { deleted_at: new Date().toISOString() }],
  ['email', { email: `new-${RUN}@example.test` }],
  ['created_at', { created_at: '2000-01-01T00:00:00.000Z' }],
];

beforeAll(async () => {
  const name = `fnd03${RUN}`.slice(0, 30);
  userA = await createTestUser({
    email: `${name}@example.test`,
    password: 'Test-Password-123!',
    username: name,
    display_name: 'FND-03 User A',
  });
  ownerA = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await ownerA.auth.signInWithPassword({
    email: userA.email,
    password: userA.password,
  });
  expect(error).toBeNull();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(userA?.id);
});

describe('FND-03 — owner cannot change any protected column (trigger RAISES)', () => {
  for (const [col, patch] of PROTECTED_UPDATES) {
    it(`rejects owner UPDATE of "${col}" with a protected-column error`, async () => {
      const { error } = await ownerA
        .from('profiles')
        .update(patch)
        .eq('id', userA.id)
        .select();

      // Trigger RAISE => non-null error (NOT an empty result).
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/protected profile column/i);

      // And the value did not actually change (verified via service role).
      const { data } = await admin
        .from('profiles')
        .select(col)
        .eq('id', userA.id)
        .single();
      const changedKey = Object.keys(patch)[0];
      const row = data as unknown as Record<string, unknown>;
      expect(row[changedKey]).not.toEqual(patch[changedKey]);
    });
  }
});

describe('FND-03 — trigger does not over-block non-protected columns', () => {
  it('owner CAN update a non-protected column (display_name)', async () => {
    const newName = `Renamed ${RUN}`;
    const { error } = await ownerA
      .from('profiles')
      .update({ display_name: newName })
      .eq('id', userA.id)
      .select();
    expect(error).toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', userA.id)
      .single();
    expect(data!.display_name).toBe(newName);
  });

  it('owner CAN update another non-protected column (headline)', async () => {
    const headline = `A short tagline ${RUN}`;
    const { error } = await ownerA
      .from('profiles')
      .update({ headline })
      .eq('id', userA.id)
      .select();
    expect(error).toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('headline')
      .eq('id', userA.id)
      .single();
    expect(data!.headline).toBe(headline);
  });
});
