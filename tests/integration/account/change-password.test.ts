/**
 * ACCT-01 — change password from settings, gated by current-password reauth.
 *
 * WAVE-0 RED SCAFFOLD. The product surface (the `'use server'` change-password
 * action, D-03) is built in a Wave-2 slice; per the established repo pattern
 * (free-unsaved-upload.test.ts) this test drives the UNDERLYING primitives the
 * action delegates to once identity is verified, against the REAL local Supabase
 * stack — the action's only added surface (the SHARED-A `getVerifiedClaims()` →
 * sub/email guard + the result-shape mapping) reads `next/headers` cookies the
 * `node` integration project can't supply, so the DB/auth truth is proven here.
 *
 * The two load-bearing behaviors:
 *   1. The D-01/D-02 reauth gate (`verifyCurrentPassword`, src/lib/auth/reauth.ts)
 *      returns FALSE for a wrong password and TRUE for the correct one — and the
 *      stateless verify does NOT clobber the user's separate signed-in session
 *      (Pitfall 2): a verify against a throwaway client leaves the owner client's
 *      session intact.
 *   2. With the correct password, `updateUser({ password })` on the AUTHENTICATED
 *      client (NOT service-role, NOT a recovery session — D-03/D-04) succeeds, and
 *      the new password authenticates afterward.
 *
 * `verifyCurrentPassword` is `server-only`; under Vitest `server-only` is aliased
 * to a no-op stub (vitest.config.ts), so importing it here is safe.
 *
 * LOCAL STACK ONLY — `*@example.test` is a reserved test domain.
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

import { verifyCurrentPassword } from '@/lib/auth/reauth';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);
const createdIds: string[] = [];

const OLD_PASSWORD = 'Test-Password-123!';
const NEW_PASSWORD = 'New-Password-456!';

function anon(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

async function signIn(user: TestUser, password: string): Promise<SupabaseClient> {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email: user.email, password });
  expect(error).toBeNull();
  return c;
}

beforeAll(async () => {
  await sweepLeftoverTestUsers();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(...createdIds.filter(Boolean));
});

describe('ACCT-01 — current-password reauth gate (D-01/D-02)', () => {
  it('verifyCurrentPassword: wrong password → false, correct → true; no SSR-cookie clobber', async () => {
    const name = `cpw${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: OLD_PASSWORD,
      username: name,
      display_name: 'Change Password',
    });
    createdIds.push(user.id);

    // A live signed-in owner session (stands in for the SSR-cookie session).
    const owner = await signIn(user, OLD_PASSWORD);

    // WRONG password → generic reject (no write should ever follow a false).
    await expect(verifyCurrentPassword(user.email, 'wrong-password')).resolves.toBe(
      false,
    );

    // CORRECT password → proceed.
    await expect(verifyCurrentPassword(user.email, OLD_PASSWORD)).resolves.toBe(true);

    // Pitfall 2: the stateless verify (persistSession:false, no cookie adapter)
    // must NOT have touched the owner's session — it still resolves to the user.
    const claims = await owner.auth.getClaims();
    expect(claims.error).toBeNull();
    expect(claims.data?.claims?.sub).toBe(user.id);
  });
});

describe('ACCT-01 — password change on the authenticated client (D-03/D-04)', () => {
  it('after reauth, updateUser({password}) succeeds and the new password authenticates', async () => {
    const name = `cpw2${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: OLD_PASSWORD,
      username: name,
      display_name: 'Change Password 2',
    });
    createdIds.push(user.id);

    // 1) Reauth gate (the action runs this FIRST, D-01).
    expect(await verifyCurrentPassword(user.email, OLD_PASSWORD)).toBe(true);

    // 2) The change runs on the AUTHENTICATED (signed-in) client — NOT service-role,
    //    NOT a recovery session (D-03/D-04). A normal signed-in session suffices
    //    BECAUSE reauth already supplied the proof the amr=otp recovery gate would.
    const owner = await signIn(user, OLD_PASSWORD);
    const { error } = await owner.auth.updateUser({ password: NEW_PASSWORD });
    expect(error).toBeNull();

    // 3) The new password now authenticates; the old one does not.
    const withNew = anon();
    const newOk = await withNew.auth.signInWithPassword({
      email: user.email,
      password: NEW_PASSWORD,
    });
    expect(newOk.error).toBeNull();

    const withOld = anon();
    const oldFail = await withOld.auth.signInWithPassword({
      email: user.email,
      password: OLD_PASSWORD,
    });
    expect(oldFail.error).not.toBeNull();

    // Sanity: the admin view still shows exactly this user (no stray account churn).
    const view = await admin.auth.admin.getUserById(user.id);
    expect(view.error).toBeNull();
    expect(view.data.user?.id).toBe(user.id);
  });
});
