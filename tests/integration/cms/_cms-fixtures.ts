/**
 * Shared two-user fixture surface for the Phase-4 CMS RLS integration tests
 * (Wave 0, 04-01). Built ON TOP OF `tests/integration/_setup.ts` — it reuses
 * `createTestUser`/`cleanupTestUsers`/`sweepLeftoverTestUsers`/`adminClient`
 * rather than duplicating them, and adds the SECOND test user (B) the
 * cross-tenant negatives require (04-VALIDATION.md "Wave 0 ... a second test
 * user (cross-tenant negative)").
 *
 * This is a helper module, NOT a spec — it has no `.test.ts` filename suffix, so
 * the vitest `integration` project (whose include glob matches only test files)
 * never runs it as a test file.
 *
 * LOCAL STACK ONLY — `*@example.test` is a reserved test domain; the underlying
 * `_setup.ts` reads local-stack creds only and never touches production.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect } from 'vitest';

import {
  adminClient,
  cleanupTestUsers,
  createTestUser,
  sweepLeftoverTestUsers,
  type TestUser,
} from '../_setup';

export { adminClient, type TestUser };

/** A signed-in anon-key client for `user` (RLS scoped to that user). */
export async function signedInClient(user: TestUser): Promise<SupabaseClient> {
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

/** Drive the real idempotent bootstrap RPC as `user`; returns the portfolio id. */
export async function bootstrapPortfolioAs(user: TestUser): Promise<string> {
  const owner = await signedInClient(user);
  const { data, error } = await owner.rpc('initialize_portfolio');
  expect(error).toBeNull();
  expect(data).toBeTruthy();
  return data as unknown as string;
}

export interface TwoUsers {
  userA: TestUser;
  userB: TestUser;
  clientA: SupabaseClient;
  clientB: SupabaseClient;
  portfolioA: string;
  portfolioB: string;
}

/**
 * Provision two confirmed users (A and B), each with a bootstrapped portfolio,
 * signed in. `prefix` keeps usernames unique per test file; `run` is the
 * collision-proof per-run token (`crypto.randomUUID().slice(0, 8)`).
 */
export async function setupTwoUsers(prefix: string, run: string): Promise<TwoUsers> {
  await sweepLeftoverTestUsers();
  const aName = `${prefix}a${run}`.slice(0, 30);
  const bName = `${prefix}b${run}`.slice(0, 30);

  const userA = await createTestUser({
    email: `${aName}@example.test`,
    password: 'Test-Password-123!',
    username: aName,
    display_name: `${prefix} User A`,
  });
  const userB = await createTestUser({
    email: `${bName}@example.test`,
    password: 'Test-Password-123!',
    username: bName,
    display_name: `${prefix} User B`,
  });

  const portfolioA = await bootstrapPortfolioAs(userA);
  const portfolioB = await bootstrapPortfolioAs(userB);
  const clientA = await signedInClient(userA);
  const clientB = await signedInClient(userB);

  return { userA, userB, clientA, clientB, portfolioA, portfolioB };
}

/** Tear down both users (cascades to their portfolios/sections). */
export async function teardownTwoUsers(users: Partial<TwoUsers>): Promise<void> {
  const ids = [users.userA?.id, users.userB?.id].filter(
    (id): id is string => typeof id === 'string',
  );
  await cleanupTestUsers(...ids);
}

/**
 * An admin test user — the GATE-04 (Phase-12) admin-action tests need a user whose
 * `profiles.role = 'admin'` so the `is_admin()` SECURITY DEFINER helper (002:232)
 * evaluates TRUE for them and the `*_admin all` RLS policies admit their writes.
 *
 * The suite currently has only `setupTwoUsers` — two NORMAL (`role='user'`) users —
 * so admin-RLS reads/writes + the `is_admin()`-gated auto-fallback RPC have no caller
 * to assert against. This fills that gap.
 */
export interface AdminUser {
  user: TestUser;
  /**
   * An anon-key signed-in client for the admin user (RLS-scoped, carrying the real
   * JWT subject) — so `is_admin()` evaluates against `auth.uid()`. NOT the
   * service-role `adminClient` (which bypasses RLS entirely and would prove nothing
   * about the admin-RLS policy path).
   */
  client: SupabaseClient;
}

/**
 * Provision ONE confirmed user and promote them to `role='admin'`, then return the
 * user plus an anon-key signed-in client for them.
 *
 * `role` is a PROTECTED profile column — the `enforce_protected_profile_columns`
 * trigger (Plan 01-06) blocks any UPDATE of `role` from a normal client, and the
 * anon role can never write it. The promotion therefore goes through the
 * service-role `adminClient`, which bypasses BOTH RLS and the protected-columns
 * trigger (the trigger's service-role short-circuit, 002:55) — this is the
 * test-only equivalent of `scripts/promote-admin.ts`, inlined for the suite.
 *
 * `prefix` keeps the username unique per test file; `run` is the collision-proof
 * per-run token (`crypto.randomUUID().slice(0, 8)`). LOCAL STACK ONLY —
 * `*@example.test` is a reserved test domain.
 */
export async function setupAdminUser(prefix: string, run: string): Promise<AdminUser> {
  await sweepLeftoverTestUsers();
  const name = `${prefix}adm${run}`.slice(0, 30);

  const user = await createTestUser({
    email: `${name}@example.test`,
    password: 'Test-Password-123!',
    username: name,
    display_name: `${prefix} Admin`,
  });

  // Promote to admin via the SERVICE-ROLE admin client — the only sanctioned path
  // to set `role` (bypasses the protected-columns trigger; the anon client cannot).
  const { error } = await adminClient()
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', user.id);
  expect(error).toBeNull();

  // Return an ANON-KEY signed-in client (NOT the service-role adminClient) so
  // `is_admin()` evaluates against this user's real JWT subject under RLS.
  const client = await signedInClient(user);
  return { user, client };
}

/** Tear down the admin user (cascades to their profile/portfolio rows). */
export async function teardownAdminUser(admin?: AdminUser): Promise<void> {
  if (admin?.user?.id) await cleanupTestUsers(admin.user.id);
}
