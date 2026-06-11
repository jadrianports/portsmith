/**
 * Unit coverage for the password-reset server actions — the enumeration-safe
 * request + the schema-gated password update (AUTH-04, D-07).
 *
 * Two actions, two contracts:
 *
 *   requestReset (D-07 / T-02-17) — an enumeration boundary. It MUST return the
 *   IDENTICAL generic "if an account exists, we've sent a link" outcome whether
 *   `resetPasswordForEmail` resolves, errors, OR throws. The action never inspects
 *   the result for an existence signal and never branches the message. It also
 *   passes a `redirectTo` ending in `/auth/confirm` (the shared Plan 04 recovery
 *   handler appends `?token_hash&type=recovery`).
 *
 *   updatePassword (T-02-20 / CR-01) — re-parses `updatePasswordSchema` (min 8 /
 *   max 72) server-side BEFORE `updateUser`, so a too-short password is rejected
 *   before the credential write ever happens. The write runs ONLY on a RECOVERY
 *   session the verified OTP minted (Plan 04 confirm handler): the action inspects
 *   the verified claims' `amr` (getClaims under the hood, never `getSession()`) and
 *   rejects any session whose authentication method is not a recovery/otp one — so
 *   a normal `signInWithPassword` session (amr method `password`) is REJECTED, and
 *   only a recovery session (amr method `otp`) is allowed to change the password.
 *
 * Strategy: mock `@/lib/supabase/server` so `createClient().auth.resetPasswordForEmail`
 * / `.updateUser` are spies we drive per-case, and `getVerifiedClaims` is a spy for
 * the recovery-session guard (driven with recovery-shaped vs password-shaped claims).
 * Assert:
 *   - request outcome is identical for success AND error from resetPasswordForEmail
 *   - request passes redirectTo ending in /auth/confirm
 *   - a < 8 char password is rejected before updateUser is called
 *   - NO session (null claims) → reject, updateUser never called
 *   - a NORMAL password session (amr method `password`) → reject (CR-01 regression)
 *   - a RECOVERY session (amr method `otp`) → updateUser called
 *   - source discipline: 'use server' directive + no `.getSession(`
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// --- Mock the supabase server client + the verified-claims guard --------------
const resetPasswordForEmail = vi.fn();
const updateUser = vi.fn();
const getVerifiedClaims = vi.fn();
// D-06/D-11: requestReset gains a BotID gate + per-IP throttle. Defaults: human +
// present subject + allowed, so the always-generic contract is unaffected; the
// isBot / over-cap cases assert it stays the same generic { ok:true, message }.
const checkBotId = vi.fn();
const countAndRecord = vi.fn();
const hashClientIpFromHeaders = vi.fn();

vi.mock('botid/server', () => ({
  checkBotId: (...args: unknown[]) => checkBotId(...args),
}));
vi.mock('@/lib/rate-limit/ledger', () => ({
  countAndRecord: (...args: unknown[]) => countAndRecord(...args),
}));
vi.mock('@/lib/trust/ip-hash', () => ({
  hashClientIpFromHeaders: (...args: unknown[]) => hashClientIpFromHeaders(...args),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmail(...args),
      updateUser: (...args: unknown[]) => updateUser(...args),
    },
  }),
  getVerifiedClaims: (...args: unknown[]) => getVerifiedClaims(...args),
}));
// next/headers is referenced transitively in some action setups; stub defensively.
vi.mock('next/headers', () => ({
  headers: async () => new Map(),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

// Import AFTER the mocks are registered.
import { isRecoverySession } from '@/lib/auth/recovery-session';
import {
  requestReset,
  updatePassword,
  type RequestResetResult,
  type UpdatePasswordResult,
} from '@/lib/auth/reset-actions';

/** Narrow to the request failure branch (throws if it was a success). */
function reqFail(result: RequestResetResult): Extract<RequestResetResult, { ok: false }> {
  if (result.ok) throw new Error('expected a failure result, got ok:true');
  return result;
}
/** Narrow to the update failure branch (throws if it was a success). */
function updFail(result: UpdatePasswordResult): Extract<UpdatePasswordResult, { ok: false }> {
  if (result.ok) throw new Error('expected a failure result, got ok:true');
  return result;
}

