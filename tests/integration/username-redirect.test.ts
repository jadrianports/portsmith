/**
 * HANDLE-02 — old-handle → current-handle redirect resolution (Wave-0 RED).
 *
 * Phase 30 makes a renamed handle durable: the `change_username` RPC writes a
 * write-once `username_history(old_handle PK → user_id)` row, and an anon-readable
 * `security_invoker` view `public_username_redirects` resolves an OLD handle to the
 * user's CURRENT `profiles.username` WITHOUT leaking `user_id` (30-RESEARCH.md
 * "username_history Table + Public-Read Path" + "The Redirect"). Because history
 * maps `old → user` (not `old → next`), `A → B → C` makes BOTH `/A` and `/B`
 * resolve to `/C` in a SINGLE hop forever (D-01).
 *
 * This file pins two layers of the HANDLE-02 contract:
 *   1. THE DB RESOLUTION (the security boundary): drive change_username A→B→C under
 *      authenticated clients, then read `public_username_redirects` as ANON and assert
 *      old_handle A AND old_handle B both resolve to current_username C (single-hop
 *      multi-hop, D-01), and the view NEVER exposes user_id (Pitfall 3).
 *   2. THE HELPER SUB-PATH PRESERVATION (D-03): the shared cookie-less
 *      `redirectIfRenamedHandle(oldHandle, subPath)` builds `'/' + current + subPath`
 *      and `permanentRedirect`s (308) to it, preserving the sub-path for all 4 public
 *      routes (`''`, `/blog`, `/blog/[slug]`, `/services`).
 *
 * RED STATE: migration 027 (the `change_username` RPC + `username_history` +
 * `public_username_redirects` view) and the redirect helper
 * (`src/lib/portfolio/username-redirect.ts`) do not exist yet — the RPC calls error
 * on a missing function, the anon view read errors on a missing relation, and the
 * helper dynamic import fails on a missing module. That IS the intended Wave-0 RED.
 *
 * These run against the LIVE local Supabase stack — no DB stubbing. We assert on
 * OUTCOME (resolved handle / redirect target / error presence), never message text.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  adminClient,
  anonClient,
  cleanupTestUsers,
  createTestUser,
  sweepLeftoverTestUsers,
  type TestUser,
} from './_setup';

// The redirect helper (D-03) imports `next/navigation` permanentRedirect + `server-only`.
// Mock both so the helper can run inside the vitest node project: `server-only` is a
// no-op, and `permanentRedirect` RECORDS its target then throws a tagged sentinel
// (mirroring the real 308 throw that terminates the segment render). Each helper call
// is wrapped so the loop over the 4 sub-paths can capture every target.
const redirectTargets: string[] = [];
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  permanentRedirect: (path: string) => {
    redirectTargets.push(path);
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const admin = adminClient();
const anon = anonClient();
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
 * Create a test user, stamp it ONBOARDED (`onboarded_at` non-null — the
 * change_username eligibility window) AND PUBLISHED (so `profile_is_public` lets
 * the redirect view resolve to it). Neither column is protected, so the owner
 * writes both directly under RLS.
 */
async function createPublishedOnboardedUser(
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
    .update({ onboarded_at: new Date().toISOString(), published: true })
    .eq('id', user.id);
  expect(error).toBeNull();
  return { user, client };
}

beforeAll(async () => {
  // The redirect helper builds a cookie-LESS anon client from NEXT_PUBLIC_* env
  // (get-portfolio.ts posture, Pitfall 4). The integration env exports the
  // non-prefixed pair; mirror them so the helper's client reaches the local stack.
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= process.env.SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= process.env.SUPABASE_ANON_KEY;
  await sweepLeftoverTestUsers();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(...createdIds.filter(Boolean));
});

// RED: `@/lib/portfolio/username-redirect` does not exist until Plan 04. Load it via a
// RUNTIME dynamic import through a computed specifier so `tsc --noEmit` does NOT
// statically resolve the (absent) module — the import fails only at RUNTIME, which IS
// the intended Wave-0 RED. Plan 04 creates the real helper and this lazy loader can be
// replaced with a plain static import when the test flips GREEN.
type RedirectHelper = (oldHandle: string, subPath?: string) => Promise<void>;
const HELPER_SPECIFIER = ['@/lib/portfolio', 'username-redirect'].join('/');
async function redirectIfRenamedHandle(oldHandle: string, subPath = ''): Promise<void> {
  const mod = (await import(/* @vite-ignore */ HELPER_SPECIFIER)) as {
    redirectIfRenamedHandle: RedirectHelper;
  };
  return mod.redirectIfRenamedHandle(oldHandle, subPath);
}

