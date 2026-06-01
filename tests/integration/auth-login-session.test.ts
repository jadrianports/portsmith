/**
 * AUTH-03 — login + session/getClaims for a confirmed user, proven against the
 * live local stack.
 *
 * The Wave-2 login action (02-04) calls `signInWithPassword` and then relies on
 * the verified-identity discipline (`getClaims()`/`getUser()`, NEVER
 * `getSession()` for authz — see CLAUDE.md + src/lib/supabase/server.ts). This
 * test pins that primitive: a confirmed user signs in, a real session is
 * returned, and `getClaims()` validates the JWT to the same user.
 *
 * USER SOURCE: `createTestUser({ email_confirm: true })` (_setup.ts) mints a
 * CONFIRMED user via the service-role admin API, exercising the real
 * `handle_new_user` trigger — so this is a true "confirmed user can log in" path.
 *
 * BEHAVIORS ASSERTED:
 *   - `signInWithPassword` succeeds (no error, a session + access_token).
 *   - `getClaims()` (verified) resolves to the signed-in user's id.
 *   - The session shape carries access_token + refresh_token + user (the cookie
 *     payload the @supabase/ssr middleware persists/refreshes).
 *   - A WRONG password fails (negative control — login isn't a no-op pass).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  cleanupTestUsers,
  createTestUser,
  sweepLeftoverTestUsers,
  userClient,
} from './_setup';

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

describe('AUTH-03 — confirmed user logs in; getClaims + session shape are valid', () => {
  it('signInWithPassword succeeds and getClaims() verifies to the same user', async () => {
    const name = `login${RUN}`.slice(0, 30);
    const password = 'Test-Password-123!';
    const user = await createTestUser({
      email: `${name}@example.test`,
      password,
      username: name,
      display_name: 'Login User',
    });
    createdIds.push(user.id);

    const client = userClient();
    const signIn = await client.auth.signInWithPassword({
      email: user.email,
      password,
    });
    expect(signIn.error).toBeNull();
    expect(signIn.data.session).not.toBeNull();

    // Session persistence shape — the payload @supabase/ssr stores in cookies and
    // the middleware refreshes (CLAUDE.md §3).
    expect(signIn.data.session?.access_token).toBeTruthy();
    expect(signIn.data.session?.refresh_token).toBeTruthy();
    expect(signIn.data.session?.user?.id).toBe(user.id);

    // Verified identity — getClaims() validates the JWT (never getSession() for authz).
    const claims = await client.auth.getClaims();
    expect(claims.error).toBeNull();
    expect(claims.data?.claims?.sub).toBe(user.id);
  });

  it('a wrong password fails (login is a real gate, not a pass-through)', async () => {
    const name = `loginbad${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: 'Test-Password-123!',
      username: name,
      display_name: 'Login Bad',
    });
    createdIds.push(user.id);

    const client = userClient();
    const signIn = await client.auth.signInWithPassword({
      email: user.email,
      password: 'Wrong-Password-999!',
    });
    expect(signIn.error).not.toBeNull();
    expect(signIn.data.session).toBeNull();
  });
});
