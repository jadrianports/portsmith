/**
 * ACCT-02 — change email, new address confirmed via email link (secure
 * double-confirm, D-05/D-06/D-07/D-08).
 *
 * WAVE-0 RED SCAFFOLD. Two seams are proven against the REAL local stack:
 *
 *   SEAM A (Mailpit two-OTP, the production path): a signed-in client calls
 *   `updateUser({ email: newEmail })` → gotrue (with `double_confirm_changes`)
 *   sends TWO emails (old + new inbox), each with a distinct `token_hash`,
 *   both `type=email_change`. We poll Mailpit, extract both hashes, and
 *   `verifyOtp({ type:'email_change', token_hash })` each → `admin.getUserById`
 *   shows the NEW email.
 *
 *   SEAM B (admin.generateLink, mail-catcher-free): mint the two token_hashes
 *   directly via `admin.generateLink({ type:'email_change_current' | 'email_change_new' })`
 *   — `email_change_current`/`email_change_new` are GenerateLinkType values (admin
 *   API), distinct from the single `EmailOtpType` literal `'email_change'` that
 *   `verifyOtp` (and the /auth/confirm route) consume — then `verifyOtp` each.
 *
 * ⚠️ EXPECTED RED in plan 19-01: the `[auth.email.template.email_change]` config +
 * `change-email.html` authored in this plan only take effect after Supabase is
 * RESTARTED (the orchestrator does that before Wave 2). Until then SEAM A finds a
 * default `{{ .ConfirmationURL }}` link (no token_hash) → zero hashes → red, and
 * SEAM B's `email_change_*` generateLink may also behave differently pre-reload.
 * That is the intended red this Wave-2 slice turns green. The verify gate for plan
 * 19-01 is `tsc --noEmit`, not a green run of this file.
 *
 * D-18 corroboration: after the change, `auth.users.email` reflects the new email
 * (admin view) while `profiles.email` is left stale — the app reads claims, never
 * `profiles.email`, so the staleness is harmless.
 *
 * LOCAL STACK ONLY — `*@example.test` is a reserved test domain.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  adminClient,
  cleanupTestUsers,
  createTestUser,
  sweepLeftoverTestUsers,
  type TestUser,
} from '../_setup';

import { verifyCurrentPassword } from '@/lib/auth/reauth';

import { clearMailpit, fetchChangeEmailTokens } from './_mailpit';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);
const createdIds: string[] = [];

const PASSWORD = 'Test-Password-123!';

function anon(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

async function signIn(user: TestUser): Promise<SupabaseClient> {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({
    email: user.email,
    password: PASSWORD,
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

describe('ACCT-02 — reauth required before the email change (D-01/D-07)', () => {
  it('verifyCurrentPassword gates the change: wrong password → false', async () => {
    const name = `cem0${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: PASSWORD,
      username: name,
      display_name: 'Change Email Reauth',
    });
    createdIds.push(user.id);

    // The change-email action runs reauth FIRST; a wrong password must reject
    // BEFORE any updateUser({email}) call.
    expect(await verifyCurrentPassword(user.email, 'wrong-password')).toBe(false);
    expect(await verifyCurrentPassword(user.email, PASSWORD)).toBe(true);
  });
});

describe('ACCT-02 — SEAM A: secure double-confirm via Mailpit two OTPs (D-05)', () => {
  it('updateUser({email}) emits TWO emails; both verifyOtp(email_change) → new email live', async () => {
    const name = `cem1${RUN}`.slice(0, 30);
    const oldEmail = `${name}@example.test`;
    const newEmail = `${name}-new@example.test`;
    const user = await createTestUser({
      email: oldEmail,
      password: PASSWORD,
      username: name,
      display_name: 'Change Email A',
    });
    createdIds.push(user.id);

    await clearMailpit();
    const owner = await signIn(user);

    // Kick off the secure email change (the action does this after reauth).
    const { error: updErr } = await owner.auth.updateUser({ email: newEmail });
    expect(updErr).toBeNull();

    // double_confirm_changes=true → TWO messages (old + new inbox), each with its
    // own token_hash, both type=email_change. Poll Mailpit for both.
    const oldTokens = await fetchChangeEmailTokens(oldEmail, { expect: 1 });
    const newTokens = await fetchChangeEmailTokens(newEmail, { expect: 1 });

    // EXPECTED RED until Supabase is restarted with the new template (see header).
    expect(oldTokens.length + newTokens.length).toBeGreaterThanOrEqual(2);

    // Verify BOTH OTPs (order-independent); the change takes effect only after both.
    for (const token_hash of [...oldTokens, ...newTokens]) {
      const v = await anon().auth.verifyOtp({ type: 'email_change', token_hash });
      expect(v.error).toBeNull();
    }

    // auth.users.email is now the NEW email (D-18: profiles.email goes stale —
    // not asserted here, harmless by design).
    const view = await admin.auth.admin.getUserById(user.id);
    expect(view.error).toBeNull();
    expect(view.data.user?.email).toBe(newEmail);
  });
});

describe('ACCT-02 — SEAM B: the admin.generateLink email-change seam (mail-catcher-free)', () => {
  // 19-03 CORRECTION (Rule 1 — fixing the 19-01 RED scaffold's premise against the
  // installed gotrue). The original SEAM B assumed you could mint the two
  // double-confirm halves as TWO separate `generateLink` calls and then pair them
  // through the CLIENT `verifyOtp({type:'email_change'})` path. That premise is
  // WRONG for this gotrue version (verified against the auth source + a live probe):
  //   1) Each `generateLink({type:'email_change_*'})` runs the full `sendEmailChange`,
  //      which re-mints BOTH tokens and resets `email_change_confirm_status` to zero,
  //      and `CreateOneTimeToken` CLEARS the prior token of that type — so a second
  //      call invalidates the first call's matching half (every ordering → otp_expired
  //      on the second verify, email never flips).
  //   2) `generateLink` mints tokens for the LINK-CLICK flow (the `action_link`'s
  //      `/auth/confirm?token_hash=…&type=email_change` GET → server-side verify),
  //      NOT the client `verifyOtp` exchange — a single half through `verifyOtp`
  //      is itself rejected, while `new_email` is correctly left pending.
  // The matched-pair, both-OTPs-confirmed, email-flips truth is therefore owned
  // end-to-end by SEAM A (the production `updateUser({email})` → two Mailpit OTPs
  // path above), which passes green. SEAM B here asserts only what the admin seam
  // TRUTHFULLY provides without a mail catcher: each half mints a valid
  // `hashed_token` + an `action_link` carrying the `type=email_change` form the
  // hardened /auth/confirm route consumes, and `generateLink` INITIATES the secure
  // double-confirm (the user's `new_email` goes pending). No `verifyOtp` pairing —
  // that is unreachable via `generateLink` under `double_confirm_changes`.
  it('email_change_current + email_change_new generateLink mint the confirm-link halves and set the pending change', async () => {
    const name = `cem2${RUN}`.slice(0, 30);
    const oldEmail = `${name}@example.test`;
    const newEmail = `${name}-new@example.test`;
    const user = await createTestUser({
      email: oldEmail,
      password: PASSWORD,
      username: name,
      display_name: 'Change Email B',
    });
    createdIds.push(user.id);

    // email_change_current / email_change_new are GenerateLinkType values (admin
    // API) — the two halves of the secure double-confirm. Each mints the
    // token_hash + action_link form the /auth/confirm route consumes with the
    // SINGLE EmailOtpType 'email_change'.
    const current = await admin.auth.admin.generateLink({
      type: 'email_change_current',
      email: oldEmail,
      newEmail,
    });
    const next = await admin.auth.admin.generateLink({
      type: 'email_change_new',
      email: oldEmail,
      newEmail,
    });

    expect(current.error).toBeNull();
    expect(next.error).toBeNull();

    // Each half mints a usable token_hash and an action_link that lands on the
    // hardened confirm route with type=email_change (the literal added in 19-01).
    const currentHash = current.data.properties?.hashed_token;
    const nextHash = next.data.properties?.hashed_token;
    expect(currentHash).toBeTruthy();
    expect(nextHash).toBeTruthy();
    expect(current.data.properties?.action_link).toContain('type=email_change');
    expect(next.data.properties?.action_link).toContain('type=email_change');

    // The admin seam INITIATED the secure double-confirm: the change is pending
    // (new_email is set), and the live email is unchanged until both halves are
    // confirmed via the link-click flow (proven end-to-end by SEAM A).
    const view = await admin.auth.admin.getUserById(user.id);
    expect(view.error).toBeNull();
    expect(view.data.user?.new_email).toBe(newEmail);
    expect(view.data.user?.email).toBe(oldEmail);
  });
});
