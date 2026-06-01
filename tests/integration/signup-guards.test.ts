/**
 * CR-02 / CR-03 — DB-level signup guards in `handle_new_user`, proven against the
 * live local stack.
 *
 * `raw_user_meta_data` is CLIENT-SUPPLIED at signup and is NOT run through the Zod
 * `usernameSchema` — a direct anon `auth.signUp` (or any non-app signup path)
 * bypasses the app-code gate entirely. So the DB trigger is the real boundary:
 *
 *   CR-03  - a reserved username (mirrors RESERVED_USERNAMES in
 *            src/lib/validations/username.ts) is REJECTED at signup, via BOTH the
 *            public anon `auth.signUp` path AND the service-role admin
 *            createUser path.
 *          - a MISSING username is rejected (NOT NULL would otherwise be opaque).
 *   CR-02  - username is UNIQUE only among LIVE rows (partial unique index
 *            uq_profiles_username_live): a handle freed by soft-delete
 *            (deleted_at set) is RECLAIMABLE by a new signup, while two LIVE rows
 *            still cannot share a handle.
 *
 * ERROR-SHAPE NOTE: when `handle_new_user` RAISEs, GoTrue WRAPS it as a generic
 * "Database error ..." (500) rather than surfacing the trigger's message verbatim.
 * So these tests assert the OUTCOME — signup FAILS / no profile row is created /
 * no row leaks — never the specific RAISE text (which GoTrue hides).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

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

// Track every auth user id we create so afterAll cleans up even on assertion fail.
const createdIds: string[] = [];

beforeAll(async () => {
  await sweepLeftoverTestUsers();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(...createdIds.filter(Boolean));
});

describe('CR-03 — reserved usernames are rejected at the DB signup boundary', () => {
  it('anon auth.signUp with a reserved username ("admin") is rejected and creates no profile', async () => {
    const anon = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await anon.auth.signUp({
      email: `reserved-${RUN}@example.test`,
      password: 'Test-Password-123!',
      options: { data: { username: 'admin', display_name: 'Reserved' } },
    });

    // The trigger RAISEs 'username is reserved'; GoTrue wraps it as a 500.
    // Outcome assertion: no usable user, and definitively no profile row.
    expect(error).not.toBeNull();
    if (data?.user?.id) createdIds.push(data.user.id);

    const { data: prof } = await admin
      .from('profiles')
      .select('id')
      .eq('username', 'admin');
    expect(prof ?? []).toHaveLength(0);
  });

  it('service-role admin.createUser with a reserved username ("dashboard") is rejected', async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `reserved2-${RUN}@example.test`,
      password: 'Test-Password-123!',
      email_confirm: true,
      user_metadata: { username: 'dashboard', display_name: 'Reserved2' },
    });
    expect(error).not.toBeNull();
    if (data?.user?.id) createdIds.push(data.user.id);

    const { data: prof } = await admin
      .from('profiles')
      .select('id')
      .eq('username', 'dashboard');
    expect(prof ?? []).toHaveLength(0);
  });

  it('a NON-reserved valid username still succeeds (guard does not over-block)', async () => {
    const name = `ok${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: 'Test-Password-123!',
      username: name,
      display_name: 'Legit User',
    });
    createdIds.push(user.id);

    const { data: prof, error } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    expect(error).toBeNull();
    expect(prof!.username).toBe(name);
  });
});

describe('CR-03 — a missing username is rejected at signup', () => {
  it('admin.createUser with NO username in metadata creates no profile', async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `nouser-${RUN}@example.test`,
      password: 'Test-Password-123!',
      email_confirm: true,
      user_metadata: { display_name: 'No Username' }, // username omitted
    });
    // handle_new_user RAISEs 'username is required at signup' (wrapped by GoTrue).
    expect(error).not.toBeNull();
    if (data?.user?.id) createdIds.push(data.user.id);
  });
});

describe('CR-02 — username is unique only among LIVE rows (reclaim after soft-delete)', () => {
  it('a handle freed by soft-delete is reclaimable; two LIVE rows cannot share it', async () => {
    const handle = `reclaim${RUN}`.slice(0, 30);

    // 1) First user claims the handle.
    const first = await createTestUser({
      email: `${handle}@example.test`,
      password: 'Test-Password-123!',
      username: handle,
      display_name: 'First Owner',
    });
    createdIds.push(first.id);

    // 2) While that row is LIVE, a SECOND signup with the same handle must FAIL
    //    (the partial unique index + handle_new_user unique_violation guard).
    const dup = await admin.auth.admin.createUser({
      email: `${handle}-dup@example.test`,
      password: 'Test-Password-123!',
      email_confirm: true,
      user_metadata: { username: handle, display_name: 'Dup' },
    });
    expect(dup.error).not.toBeNull();
    if (dup.data?.user?.id) createdIds.push(dup.data.user.id);

    // 3) Soft-delete the first user (set deleted_at). NOTE: driven via the
    //    service-role admin client because the user-facing request_account_deletion
    //    RPC is currently blocked by the protected-columns trigger — see
    //    deferred-items.md DEF-01. The CR-02 mechanism under test here is the
    //    PARTIAL UNIQUE INDEX (uq_profiles_username_live), which is independent of
    //    *how* deleted_at gets set.
    const sd = await admin
      .from('profiles')
      .update({ deleted_at: new Date().toISOString(), published: false })
      .eq('id', first.id);
    expect(sd.error).toBeNull();

    // 4) Now the handle is FREE — a new signup reclaiming it must SUCCEED.
    const reclaimed = await createTestUser({
      email: `${handle}-two@example.test`,
      password: 'Test-Password-123!',
      username: handle,
      display_name: 'Reclaimer',
    });
    createdIds.push(reclaimed.id);

    const { data: liveRows, error } = await admin
      .from('profiles')
      .select('id')
      .eq('username', handle)
      .is('deleted_at', null);
    expect(error).toBeNull();
    // Exactly ONE live row owns the handle now (the reclaimer); the soft-deleted
    // original is excluded by `deleted_at IS NULL`.
    expect(liveRows).toHaveLength(1);
    expect(liveRows![0].id).toBe(reclaimed.id);
  });
});

describe('AUTH-01/02 — public anon signUp creates a profile row and the user is email-unconfirmed', () => {
  it('auth.signUp({data:{username,display_name}}) provisions a profile via the live trigger; user is unconfirmed', async () => {
    const anon = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const username = `happy${RUN}`.slice(0, 30);
    const email = `${username}@example.test`;

    // Public, unauthenticated signUp — the path a real new user takes. The
    // `handle_new_user` trigger reads raw_user_meta_data to provision the profile.
    const { data, error } = await anon.auth.signUp({
      email,
      password: 'Test-Password-123!',
      options: { data: { username, display_name: 'Happy Path' } },
    });
    expect(error).toBeNull();
    const userId = data.user?.id;
    expect(userId).toBeTruthy();
    if (userId) createdIds.push(userId);

    // AUTH-01: a profile row was created by the live trigger with the supplied handle.
    const { data: prof, error: profErr } = await admin
      .from('profiles')
      .select('id, username, display_name')
      .eq('id', userId!)
      .single();
    expect(profErr).toBeNull();
    expect(prof!.username).toBe(username);
    expect(prof!.display_name).toBe('Happy Path');

    // AUTH-02: with confirmations enabled (Task 1), the new user is UNCONFIRMED
    // (email_confirmed_at is null) until they verify — they cannot act as confirmed.
    const { data: adminView, error: adminErr } =
      await admin.auth.admin.getUserById(userId!);
    expect(adminErr).toBeNull();
    expect(adminView.user?.email_confirmed_at ?? null).toBeNull();
  });
});
