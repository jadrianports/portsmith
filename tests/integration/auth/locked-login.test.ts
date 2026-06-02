/**
 * D-14 — RED scaffold (Wave 0, Plan 06-01). GREENED BY 06-07-T3.
 *
 * Live-stack proof of the suspended-user MVP (D-14): a LOCKED account is blocked
 * at login — it can authenticate (the credentials are valid) but the login action
 * must detect `profiles.locked` for the freshly-signed-in user and sign them back
 * out with a generic "account suspended" outcome (no usable session). This is NOT
 * an enumeration leak: `locked` is a real, known state readable by the account's
 * OWN authenticated user under `profiles own select`.
 *
 * This spec encodes the FOUNDATION FACTS the login enforcement relies on:
 *   - a locked owner CAN read their OWN `locked` flag (true) under RLS — so the
 *     login action has a verified signal to act on;
 *   - the lock is applied via the service-role (the moderation carve-out).
 *
 * ── WHY RED NOW ───────────────────────────────────────────────────────────────
 * The own-row readability of `locked` holds on the current foundation. The RED
 * half is the enforcement point the slice adds: the login action must EXPORT a
 * locked-aware sign-in (a `loginAction` that signs a locked user out). We assert
 * the not-yet-shipped behavior contract by importing the enforcement helper
 * `assertNotLocked` / the updated `loginAction` lock-check from the login-action
 * module at RUNTIME via the [05-01] variable specifier (tsc stays 0;
 * RED until 06-07 adds it). Reuses `_setup.ts` directly.
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
const RUN = crypto.randomUUID().slice(0, 8);

const LOGIN_ACTION = '@/lib/auth/login-action';

let lockedUser: TestUser;

function freshClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

beforeAll(async () => {
  await sweepLeftoverTestUsers();
  const name = `locklogin${RUN}`.slice(0, 30);
  lockedUser = await createTestUser({
    email: `${name}@example.test`,
    password: 'Test-Password-123!',
    username: name,
    display_name: 'Locked Login User',
  });
  // Suspend the account via the service-role (the moderation carve-out).
  const { error } = await admin
    .from('profiles')
    .update({ locked: true, locked_reason: 'suspended for test' })
    .eq('id', lockedUser.id);
  expect(error).toBeNull();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(lockedUser?.id);
});

describe('D-14 — locked account blocked at login', () => {
  it('the locked user can still AUTHENTICATE (valid credentials) — the block is post-sign-in', async () => {
    const c = freshClient();
    const { data, error } = await c.auth.signInWithPassword({
      email: lockedUser.email,
      password: lockedUser.password,
    });
    expect(error).toBeNull();
    expect(data.session).toBeTruthy(); // credentials work; D-14 must sign them OUT after
    await c.auth.signOut();
  });

  it('the signed-in locked owner CAN read their OWN locked flag (the login action signal)', async () => {
    const c = freshClient();
    await c.auth.signInWithPassword({
      email: lockedUser.email,
      password: lockedUser.password,
    });
    const { data, error } = await c
      .from('profiles')
      .select('locked')
      .eq('id', lockedUser.id)
      .single();
    expect(error).toBeNull();
    expect(data!.locked).toBe(true); // own-row readable under `profiles own select`
    await c.auth.signOut();
  });

  it('exposes the locked-aware login enforcement the slice adds (RED until 06-07)', async () => {
    const mod = (await import(/* @vite-ignore */ LOGIN_ACTION)) as {
      assertNotLocked?: unknown;
    };
    // RED now: the login-action module exists but the locked-login enforcement
    // helper (`assertNotLocked`) is not exported yet — 06-07-T3 adds it.
    expect(typeof mod.assertNotLocked).toBe('function');
  });
});
