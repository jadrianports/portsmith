/**
 * AUTH-02 — email-confirmation session establishment, proven against the live
 * local stack.
 *
 * The Wave-2 `/auth/confirm` route (02-04) will call `verifyOtp({ type: 'email',
 * token_hash })` to turn a single-use confirmation token into a real session.
 * This integration test pins that primitive directly (Pitfall 2: `verifyOtp`,
 * NOT `exchangeCodeForSession`) so the route is built against verified behavior.
 *
 * TOKEN SOURCE: we mint the `token_hash` with
 * `adminClient.auth.admin.generateLink({ type: 'signup', email })` rather than
 * scraping the local mail catcher — `generateLink` returns
 * `data.properties.hashed_token`, exactly the `token_hash` the email template
 * (Task 1) carries to `/auth/confirm`. This keeps the integration test
 * mail-catcher-free; the Playwright smoke (Wave 3) still reads the real email.
 *
 * BEHAVIORS ASSERTED:
 *   - A freshly signed-up user is email-UNCONFIRMED (no `email_confirmed_at`).
 *   - `verifyOtp({ type: 'email', token_hash })` on a fresh anon client
 *     establishes a session whose `getClaims()`/`getUser()` resolves to that user.
 *   - After confirmation the admin view of the user shows `email_confirmed_at`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

import {
  adminClient,
  cleanupTestUsers,
  sweepLeftoverTestUsers,
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

function anon() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

describe('AUTH-02 — email confirmation establishes a session via verifyOtp(type:email)', () => {
  it('an unconfirmed signUp is email-unconfirmed until verifyOtp confirms it', async () => {
    const email = `confirm-${RUN}@example.test`;
    const username = `confirm${RUN}`.slice(0, 30);

    // 1) Public anon signUp — with confirmations enabled (Task 1) this creates
    //    an UNCONFIRMED user. The live `handle_new_user` trigger provisions the
    //    profile from user_metadata.
    const signup = await anon().auth.signUp({
      email,
      password: 'Test-Password-123!',
      options: { data: { username, display_name: 'Confirm Me' } },
    });
    expect(signup.error).toBeNull();
    const userId = signup.data.user?.id;
    expect(userId).toBeTruthy();
    if (userId) createdIds.push(userId);

    // 2) BEFORE confirm: the user must NOT be confirmed (cannot act as confirmed).
    const before = await admin.auth.admin.getUserById(userId!);
    expect(before.error).toBeNull();
    expect(before.data.user?.email_confirmed_at ?? null).toBeNull();

    // 3) Mint a confirmation token_hash directly (no mail-catcher scrape). This
    //    is the exact token the Task-1 email template carries to /auth/confirm.
    const link = await admin.auth.admin.generateLink({
      type: 'signup',
      email,
      password: 'Test-Password-123!',
    });
    expect(link.error).toBeNull();
    const tokenHash = link.data.properties?.hashed_token;
    expect(tokenHash).toBeTruthy();

    // 4) verifyOtp on a FRESH anon client — the Wave-2 confirm route's primitive.
    const client = anon();
    const verified = await client.auth.verifyOtp({
      type: 'email',
      token_hash: tokenHash!,
    });
    expect(verified.error).toBeNull();
    expect(verified.data.session).not.toBeNull();
    expect(verified.data.user?.id).toBe(userId);

    // 5) The session is real: getClaims() resolves to the same user.
    const claims = await client.auth.getClaims();
    expect(claims.error).toBeNull();
    expect(claims.data?.claims?.sub).toBe(userId);

    // 6) AFTER confirm: the admin view now shows the user as confirmed.
    const after = await admin.auth.admin.getUserById(userId!);
    expect(after.error).toBeNull();
    expect(after.data.user?.email_confirmed_at ?? null).not.toBeNull();
  });
});
