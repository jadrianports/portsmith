/**
 * AUTH-04 — password reset → recovery token → updateUser, proven against the
 * live local stack.
 *
 * The Wave-3 reset flow (02-05): `resetPasswordForEmail` sends a recovery email
 * whose token_hash lands on `/auth/confirm?type=recovery`, the confirm route
 * `verifyOtp({ type: 'recovery', token_hash })` to establish a short-lived
 * recovery session, then `/update-password` calls `updateUser({ password })`.
 * This test pins the token mechanics end-to-end.
 *
 * TOKEN SOURCE: mint the recovery `token_hash` with
 * `adminClient.auth.admin.generateLink({ type: 'recovery', email })` (returns
 * `data.properties.hashed_token`) — same token shape the Task-1 recovery
 * template carries — instead of scraping the mail catcher.
 *
 * BEHAVIORS ASSERTED:
 *   - `verifyOtp({ type: 'recovery', token_hash })` establishes a (recovery) session.
 *   - `updateUser({ password: NEW })` on that session changes the password.
 *   - The NEW password authenticates; the OLD password no longer does.
 *
 * CR-01 REGRESSION (recovery-session gate):
 *   The `updatePassword` server action must require a *recovery* session, not any
 *   authenticated session. The distinguishing signal — confirmed empirically
 *   against this gotrue version — is the verified-claims `amr` array's `method`:
 *   a recovery (verifyOtp type:recovery) session carries `{ method: 'otp' }`, a
 *   normal `signInWithPassword` session carries `{ method: 'password' }`. We pin
 *   that signal with the EXACT predicate the action uses (`isRecoverySession`)
 *   against REAL claims from the live stack, in BOTH directions:
 *     - a normal password session's claims → predicate REJECTS (the action would
 *       return NO_RECOVERY_SESSION), and
 *     - a recovery session's claims → predicate ACCEPTS (and the end-to-end
 *       updateUser still works).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { isRecoverySession } from '@/lib/auth/reset-actions';

import {
  adminClient,
  cleanupTestUsers,
  createTestUser,
  sweepLeftoverTestUsers,
  userClient,
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

describe('AUTH-04 — recovery token → updateUser changes the password', () => {
  it('reset flow swaps the password: new authenticates, old fails', async () => {
    const name = `reset${RUN}`.slice(0, 30);
    const oldPassword = 'Test-Password-123!';
    const newPassword = 'New-Password-456!';
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: oldPassword,
      username: name,
      display_name: 'Reset User',
    });
    createdIds.push(user.id);

    // 1) Mint a recovery token_hash directly (the Task-1 recovery template's token).
    const link = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
    });
    expect(link.error).toBeNull();
    const tokenHash = link.data.properties?.hashed_token;
    expect(tokenHash).toBeTruthy();

    // 2) verifyOtp(type:'recovery') on a fresh client — establishes a recovery session.
    const client = userClient();
    const verified = await client.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash!,
    });
    expect(verified.error).toBeNull();
    expect(verified.data.session).not.toBeNull();
    expect(verified.data.user?.id).toBe(user.id);

    // 3) updateUser({ password }) on the recovery session — the actual reset.
    const updated = await client.auth.updateUser({ password: newPassword });
    expect(updated.error).toBeNull();
    expect(updated.data.user?.id).toBe(user.id);

    // 4) The NEW password authenticates.
    const withNew = await userClient().auth.signInWithPassword({
      email: user.email,
      password: newPassword,
    });
    expect(withNew.error).toBeNull();
    expect(withNew.data.session).not.toBeNull();

    // 5) The OLD password no longer authenticates.
    const withOld = await userClient().auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });
    expect(withOld.error).not.toBeNull();
    expect(withOld.data.session).toBeNull();
  });
});

describe('CR-01 — updatePassword requires a RECOVERY session, not any session', () => {
  it('a normal password session is NOT a recovery session (gate REJECTS it)', async () => {
    const name = `pwsess${RUN}`.slice(0, 30);
    const password = 'Test-Password-123!';
    const user = await createTestUser({
      email: `${name}@example.test`,
      password,
      username: name,
      display_name: 'Password Session User',
    });
    createdIds.push(user.id);

    // A NORMAL login — exactly the session a logged-in user already has.
    const client = userClient();
    const signin = await client.auth.signInWithPassword({
      email: user.email,
      password,
    });
    expect(signin.error).toBeNull();
    expect(signin.data.session).not.toBeNull();

    // The verified claims for this session (getClaims under the hood — the same
    // source getVerifiedClaims reads). The amr carries `password`, NOT `otp`.
    const { data, error } = await client.auth.getClaims();
    expect(error).toBeNull();
    const claims = data?.claims;
    expect(claims).toBeTruthy();
    // Pin the empirical signal so a gotrue change that drops `amr` is caught.
    expect(Array.isArray(claims?.amr)).toBe(true);

    // The ACTUAL gate the action uses must REJECT this session.
    expect(isRecoverySession(claims)).toBe(false);
  });

  it('a recovery session IS a recovery session (gate ACCEPTS it)', async () => {
    const name = `recsess${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: 'Test-Password-123!',
      username: name,
      display_name: 'Recovery Session User',
    });
    createdIds.push(user.id);

    const link = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
    });
    expect(link.error).toBeNull();
    const tokenHash = link.data.properties?.hashed_token;

    const client = userClient();
    const verified = await client.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash!,
    });
    expect(verified.error).toBeNull();

    const { data, error } = await client.auth.getClaims();
    expect(error).toBeNull();
    const claims = data?.claims;
    expect(claims).toBeTruthy();

    // The ACTUAL gate the action uses must ACCEPT this session.
    expect(isRecoverySession(claims)).toBe(true);
  });
});
