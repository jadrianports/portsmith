/**
 * SHOW-03 — the `setShowcaseOptIn` own-row write + cross-tenant 0-row contract
 * (Wave-0 RED scaffold, Plan 31-01). Run against the LIVE local Supabase stack
 * (node env, sequential — see vitest.config.ts).
 *
 * THE INVARIANT (SHOW-03 / D-06 owner-editable NON-protected column): the opt-in
 * flag is a normal SHARED-A authenticated-RLS single-column write — the owner
 * flips their OWN `profiles.showcase_opt_in` (it is NOT in the protected-columns
 * trigger), and a cross-tenant attempt at another owner's row changes 0 rows
 * under the `profiles own all` RLS policy. The 8 protected columns are untouched.
 *
 * The action under test is `setShowcaseOptIn` from `@/lib/cms/set-showcase-action`
 * (NOT YET BUILT — Plan 31-03). It is a `'use server'` action that reads
 * `getVerifiedClaims()` from request cookies, so it cannot be invoked directly
 * from a bare integration test (no request context). We therefore:
 *   1. ASSERT the action module/export will exist (a runtime variable-specifier
 *      import — the established RED idiom from publish-gate.test.ts — so `tsc`
 *      stays 0 while the export is genuinely absent → RED now, GREEN once 31-03
 *      ships `set-showcase-action.ts`);
 *   2. EXERCISE the exact RLS boundary the action relies on (an authenticated
 *      owner UPDATE of `showcase_opt_in` scoped to `.eq('id', sub)`), proving
 *      the own-row write succeeds, the cross-tenant write changes 0 rows, and
 *      the protected columns are unchanged — the security contract the action
 *      depends on.
 *
 * THE ASYMMETRY (mirrors rls-cross-tenant.test.ts): a blocked UPDATE silently
 * affects 0 rows (the RLS USING clause filters them out), so we verify "no row
 * changed" by reading the row back with the service-role admin client — never by
 * inspecting a thrown error.
 *
 * ── WHY RED NOW ───────────────────────────────────────────────────────────────
 * `showcase_opt_in` (migration 028) and `set-showcase-action.ts` (Plan 31-03) do
 * not exist yet: the action-export assertion fails (undefined !== 'function') and
 * every `showcase_opt_in` write errors with "column ... does not exist". Plans
 * 31-02/31-03 turn this GREEN. Do NOT implement the action here.
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

// The not-yet-built `'use server'` action module (Plan 31-03). Imported through a
// variable specifier so there is no STATIC reference for `tsc` to fail on; the
// runtime export is `undefined` until 31-03 lands → the assertion is RED now.
const SHOWCASE_ACTION_MOD = '@/lib/cms/set-showcase-action';

let userA: TestUser;
let userB: TestUser;
let ownerA: SupabaseClient;

async function signedInClient(user: TestUser): Promise<SupabaseClient> {
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

beforeAll(async () => {
  // WR-09: purge leftover *@example.test users from an aborted prior run.
  await sweepLeftoverTestUsers();
  const aName = `show03a${RUN}`.slice(0, 30);
  const bName = `show03b${RUN}`.slice(0, 30);

  userA = await createTestUser({
    email: `${aName}@example.test`,
    password: 'Test-Password-123!',
    username: aName,
    display_name: 'SHOW-03 User A',
  });
  userB = await createTestUser({
    email: `${bName}@example.test`,
    password: 'Test-Password-123!',
    username: bName,
    display_name: 'SHOW-03 User B',
  });

  ownerA = await signedInClient(userA);
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(userA?.id, userB?.id);
});

describe('SHOW-03 — setShowcaseOptIn action surface (RED until Plan 31-03)', () => {
  it('exports an async setShowcaseOptIn from @/lib/cms/set-showcase-action', async () => {
    const mod = (await import(/* @vite-ignore */ SHOWCASE_ACTION_MOD)) as {
      setShowcaseOptIn?: (optIn: boolean) => Promise<unknown>;
    };
    // RED until 31-03 adds the export: undefined !== 'function'.
    expect(typeof mod.setShowcaseOptIn).toBe('function');
  });
});

describe('SHOW-03 — owner flips their OWN showcase_opt_in (the action’s RLS write)', () => {
  it('owner A can set showcase_opt_in on their own row (non-protected, RLS-allowed)', async () => {
    const { error } = await ownerA
      .from('profiles')
      .update({ showcase_opt_in: true })
      .eq('id', userA.id) // own row, scoped exactly like the action's .eq('id', sub)
      .select();
    // RED until 028: "column showcase_opt_in does not exist" → non-null error.
    expect(error).toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('showcase_opt_in')
      .eq('id', userA.id)
      .single();
    expect((data as Record<string, unknown>).showcase_opt_in).toBe(true);
  });

  it('owner A can clear it again (opt-out is the same own-row write)', async () => {
    const { error } = await ownerA
      .from('profiles')
      .update({ showcase_opt_in: false })
      .eq('id', userA.id)
      .select();
    expect(error).toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('showcase_opt_in')
      .eq('id', userA.id)
      .single();
    expect((data as Record<string, unknown>).showcase_opt_in).toBe(false);
  });
});

describe('SHOW-03 — cross-tenant setShowcaseOptIn changes 0 rows (D-06 / T-31-02)', () => {
  it('A cannot flip B’s showcase_opt_in (RLS own-row → 0 rows changed)', async () => {
    // Seed B opted-OUT via the service role (bypasses RLS).
    await admin
      .from('profiles')
      .update({ showcase_opt_in: false })
      .eq('id', userB.id);

    // A (authenticated) attempts to opt B IN, exactly as a forged action call would.
    await ownerA
      .from('profiles')
      .update({ showcase_opt_in: true })
      .eq('id', userB.id);

    // Verify via admin (bypasses RLS): B's flag is UNCHANGED — 0 rows changed.
    const { data } = await admin
      .from('profiles')
      .select('showcase_opt_in')
      .eq('id', userB.id)
      .single();
    expect((data as Record<string, unknown>).showcase_opt_in).toBe(false);
  });
});

describe('SHOW-03 — the opt-in write never touches a protected column', () => {
  it('A’s 8 protected columns are byte-unchanged across the opt-in flip', async () => {
    const PROTECTED = [
      'username',
      'role',
      'email',
      'storage_used_bytes',
      'locked',
      'locked_reason',
      'deleted_at',
      'created_at',
    ] as const;

    const before = await admin
      .from('profiles')
      .select(PROTECTED.join(','))
      .eq('id', userA.id)
      .single();

    // Flip opt-in on then off as the owner (the action's only write).
    await ownerA
      .from('profiles')
      .update({ showcase_opt_in: true })
      .eq('id', userA.id);
    await ownerA
      .from('profiles')
      .update({ showcase_opt_in: false })
      .eq('id', userA.id);

    const after = await admin
      .from('profiles')
      .select(PROTECTED.join(','))
      .eq('id', userA.id)
      .single();

    const b = before.data as unknown as Record<string, unknown>;
    const a = after.data as unknown as Record<string, unknown>;
    for (const col of PROTECTED) {
      expect(a[col]).toEqual(b[col]);
    }
  });
});
