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
