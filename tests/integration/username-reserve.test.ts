/**
 * HANDLE-02 / D-04 / D-05 — union-uniqueness reservation + owner self-reclaim (Wave-0 RED).
 *
 * The `change_username` RPC enforces union-uniqueness as the DB backstop (CR-03 — a
 * direct PostgREST RPC call bypasses app code): a candidate handle is rejected if it is
 * taken by ANOTHER user's live `profiles.username` OR present in ANOTHER user's
 * `username_history` (30-RESEARCH.md RPC sketch lines 103-110). The owner is special-
 * cased by the `id <> v_user_id` / `user_id <> v_user_id` predicates, which gives the
 * two decisions this file pins:
 *
 *   - D-04 (reserved-for-others): a handle FREED by user X (now in X's history) is
 *     reserved — user Y cannot claim it; the RPC raises and Y's handle is unchanged.
 *   - D-05 (owner self-reclaim): user X CAN change back to their OWN prior handle; the
 *     RPC succeeds AND clears that `username_history` row (the self-reclaim DELETE,
 *     RPC sketch lines 120-123), so the handle returns to being a live username and the
 *     redirect view no longer resolves it.
 *
 * RED STATE: migration 027 (the `change_username` RPC + `username_history` table) does
 * not exist yet — every RPC call errors on a missing function and every
 * `username_history` read errors on a missing relation. That IS the intended Wave-0 RED.
 *
 * Live local Supabase stack, no DB stubbing. Assert on OUTCOME (row state / error
 * presence), never on message text.
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

/** Onboarded owner (the change_username eligibility window). onboarded_at is not protected. */
async function createOnboardedUser(
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
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', user.id);
  expect(error).toBeNull();
  return { user, client };
}

beforeAll(async () => {
  await sweepLeftoverTestUsers();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(...createdIds.filter(Boolean));
});

describe('D-04 — a handle freed by user X is reserved for OTHER users', () => {
  it('Y cannot claim X freed handle (union-uniqueness on username_history); Y handle unchanged', async () => {
    const xa = `rvxa${RUN}`.slice(0, 30); // X's original handle (becomes reserved)
    const xb = `rvxb${RUN}`.slice(0, 30); // X moves here, freeing xa
    const ya = `rvya${RUN}`.slice(0, 30); // Y's own handle

    const { client: clientX } = await createOnboardedUser('reserve X', xa);
    const { user: userY, client: clientY } = await createOnboardedUser('reserve Y', ya);

    // X frees xa by moving to xb → username_history row { old_handle: xa, user_id: X }.
    expect((await clientX.rpc('change_username', { new_username: xb })).error).toBeNull();

    // Y tries to grab xa — the RPC's `username_history WHERE old_handle = xa AND
    // user_id <> Y` backstop must REJECT it (D-04 reserved-for-others).
    const grab = await clientY.rpc('change_username', { new_username: xa });
    expect(grab.error).not.toBeNull();

    // Y's handle is untouched.
    const { data } = await admin
      .from('profiles')
      .select('username')
      .eq('id', userY.id)
      .single();
    expect(data!.username).toBe(ya);
  });

  it("X freed handle appears in username_history reserved to X (not another user)", async () => {
    const xa = `rvr${RUN}`.slice(0, 30);
    const xb = `rvr2${RUN}`.slice(0, 30);
    const { user: userX, client: clientX } = await createOnboardedUser('reserve hist', xa);
    expect((await clientX.rpc('change_username', { new_username: xb })).error).toBeNull();

    const { data } = await admin
      .from('username_history')
      .select('old_handle, user_id')
      .eq('old_handle', xa)
      .single();
    expect(data!.user_id).toBe(userX.id);
  });
});

describe('D-05 — the owner CAN reclaim their OWN prior handle; the history row is cleared', () => {
  it('X: A→B then B→A succeeds, A is live again, and the username_history row for A is gone', async () => {
    const a = `rca${RUN}`.slice(0, 30);
    const b = `rcb${RUN}`.slice(0, 30);
    const { user: userX, client: clientX } = await createOnboardedUser('reclaim X', a);

    // A → B: history row { old_handle: A, user_id: X } is written.
    expect((await clientX.rpc('change_username', { new_username: b })).error).toBeNull();
    const mid = await admin
      .from('username_history')
      .select('old_handle')
      .eq('old_handle', a)
      .maybeSingle();
    expect(mid.data?.old_handle).toBe(a); // reserved while X is on B

    // B → A (self-reclaim): the RPC succeeds (own history hit is allowed) AND the
    // self-reclaim DELETE clears the A history row.
    const reclaim = await clientX.rpc('change_username', { new_username: a });
    expect(reclaim.error).toBeNull();

    // A is the live username again.
    const { data: prof } = await admin
      .from('profiles')
      .select('username')
      .eq('id', userX.id)
      .single();
    expect(prof!.username).toBe(a);

    // The A history row is GONE (returned to being a live username, D-05).
    const after = await admin
      .from('username_history')
      .select('old_handle')
      .eq('old_handle', a)
      .maybeSingle();
    expect(after.data).toBeNull();
  });
});
