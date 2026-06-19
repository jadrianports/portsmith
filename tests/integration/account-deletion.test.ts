/**
 * DEF-01 — sanctioned self-deletion via request_account_deletion(), WITHOUT
 * weakening the FND-03 protected-columns control.
 *
 * BACKGROUND: request_account_deletion() is the SECURITY DEFINER RPC by which a
 * normal (non-admin) user soft-deletes their OWN account (sets deleted_at +
 * published=false). deleted_at is a PROTECTED column, so the BEFORE-UPDATE
 * trigger enforce_protected_profile_columns would normally reject the write —
 * SECURITY DEFINER changes the function owner, not the request-scoped
 * auth.uid()/auth.role() the trigger reads. The fix: the RPC sets a
 * TRANSACTION-LOCAL GUC (`portsmith.sanctioned_self_deletion = on`, third arg
 * `true` so it never leaks across pooled connections) immediately before its
 * UPDATE, and the trigger honours that marker ONLY for the exact own-row
 * NULL→timestamp soft-delete transition with every OTHER protected column
 * unchanged. Anything broader falls through to the generic rejection.
 *
 * These tests PROVE both halves:
 *   1. self-delete now works end-to-end for a non-admin owner;
 *   2. FND-03 is NOT weakened — the deletion path cannot be used to escalate
 *      (role/username/storage still rejected, including when bundled with
 *      deleted_at in one statement), and the path cannot un-delete;
 *   3. CR-02 reclaim works through the REAL RPC (not just the service role).
 *
 * ERROR-SHAPE NOTE (mirrors the other suites): a trigger RAISE surfaces as a
 * non-null PostgREST error, but the exact message may be wrapped. We assert on
 * OUTCOME (row state / error presence), never on message text.
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

// Every auth user id created in this file, so afterAll cleans up even on a
// failed assertion (some tests soft-delete their own user mid-test).
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

beforeAll(async () => {
  await sweepLeftoverTestUsers();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(...createdIds.filter(Boolean));
});

describe('DEF-01 — sanctioned self-deletion now works for a non-admin owner', () => {
  it('a signed-in non-admin can request_account_deletion: deleted_at set, published=false', async () => {
    const name = `del${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: 'Test-Password-123!',
      username: name,
      display_name: 'Self-Deleter',
    });
    createdIds.push(user.id);
    const owner = await signIn(user);

    // Sanity: live before the call.
    const before = await admin
      .from('profiles')
      .select('deleted_at, published, role')
      .eq('id', user.id)
      .single();
    expect(before.error).toBeNull();
    expect(before.data!.deleted_at).toBeNull();
    expect(before.data!.role).toBe('user'); // non-admin

    // The RPC must now SUCCEED (previously blocked by the protected-columns trigger).
    const { error } = await owner.rpc('request_account_deletion');
    expect(error).toBeNull();

    // Read back via service role: row is soft-deleted and unpublished.
    const after = await admin
      .from('profiles')
      .select('deleted_at, published')
      .eq('id', user.id)
      .single();
    expect(after.error).toBeNull();
    expect(after.data!.deleted_at).not.toBeNull();
    expect(after.data!.published).toBe(false);
  });
});

describe('DEF-01 — FND-03 is NOT weakened by the sanctioned-deletion path', () => {
  let user: TestUser;
  let owner: SupabaseClient;

  beforeAll(async () => {
    const name = `esc${RUN}`.slice(0, 30);
    user = await createTestUser({
      email: `${name}@example.test`,
      password: 'Test-Password-123!',
      username: name,
      display_name: 'Escalation Probe',
    });
    createdIds.push(user.id);
    owner = await signIn(user);
  }, 30_000);

  // A plain authenticated UPDATE of a protected column is STILL rejected — the
  // GUC is unset on this request path, so the deletion short-circuit can't apply.
  it('direct UPDATE role=admin is still rejected; role unchanged', async () => {
    const { error } = await owner
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', user.id)
      .select();
    expect(error).not.toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    expect(data!.role).toBe('user');
  });

  it('direct UPDATE username is still rejected; username unchanged', async () => {
    const { error } = await owner
      .from('profiles')
      .update({ username: `hijack-${RUN}`.slice(0, 30) })
      .eq('id', user.id)
      .select();
    expect(error).not.toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    expect(data!.username).toBe(user.username);
  });

  it('direct UPDATE storage_used_bytes is still rejected; value unchanged', async () => {
    const { error } = await owner
      .from('profiles')
      .update({ storage_used_bytes: 999999 })
      .eq('id', user.id)
      .select();
    expect(error).not.toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', user.id)
      .single();
    expect(data!.storage_used_bytes).toBe(0);
  });

  // The CRITICAL anti-escalation case: bundling an escalation column WITH
  // deleted_at in one direct statement. Even on a path where the GUC were set,
  // the short-circuit's "every OTHER protected column unchanged" clause must
  // block it. Here the GUC is unset anyway (direct client UPDATE), so it's a
  // belt-and-suspenders proof: the statement is rejected and NEITHER column moves.
  it('bundled UPDATE {deleted_at, role:admin} is rejected; role AND deleted_at unchanged', async () => {
    const { error } = await owner
      .from('profiles')
      .update({ deleted_at: new Date().toISOString(), role: 'admin' })
      .eq('id', user.id)
      .select();
    expect(error).not.toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('role, deleted_at')
      .eq('id', user.id)
      .single();
    expect(data!.role).toBe('user'); // escalation blocked
    expect(data!.deleted_at).toBeNull(); // and the soft-delete did NOT slip through
  });

  it('bundled UPDATE {deleted_at, username} is rejected; username AND deleted_at unchanged', async () => {
    const { error } = await owner
      .from('profiles')
      .update({
        deleted_at: new Date().toISOString(),
        username: `sneak-${RUN}`.slice(0, 30),
      })
      .eq('id', user.id)
      .select();
    expect(error).not.toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('username, deleted_at')
      .eq('id', user.id)
      .single();
    expect(data!.username).toBe(user.username);
    expect(data!.deleted_at).toBeNull();
  });
});

describe('DEF-01 — the sanctioned path cannot un-delete', () => {
  it('after soft-delete, a non-admin clearing deleted_at back to NULL is rejected', async () => {
    const name = `und${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: 'Test-Password-123!',
      username: name,
      display_name: 'Un-Delete Probe',
    });
    createdIds.push(user.id);
    const owner = await signIn(user);

    // Soft-delete via the real RPC (works post-fix).
    const del = await owner.rpc('request_account_deletion');
    expect(del.error).toBeNull();

    const deleted = await admin
      .from('profiles')
      .select('deleted_at')
      .eq('id', user.id)
      .single();
    expect(deleted.data!.deleted_at).not.toBeNull();

    // A soft-deleted user is still authenticated for this session; attempting to
    // clear deleted_at (un-delete) via a direct authenticated UPDATE must be
    // rejected. The short-circuit only allows NULL→timestamp, never ts→NULL, and
    // the GUC is unset on this direct path regardless.
    const { error } = await owner
      .from('profiles')
      .update({ deleted_at: null })
      .eq('id', user.id)
      .select();
    expect(error).not.toBeNull();

    // Still soft-deleted (un-delete did not take).
    const stillDeleted = await admin
      .from('profiles')
      .select('deleted_at')
      .eq('id', user.id)
      .single();
    expect(stillDeleted.data!.deleted_at).not.toBeNull();
  });
});

describe('DEF-01 / CR-02 — handle freed by the REAL RPC is reclaimable', () => {
  it('A claims a handle, A self-deletes via RPC, a new signup reclaims it; exactly one LIVE owner', async () => {
    const handle = `rrpc${RUN}`.slice(0, 30);

    // 1) First user claims the handle.
    const first = await createTestUser({
      email: `${handle}@example.test`,
      password: 'Test-Password-123!',
      username: handle,
      display_name: 'First Owner (RPC)',
    });
    createdIds.push(first.id);
    const firstOwner = await signIn(first);

    // 2) While LIVE, a second signup with the same handle must FAIL.
    const dup = await admin.auth.admin.createUser({
      email: `${handle}-dup@example.test`,
      password: 'Test-Password-123!',
      email_confirm: true,
      user_metadata: { username: handle, display_name: 'Dup' },
    });
    expect(dup.error).not.toBeNull();
    if (dup.data?.user?.id) createdIds.push(dup.data.user.id);

    // 3) Free the handle via the USER-FACING RPC (the DEF-01 deliverable) — NOT
    //    the service role. This is the path that was broken before the fix.
    const del = await firstOwner.rpc('request_account_deletion');
    expect(del.error).toBeNull();

    const freed = await admin
      .from('profiles')
      .select('deleted_at')
      .eq('id', first.id)
      .single();
    expect(freed.data!.deleted_at).not.toBeNull();

    // 4) The handle is now FREE — a new signup reclaiming it must SUCCEED.
    const reclaimed = await createTestUser({
      email: `${handle}-two@example.test`,
      password: 'Test-Password-123!',
      username: handle,
      display_name: 'Reclaimer (RPC)',
    });
    createdIds.push(reclaimed.id);

    // Exactly ONE live row owns the handle (the reclaimer); the soft-deleted
    // original is excluded by `deleted_at IS NULL`.
    const { data: liveRows, error } = await admin
      .from('profiles')
      .select('id')
      .eq('username', handle)
      .is('deleted_at', null);
    expect(error).toBeNull();
    expect(liveRows).toHaveLength(1);
    expect(liveRows![0].id).toBe(reclaimed.id);
  });
});

/**
 * Phase 30 — username_history rows cascade away on HARD account deletion (Wave-0 RED).
 *
 * Migration 027 adds `username_history.user_id UUID NOT NULL REFERENCES profiles(id)
 * ON DELETE CASCADE` (30-RESEARCH.md DDL). A deleted account must release its reserved
 * old handles: `admin.deleteUser(sub)` (the /api/account/delete route, route.ts:119)
 * removes the `auth.users` row, the 001 FK cascade wipes `profiles`, and the new
 * `username_history.user_id → profiles(id)` FK cascades from that — no orphaned reserved
 * handles linger past deletion. This is the enumerated "cascade | account-delete"
 * verification row from 30-VALIDATION.md (closing the T-30-06 orphaned-assertion gap).
 *
 * This ADDS a username_history-cascade assertion alongside the existing soft-delete /
 * reclaim cases above (which continue to pass unchanged) — it asserts the HARD-delete
 * path (auth.users removal), the only path that triggers the FK cascade.
 *
 * RED STATE: the `username_history` table does not exist until Plan 02 — the seed
 * INSERT errors on a missing relation, which IS the intended Wave-0 RED. It flips GREEN
 * once 027 is applied. The admin client is untyped, so `.from('username_history')` is
 * type-clean (the regen lands in Plan 02).
 */
describe('Phase 30 — deleting an account cascades away its username_history rows', () => {
  it('a hard account delete removes every username_history row owned by that user', async () => {
    const handle = `uh${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${handle}@example.test`,
      password: 'Test-Password-123!',
      username: handle,
      display_name: 'History Cascade',
    });
    createdIds.push(user.id);

    // Seed a reserved old handle owned by this user (a prior rename, modeled directly).
    const seed = await admin
      .from('username_history')
      .insert({ old_handle: `${handle}-old`.slice(0, 30), user_id: user.id });
    expect(seed.error).toBeNull(); // RED now — the username_history relation does not exist yet

    // Sanity: the row is present before deletion.
    const before = await admin
      .from('username_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    expect(before.count ?? 0).toBe(1);

    // HARD delete the account (auth.users removal) — the path the FK cascade composes with.
    const del = await admin.auth.admin.deleteUser(user.id);
    expect(del.error).toBeNull();

    // The ON DELETE CASCADE swept the history rows: zero remain for that user_id.
    const after = await admin
      .from('username_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    expect(after.count ?? 0).toBe(0);
  });
});
