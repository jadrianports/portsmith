/**
 * Shared helpers for the RLS integration suite (the test BODIES land in Plan 09).
 *
 * Every client is built with `persistSession: false` so sessions never leak
 * across tests or to disk (01-RESEARCH.md Pitfall 4). Auth is injected
 * explicitly per test via `signInWithPassword`, and seed/cleanup go through a
 * service-role admin client that bypasses RLS.
 *
 * LOCAL-STACK ENV: reads SUPABASE_URL / SUPABASE_ANON_KEY /
 * SUPABASE_SERVICE_ROLE_KEY from the process env — the same source the
 * `integration` Vitest project loads (see vitest.config.ts; locally via dotenv
 * from `.env.local`, in CI via `supabase status -o env`). These point at the
 * local stack from `supabase start` — NEVER production credentials.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[integration] Missing env var ${name}. Start the local stack ` +
        `(\`supabase start\`) and export its keys (\`supabase status -o env\`), ` +
        `or set them in .env.local. Integration tests talk to the LOCAL stack only.`,
    );
  }
  return value;
}

const SUPABASE_URL = (): string => requireEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = (): string => requireEnv('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = (): string =>
  requireEnv('SUPABASE_SERVICE_ROLE_KEY');

/**
 * Private profile columns that the public surface (`public_profiles` view +
 * base-table grants) must NEVER expose to an anon client. Used by the FND-02
 * negative key-absence assertions (Plan 09).
 */
export const PRIVATE_PROFILE_COLUMNS = [
  'email',
  'role',
  'storage_used_bytes',
  'locked',
  'locked_reason',
  'deleted_at',
  'created_at',
] as const;

/**
 * Anonymous client — the public, unauthenticated surface. Subject to RLS as the
 * `anon` role.
 */
export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    auth: { persistSession: false },
  });
}

/**
 * Service-role admin client — BYPASSES RLS. Use ONLY for seeding and cleanup in
 * test setup/teardown, never to assert tenant isolation.
 */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL(), SUPABASE_SERVICE_ROLE_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * A fresh anon-key client an authed test signs into via `signInWithPassword`.
 * Each call returns a new client so two users (A and B) never share a session.
 */
export function userClient(): SupabaseClient {
  return createClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    auth: { persistSession: false },
  });
}

export interface TestUserInput {
  email: string;
  password: string;
  username: string;
  display_name: string;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  username: string;
  display_name: string;
}

/**
 * Create a confirmed test user via the service-role admin API (Open Question 3
 * resolution: prefer `auth.admin.createUser` over raw seed SQL). `email_confirm:
 * true` lets the user sign in immediately, and `user_metadata.{username,
 * display_name}` is what the `handle_new_user` trigger reads to provision the
 * profile row — so creating the user this way exercises the real trigger.
 */
export async function createTestUser(input: TestUserInput): Promise<TestUser> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      username: input.username,
      display_name: input.display_name,
    },
  });
  if (error || !data.user) {
    throw new Error(
      `[integration] createTestUser failed for ${input.email}: ${
        error?.message ?? 'no user returned'
      }`,
    );
  }
  return {
    id: data.user.id,
    email: input.email,
    password: input.password,
    username: input.username,
    display_name: input.display_name,
  };
}

/**
 * Delete auth users by id via the service-role admin API. Deleting the auth user
 * cascades to the profile / portfolio rows, clearing all state between tests.
 * Best-effort: tolerates already-deleted ids so teardown never masks the real
 * test failure.
 */
export async function cleanupTestUsers(...ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const admin = adminClient();
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) {
      throw new Error(
        `[integration] cleanupTestUsers failed for ${id}: ${error.message}`,
      );
    }
  }
}

/**
 * WR-09 — leftover-test-user sweep. The integration suite derives test users'
 * emails/usernames from a per-run token; if a previous run ABORTED mid-test
 * (crash, ctrl-C), its `*@example.test` users survive and — because username is
 * now UNIQUE among live rows (CR-02) — an orphan with a colliding handle would
 * wedge the next run's `createTestUser` with the opaque GoTrue "Database error".
 * The per-run token (`crypto.randomUUID().slice(0,8)`) makes a true collision
 * astronomically unlikely, but this sweep is the deterministic backstop: call it
 * in a global/file `beforeAll` to purge ALL leftover `*@example.test` users
 * before a run begins. LOCAL STACK ONLY — `*@example.test` is a reserved test
 * domain that production data never uses; this never runs against prod (the
 * suite reads local-stack creds only).
 *
 * Paginated listUsers (admin API caps perPage); best-effort deletes so a
 * transient error never masks the real test failure.
 */
export async function sweepLeftoverTestUsers(): Promise<void> {
  const admin = adminClient();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) return; // best-effort: don't fail setup on a sweep hiccup
    const users = data?.users ?? [];
    if (users.length === 0) break;
    const leftovers = users.filter((u) =>
      (u.email ?? '').toLowerCase().endsWith('@example.test'),
    );
    for (const u of leftovers) {
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
      if (delErr && !/not found/i.test(delErr.message)) {
        // best-effort: log-and-continue, never throw from the sweep
        // (a stuck delete shouldn't block the whole suite).
        // eslint-disable-next-line no-console
        console.warn(
          `[integration] sweepLeftoverTestUsers: could not delete ${u.id}: ${delErr.message}`,
        );
      }
    }
    if (users.length < 1000) break; // last page
  }
}