/** Verified-claims shape for a RECOVERY session (amr method `otp`). */
const RECOVERY_CLAIMS = {
  sub: 'u1',
  aal: 'aal1',
  amr: [{ method: 'otp', timestamp: 1780293397 }],
};
/** Verified-claims shape for a NORMAL password session (amr method `password`). */
const PASSWORD_CLAIMS = {
  sub: 'u1',
  aal: 'aal1',
  amr: [{ method: 'password', timestamp: 1780293397 }],
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  // D-06/D-11: default to "human" + present hashed-IP subject + allowed.
  checkBotId.mockReset().mockResolvedValue({ isBot: false });
  hashClientIpFromHeaders.mockReset().mockResolvedValue('hashed-ip');
  countAndRecord.mockReset().mockResolvedValue(true);
  resetPasswordForEmail.mockReset().mockResolvedValue({ data: {}, error: null });
  updateUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  // Default to a recovery session so the happy path proceeds; individual tests
  // override with PASSWORD_CLAIMS / null to drive the gate.
  getVerifiedClaims.mockReset().mockResolvedValue(RECOVERY_CLAIMS);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('requestReset — Zod gate (server-side, before resetPasswordForEmail)', () => {
  it('rejects an invalid email with a field error and never sends', async () => {
    const result = await requestReset({ email: 'not-an-email' });
    expect(reqFail(result).fieldErrors?.email).toBeTruthy();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe('requestReset — always-generic (enumeration-safe, D-07 / T-02-17)', () => {
  it('returns the generic outcome when resetPasswordForEmail RESOLVES', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const result = await requestReset({ email: 'real.user@gmail.com' });
    expect(result.ok).toBe(true);
  });

  it('returns the IDENTICAL generic outcome when resetPasswordForEmail ERRORS', async () => {
    // Success case.
    resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });
    const onSuccess = await requestReset({ email: 'real.user@gmail.com' });

    // Error case (e.g. an unknown email surfacing an error) — must look identical.
    resetPasswordForEmail.mockResolvedValueOnce({
      data: {},
      error: { code: 'over_email_send_rate_limit', message: 'boom', status: 429 },
    });
    const onError = await requestReset({ email: 'ghost@gmail.com' });

    expect(onError.ok).toBe(onSuccess.ok);
    expect(Object.keys(onError).sort()).toEqual(Object.keys(onSuccess).sort());
    if (onSuccess.ok && onError.ok) {
      expect(onError.message).toBe(onSuccess.message);
    }
  });

  it('returns the SAME generic outcome even when resetPasswordForEmail THROWS', async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });
    const onSuccess = await requestReset({ email: 'real.user@gmail.com' });

    resetPasswordForEmail.mockImplementationOnce(() => {
      throw new Error('network down');
    });
    const onThrow = await requestReset({ email: 'ghost@gmail.com' });

    expect(onThrow.ok).toBe(onSuccess.ok);
    expect(Object.keys(onThrow).sort()).toEqual(Object.keys(onSuccess).sort());
  });

  it('passes a redirectTo ending in /auth/confirm', async () => {
    await requestReset({ email: 'real.user@gmail.com' });
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    const [emailArg, optsArg] = resetPasswordForEmail.mock.calls[0] as [
      string,
      { redirectTo: string },
    ];
    expect(emailArg).toBe('real.user@gmail.com');
    expect(optsArg.redirectTo).toMatch(/\/auth\/confirm$/);
  });
});

describe('requestReset — BotID gate (D-06/D-07 — stays always-generic)', () => {
  it('on isBot returns the SAME generic { ok:true, message } and never sends', async () => {
    checkBotId.mockResolvedValue({ isBot: true });
    const result = await requestReset({ email: 'real.user@gmail.com' });
    expect(result.ok).toBe(true); // never a distinct bot signal
    if (result.ok) expect(result.message).toBeTruthy();
    expect(countAndRecord).not.toHaveBeenCalled(); // no ledger write for a bot (Pitfall 3)
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe('updatePassword — schema gate before updateUser (T-02-20)', () => {
  it('rejects a too-short password BEFORE calling updateUser', async () => {
    const result = await updatePassword({ password: 'short' }); // 5 chars < 8
    expect(updFail(result).fieldErrors?.password).toBeTruthy();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('requires a session before updateUser (no session → reject)', async () => {
    getVerifiedClaims.mockResolvedValue(null);
    const result = await updatePassword({ password: 'a-good-long-password' });
    expect(updFail(result)).toBeTruthy();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('REJECTS a normal password session — updateUser never called (CR-01)', async () => {
    // A logged-in user with a plain password session (amr method `password`) must
    // NOT be able to change their password here — only a recovery session may.
    getVerifiedClaims.mockResolvedValue(PASSWORD_CLAIMS);
    const result = await updatePassword({ password: 'a-good-long-password' });
    const f = updFail(result);
    expect(f.error).toBeTruthy(); // NO_RECOVERY_SESSION message
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('calls updateUser({ password }) on a valid password + RECOVERY session', async () => {
    getVerifiedClaims.mockResolvedValue(RECOVERY_CLAIMS);
    const result = await updatePassword({ password: 'a-good-long-password' });
    expect(result.ok).toBe(true);
    expect(updateUser).toHaveBeenCalledTimes(1);
    const arg = updateUser.mock.calls[0][0] as { password: string };
    expect(arg.password).toBe('a-good-long-password');
  });
});

describe('isRecoverySession — the recovery-session predicate (CR-01)', () => {
  it('accepts claims whose amr carries an otp/recovery method', () => {
    expect(isRecoverySession(RECOVERY_CLAIMS)).toBe(true);
    expect(isRecoverySession({ amr: [{ method: 'recovery' }] })).toBe(true);
  });

  it('rejects a plain password session and malformed/empty claims', () => {
    expect(isRecoverySession(PASSWORD_CLAIMS)).toBe(false);
    expect(isRecoverySession(null)).toBe(false);
    expect(isRecoverySession(undefined)).toBe(false);
    expect(isRecoverySession({})).toBe(false);
    expect(isRecoverySession({ amr: [] })).toBe(false);
    expect(isRecoverySession({ amr: 'not-an-array' })).toBe(false);
  });
});

describe('reset-actions — source discipline (AUTH-05)', () => {
  it("begins with the 'use server' directive", () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const src = readFileSync(join(process.cwd(), 'src/lib/auth/reset-actions.ts'), 'utf-8');
    const firstCode = src
      .split('\n')
      .map((l: string) => l.trim())
      .find(
        (l: string) =>
          l.length > 0 && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*'),
      );
    expect(firstCode).toMatch(/^['"]use server['"];?$/);
  });

  it('does not contain a real .getSession( call (verified-identity discipline)', () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const src = readFileSync(join(process.cwd(), 'src/lib/auth/reset-actions.ts'), 'utf-8');
    expect(src).not.toMatch(/\.getSession\(/);
  });
});
