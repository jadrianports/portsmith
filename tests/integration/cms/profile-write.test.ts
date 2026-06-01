// CMS-02 — turned GREEN by 04-04 (the profile save action, allowlisted columns).
// Threat ref: T-protected-cols.
//
// Wave-0 RED scaffold (04-01). INTENTIONALLY failing: imports the not-yet-built
// `saveProfileAction` so the import fails to resolve until 04-04 ships it (RED is
// the contract — 04-VALIDATION.md). The DB-level assertions describe the invariant
// the action must uphold; 04-04 turns this file GREEN.
//
// Behavior under test (the protected-columns trigger guards profiles):
//   - an ALLOWLISTED profile update (display_name / headline / resume_url /
//     avatar_url) SUCCEEDS for the owner;
//   - an update touching `username` (one of the 8 protected cols) is REJECTED by
//     `enforce_protected_profile_columns` (non-null error, /protected profile
//     column/i) — the action must build an explicit allowlist, never `...parsed`
//     (04-RESEARCH Pitfall 4).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  adminClient,
  cleanupTestUsers,
  createTestUser,
  sweepLeftoverTestUsers,
  type TestUser,
} from '../_setup';

// @ts-expect-error — RED: 04-04 creates this server action; module does not exist yet.
import { saveProfileAction } from '@/lib/cms/save-profile-action';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

let userA: TestUser;
let ownerA: SupabaseClient;

beforeAll(async () => {
  await sweepLeftoverTestUsers();
  const name = `cmspw${RUN}`.slice(0, 30);
  userA = await createTestUser({
    email: `${name}@example.test`,
    password: 'Test-Password-123!',
    username: name,
    display_name: 'CMS profile-write User A',
  });
  ownerA = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await ownerA.auth.signInWithPassword({
    email: userA.email,
    password: userA.password,
  });
  expect(error).toBeNull();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(userA?.id);
});

describe('CMS-02 — profile save: allowlist passes, protected column rejected', () => {
  it('an ALLOWLISTED update (display_name/headline) succeeds for the owner', async () => {
    expect(typeof saveProfileAction).toBe('function');
    const newName = `Allowed ${RUN}`;
    const { error } = await ownerA
      .from('profiles')
      .update({ display_name: newName, headline: 'A tagline' })
      .eq('id', userA.id)
      .select();
    expect(error).toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', userA.id)
      .single();
    expect(data!.display_name).toBe(newName);
  });

  it('updating `username` (a protected column) is REJECTED by the trigger', async () => {
    const { error } = await ownerA
      .from('profiles')
      .update({ username: `hijacked-${RUN}`.slice(0, 30) })
      .eq('id', userA.id)
      .select();
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/protected profile column/i);
  });
});
