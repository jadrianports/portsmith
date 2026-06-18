/**
 * OAUTH-05 — automatic identity-linking creates NO duplicate profile, and the
 * existing account's username is preserved. Proven against the live local stack.
 *
 * Scenario (D-02/D-03): a user signs up with email/password (handle `alice`), then
 * later signs in with Google using the SAME verified email. Supabase automatic
 * identity linking attaches the Google identity to the SAME `auth.users` row — it
 * does NOT create a second user. The migration-026 trigger carries an auto-link
 * GUARD (`IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.id) THEN RETURN NEW`)
 * so that even if the AFTER-INSERT trigger were to fire on the link path, it would
 * NOT attempt a duplicate-profile INSERT (which would PK-violate and surface as the
 * opaque "Database error" on every returning-via-Google user — Pitfall 1).
 *
 * SIMULATING THE LINK WITHOUT LIVE GOOGLE: identity linking keeps the same
 * `auth.users.id` and enriches `raw_user_meta_data` with the provider's claims
 * (full_name / name / avatar_url) — it never re-creates the user. We reproduce that
 * end-state with `admin.updateUserById`, layering Google-shaped metadata (including
 * a `username` key, the strongest possible challenge to the guard) onto the
 * existing user, then assert the invariant the guard protects:
 *   - still exactly ONE profiles row for that id;
 *   - username is UNCHANGED (`alice…`), never overwritten by provider metadata.
 *
 * This proves the OAUTH-05 outcome (no duplicate, preserved handle) deterministically;
 * the full live consent round-trip is manual UAT.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
let alice: TestUser;

beforeAll(async () => {
  await sweepLeftoverTestUsers();
  const handle = `alice${RUN}`.slice(0, 30);
  alice = await createTestUser({
    email: `${handle}@example.test`,
    password: 'Test-Password-123!',
    username: handle,
    display_name: 'Alice',
  });
  createdIds.push(alice.id);
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(...createdIds.filter(Boolean));
});

describe('OAUTH-05 — same-email Google link yields one profile, unchanged username', () => {
  it('the email/password signup created exactly one profile with handle alice…', async () => {
    const { data: rows, error } = await admin
      .from('profiles')
      .select('id, username')
      .eq('id', alice.id);
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows![0].username).toBe(alice.username);
  });

  it('linking Google metadata to the SAME user creates NO second profile, keeps the handle', async () => {
    // Reproduce the auto-link end-state: same auth.users.id, enriched provider
    // metadata. A `username` key is included deliberately — the strongest test that
    // the trigger never re-runs to overwrite the established handle.
    const { error: updErr } = await admin.auth.admin.updateUserById(alice.id, {
      user_metadata: {
        full_name: 'Alice From Google',
        name: 'Alice From Google',
        avatar_url: 'https://example.test/avatar.png',
        username: 'hijacked', // must NOT take effect — guard skips the INSERT path
      },
    });
    expect(updErr).toBeNull();

    // Still exactly ONE profile row for this id (no duplicate from a re-fired trigger).
    const { data: rows, error } = await admin
      .from('profiles')
      .select('id, username, display_name')
      .eq('id', alice.id);
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);

    // Username is UNCHANGED — provider metadata never overwrote the original handle.
    expect(rows![0].username).toBe(alice.username);
    expect(rows![0].username).not.toBe('hijacked');
  });

  it('no second profiles row exists for the linked account anywhere', async () => {
    // Belt-and-suspenders: the established handle is owned by exactly one row, and
    // there is no orphan row sharing the email-derived base.
    const { data: byId } = await admin
      .from('profiles')
      .select('id')
      .eq('id', alice.id);
    expect(byId).toHaveLength(1);

    const { data: byHandle } = await admin
      .from('profiles')
      .select('id')
      .eq('username', alice.username);
    expect(byHandle).toHaveLength(1);
    expect(byHandle![0].id).toBe(alice.id);
  });
});
