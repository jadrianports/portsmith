/**
 * OAUTH-03 / OAUTH-04 — the migration-026 provisional-username trigger carve-out,
 * proven against the live local stack.
 *
 * Google OAuth supplies NO `username` in `raw_user_meta_data`. The pre-026 trigger
 * RAISEd "username is required at signup" → every OAuth create failed. Migration
 * 026 rewrites `handle_new_user` so a no-username create derives a collision-safe,
 * format-valid, non-reserved handle INSIDE the trigger (D-04/D-05), keeping
 * username assignment atomic with profile creation (no NULL-username window).
 *
 * We simulate an OAuth-shaped create via the service-role admin API with empty
 * `user_metadata` — no live Google needed (the consent round-trip is manual UAT).
 *
 * Asserts:
 *   - exactly ONE profiles row for the created id;
 *   - its username matches USERNAME_REGEX, length 3–30, NOT in RESERVED_USERNAMES;
 *   - a second create whose email local-part sanitizes to the SAME base yields a
 *     DISTINCT (suffixed) handle — the collision-suffix loop is exercised.
 *
 * ERROR-SHAPE NOTE: when the trigger RAISEs, GoTrue wraps it as a generic 500; the
 * happy path here should NOT raise — a successful create with a provisioned handle.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { USERNAME_REGEX, RESERVED_USERNAMES } from '@/lib/validations/username';

import {
  adminClient,
  cleanupTestUsers,
  sweepLeftoverTestUsers,
} from './_setup';

const admin = adminClient();
// WR-09: collision-proof per-run token (see _setup.ts sweepLeftoverTestUsers).
const RUN = crypto.randomUUID().slice(0, 8);

const createdIds: string[] = [];

beforeAll(async () => {
  await sweepLeftoverTestUsers();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(...createdIds.filter(Boolean));
});

/**
 * Create an OAuth-shaped user: `email_confirm: true` (provider-verified email) +
 * EMPTY user_metadata (no username), exercising the 026 trigger carve-out.
 */
async function createOAuthUser(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {}, // NO username — the OAuth shape
  });
  if (error || !data.user) {
    throw new Error(
      `[oauth-provisional] createUser failed for ${email}: ${
        error?.message ?? 'no user'
      }`,
    );
  }
  createdIds.push(data.user.id);
  return data.user.id;
}

describe('OAUTH-03/04 — no-username OAuth create gets a valid provisional handle', () => {
  it('creates exactly one profile with a format-valid, non-reserved handle', async () => {
    // local-part "janedoe<RUN>" — sanitizes to a valid base.
    const id = await createOAuthUser(`janedoe${RUN}@gmail.example.test`);

    const { data: rows, error } = await admin
      .from('profiles')
      .select('id, username')
      .eq('id', id);
    expect(error).toBeNull();
    // Exactly one profile row — atomic with the auth.users INSERT (OAUTH-04).
    expect(rows).toHaveLength(1);

    const username: string = rows![0].username;
    expect(typeof username).toBe('string');
    // Format-valid (USERNAME_REGEX), length 3–30, NOT reserved (CR-03).
    expect(USERNAME_REGEX.test(username)).toBe(true);
    expect(username.length).toBeGreaterThanOrEqual(3);
    expect(username.length).toBeLessThanOrEqual(30);
    expect(RESERVED_USERNAMES.has(username)).toBe(false);
    // Derived from the local part.
    expect(username.startsWith('janedoe')).toBe(true);
  });

  it('a second create on the same base gets a DISTINCT suffixed handle (collision-safe)', async () => {
    // Two different emails whose local parts sanitize to the same base.
    const base = `collide${RUN}`;
    const first = await createOAuthUser(`${base}@gmail.example.test`);
    const second = await createOAuthUser(`${base}@outlook.example.test`);

    const { data: rows, error } = await admin
      .from('profiles')
      .select('id, username')
      .in('id', [first, second]);
    expect(error).toBeNull();
    expect(rows).toHaveLength(2);

    const byId = new Map(rows!.map((r) => [r.id, r.username as string]));
    const u1 = byId.get(first)!;
    const u2 = byId.get(second)!;

    // Both valid; both share the base; the two handles are DISTINCT.
    expect(USERNAME_REGEX.test(u1)).toBe(true);
    expect(USERNAME_REGEX.test(u2)).toBe(true);
    expect(u1.startsWith(base)).toBe(true);
    expect(u2.startsWith(base)).toBe(true);
    expect(u1).not.toBe(u2);
    // Each stays within the 30-char cap even with the suffix.
    expect(u1.length).toBeLessThanOrEqual(30);
    expect(u2.length).toBeLessThanOrEqual(30);
  });

  it('an empty/short local part falls back to a "user"-based handle, still unique', async () => {
    // local part "ab" (< 3 chars) → 'user' fallback base.
    const id1 = await createOAuthUser(`ab@short${RUN}.example.test`);
    const id2 = await createOAuthUser(`a@short2${RUN}.example.test`);

    const { data: rows, error } = await admin
      .from('profiles')
      .select('id, username')
      .in('id', [id1, id2]);
    expect(error).toBeNull();
    expect(rows).toHaveLength(2);

    for (const r of rows!) {
      const u = r.username as string;
      expect(USERNAME_REGEX.test(u)).toBe(true);
      expect(u.startsWith('user')).toBe(true);
      expect(RESERVED_USERNAMES.has(u)).toBe(false);
    }
    const handles = rows!.map((r) => r.username);
    expect(new Set(handles).size).toBe(2); // distinct
  });
});