describe('HANDLE-02 / D-01 — public_username_redirects resolves old → current in a single hop', () => {
  it('A→B→C: old handles A AND B both resolve to current C (single-hop multi-hop)', async () => {
    const a = `rda${RUN}`.slice(0, 30);
    const b = `rdb${RUN}`.slice(0, 30);
    const c = `rdc${RUN}`.slice(0, 30);
    const { client } = await createPublishedOnboardedUser('redirect A→B→C', a);

    // Two sequential sanctioned changes: A→B, then B→C.
    expect((await client.rpc('change_username', { new_username: b })).error).toBeNull();
    expect((await client.rpc('change_username', { new_username: c })).error).toBeNull();

    // The ANON view resolves BOTH prior handles to the CURRENT one in a single hop.
    const resA = await anon
      .from('public_username_redirects')
      .select('current_username')
      .eq('old_handle', a)
      .maybeSingle();
    expect(resA.error).toBeNull();
    expect(resA.data!.current_username).toBe(c);

    const resB = await anon
      .from('public_username_redirects')
      .select('current_username')
      .eq('old_handle', b)
      .maybeSingle();
    expect(resB.error).toBeNull();
    expect(resB.data!.current_username).toBe(c);
  });

  it('the view never exposes user_id (Pitfall 3 — no FK leak to anon)', async () => {
    const a = `rdl${RUN}`.slice(0, 30);
    const b = `rdl2${RUN}`.slice(0, 30);
    const { client } = await createPublishedOnboardedUser('redirect leak', a);
    expect((await client.rpc('change_username', { new_username: b })).error).toBeNull();

    // Selecting user_id from the view must FAIL — the column is not projected.
    const leak = await anon
      .from('public_username_redirects')
      .select('user_id')
      .eq('old_handle', a);
    expect(leak.error).not.toBeNull();
  });

  it('a live (never-renamed) handle has no redirect row', async () => {
    const live = `rdlive${RUN}`.slice(0, 30);
    await createPublishedOnboardedUser('redirect live', live);

    const res = await anon
      .from('public_username_redirects')
      .select('current_username')
      .eq('old_handle', live)
      .maybeSingle();
    expect(res.error).toBeNull();
    expect(res.data).toBeNull(); // live handle is not in history → no redirect
  });
});

describe('HANDLE-02 / D-03 — redirectIfRenamedHandle preserves the sub-path for all 4 routes', () => {
  it('builds /current + subPath (308) for "", /blog, /blog/[slug], /services after A→B', async () => {
    const a = `rsuba${RUN}`.slice(0, 30);
    const b = `rsubb${RUN}`.slice(0, 30);
    const { client } = await createPublishedOnboardedUser('redirect sub-path', a);
    expect((await client.rpc('change_username', { new_username: b })).error).toBeNull();

    redirectTargets.length = 0;
    const slug = 'shipping-on-the-edge';
    const cases: ReadonlyArray<readonly [subPath: string, expected: string]> = [
      ['', `/${b}`],
      ['/blog', `/${b}/blog`],
      [`/blog/${slug}`, `/${b}/blog/${slug}`],
      ['/services', `/${b}/services`],
    ];

    for (const [subPath, expected] of cases) {
      // The helper resolves A→B via the anon view then permanentRedirect('/'+B+subPath),
      // which our mock records + throws — so each call rejects with the tagged sentinel.
      await expect(redirectIfRenamedHandle(a, subPath)).rejects.toThrow(/NEXT_REDIRECT/);
      expect(redirectTargets.at(-1)).toBe(expected);
    }
  });

  it('multi-hop A→B→C: helper sends BOTH /A and /B to /C in a single hop', async () => {
    const a = `rh3a${RUN}`.slice(0, 30);
    const b = `rh3b${RUN}`.slice(0, 30);
    const c = `rh3c${RUN}`.slice(0, 30);
    const { client } = await createPublishedOnboardedUser('redirect helper multi-hop', a);
    expect((await client.rpc('change_username', { new_username: b })).error).toBeNull();
    expect((await client.rpc('change_username', { new_username: c })).error).toBeNull();

    redirectTargets.length = 0;
    await expect(redirectIfRenamedHandle(a)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectTargets.at(-1)).toBe(`/${c}`);
    await expect(redirectIfRenamedHandle(b)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectTargets.at(-1)).toBe(`/${c}`);
  });

  it('a live handle is a MISS: the helper returns without redirecting (caller then notFound()s)', async () => {
    const live = `rhlive${RUN}`.slice(0, 30);
    await createPublishedOnboardedUser('redirect helper live', live);

    redirectTargets.length = 0;
    // current === oldHandle (or no history row) → the helper returns void, no throw.
    await expect(redirectIfRenamedHandle(live)).resolves.toBeUndefined();
    expect(redirectTargets).toHaveLength(0);
  });

  it('Pitfall 11 — the helper still redirects /[old]/blog to /[current]/blog even if the destination template gates blog away', async () => {
    // The helper resolves the HANDLE and produces the target; the destination route
    // applies its own D-14 templateSpec.pages gate (404 there is expected, NOT a
    // redirect failure). We assert the helper's job ends at producing /current/blog —
    // it does not gate on page existence at the destination.
    const a = `rpf11a${RUN}`.slice(0, 30);
    const b = `rpf11b${RUN}`.slice(0, 30);
    const { client } = await createPublishedOnboardedUser('redirect pitfall 11', a);
    expect((await client.rpc('change_username', { new_username: b })).error).toBeNull();

    redirectTargets.length = 0;
    await expect(redirectIfRenamedHandle(a, '/blog')).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectTargets.at(-1)).toBe(`/${b}/blog`); // resolves regardless of dest spec gate
  });
});
