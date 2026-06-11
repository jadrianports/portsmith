/**
 * Unit coverage for the login server action — enumeration-safe + the one
 * sanctioned unconfirmed-user exception (AUTH-03, D-07).
 *
 * The login action is an enumeration boundary: a wrong email and a wrong password
 * MUST be indistinguishable (D-07 / Pitfall 3 / T-02-14). The ONLY sanctioned
 * signal is the unconfirmed-user prompt — Supabase surfaces `email_not_confirmed`,
 * and the action turns it into a distinct "please confirm your email — resend?"
 * outcome that drives the resend affordance. Everything else collapses to the
 * single generic "that email or password isn't right" message.
 *
 * The action also re-parses `loginSchema` server-side BEFORE `signInWithPassword`
 * (client validation is UX only; the server-boundary parse is the real gate —
 * contact.ts / signup-action posture).
 *
 * Strategy: mock `@/lib/supabase/server` so `createClient().auth.signInWithPassword`
 * is a spy whose result we drive per-case, and assert:
 *   - schema failure → field errors, signIn NEVER called (the server gate)
 *   - invalid credentials → the GENERIC message (no email-existence branch)
 *   - unconfirmed user → the distinct resend-prompt outcome (the D-07 exception)
 *   - success → ok:true (the form then navigates to the dashboard)
 *   - source discipline: 'use server' directive + no `.getSession(` (AUTH-05 guard)
 *
 * D-14 (06-07): after a successful sign-in the action calls `assertNotLocked`,
 * which reads the caller's OWN `profiles.locked` via the AUTHENTICATED client and
 * `getVerifiedClaims()`. The mock therefore also exposes `getVerifiedClaims` and a
 * `.from('profiles').select().eq().single()` chain (default `locked:false` so the
 * unchanged success path stays `ok:true`) + an `auth.signOut` spy. The D-14
 * locked→suspended path is proven against the LIVE stack in
 * tests/integration/auth/locked-login.test.ts; this unit suite proves the
 * credential contract is NOT weakened.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// --- Mock the supabase server client so signInWithPassword is a spy -----------
const signInWithPassword = vi.fn();
const signOut = vi.fn().mockResolvedValue({ error: null });
const profileSingle = vi.fn();
// D-06/D-11: the BotID gate + per-IP throttle. Defaults: human + present subject +
// allowed, so the unchanged credential contract is unaffected; the isBot/over-cap
// cases assert the enumeration-safe GENERIC_ERROR (NOT GENERIC_INVALID).
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
  // D-14: the verified-identity read used by assertNotLocked (post-sign-in).
  getVerifiedClaims: async () => ({ sub: 'u1' }),
  createClient: async () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signOut: (...args: unknown[]) => signOut(...args),
    },
    // The own-`locked` read chain: .from('profiles').select('locked').eq('id', sub).single()
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => profileSingle(),
        }),
      }),
    }),
  }),
}));
// next/headers is referenced transitively in some action setups; stub defensively.
vi.mock('next/headers', () => ({
  headers: async () => new Map(),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

// Import AFTER the mocks are registered.
import { loginAction, type LoginResult } from '@/lib/auth/login-action';

/** Narrow to the failure branch (throws if it was a success). */
function fail(result: LoginResult): Extract<LoginResult, { ok: false }> {
  if (result.ok) throw new Error('expected a failure result, got ok:true');
  return result;
}
/** Narrow to the success branch (throws if it was a failure). */
function ok(result: LoginResult): Extract<LoginResult, { ok: true }> {
  if (!result.ok) throw new Error('expected a success result, got ok:false');
  return result;
}

const VALID = {
  email: 'real.user@gmail.com',
  password: 'correct horse battery',
} as const;

function input(overrides: Record<string, unknown> = {}) {
  return { ...VALID, ...overrides };
}

/** Shape of a Supabase auth error with the `code` field the action keys off. */
function authError(code: string) {
  return { error: { code, message: 'GoTrue error', status: 400 }, data: { session: null, user: null } };
}

/** A Supabase auth error with an explicit status (and optional code) — for WR-04. */
function authErrorStatus(status: number, code?: string) {
  return {
    error: { code, message: 'GoTrue error', status },
    data: { session: null, user: null },
  };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  // D-06/D-11: default to "human" + present hashed-IP subject + allowed.
  checkBotId.mockReset().mockResolvedValue({ isBot: false });
  hashClientIpFromHeaders.mockReset().mockResolvedValue('hashed-ip');
  countAndRecord.mockReset().mockResolvedValue(true);
  signInWithPassword.mockReset().mockResolvedValue({
    data: { session: { access_token: 'a' }, user: { id: 'u1' } },
    error: null,
  });
  // D-14: default the own-`locked` read to NOT locked, so the unchanged success
  // path stays ok:true. Locked cases override per-test.
  profileSingle.mockReset().mockResolvedValue({ data: { locked: false }, error: null });
  signOut.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('loginAction — Zod gate (server-side, before signInWithPassword)', () => {
  it('rejects an invalid email with a field error and never calls signIn', async () => {
    const result = await loginAction(input({ email: 'not-an-email' }));
    expect(fail(result).fieldErrors?.email).toBeTruthy();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('rejects an empty password with a field error and never calls signIn', async () => {
    const result = await loginAction(input({ password: '' }));
    expect(fail(result).fieldErrors?.password).toBeTruthy();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('loginAction — BotID gate (D-06/D-07 — GENERIC_ERROR, NOT credential)', () => {
  const CREDENTIAL = /that email or password isn't right/i;
  it('on isBot returns GENERIC_ERROR (not the credential message) and never signs in', async () => {
    checkBotId.mockResolvedValue({ isBot: true });
    const result = await loginAction(input());
    const f = fail(result);
    expect(f.error).toMatch(/something went wrong/i); // GENERIC_ERROR
    expect(f.error).not.toMatch(CREDENTIAL); // bot != credential signal (Pitfall 2)
    expect(countAndRecord).not.toHaveBeenCalled(); // no ledger write for a bot (Pitfall 3)
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('loginAction — invalid credentials are enumeration-safe (D-07 / T-02-14)', () => {
  it('returns the GENERIC message on invalid_credentials (no existence branch)', async () => {
    signInWithPassword.mockResolvedValue(authError('invalid_credentials'));
    const result = await loginAction(input());
    const f = fail(result);
    expect(f.error).toMatch(/that email or password isn't right/i);
    // No unconfirmed branch leaked, no email echoed back.
    expect(f.unconfirmed).toBeFalsy();
    expect(f.email).toBeUndefined();
  });

  it('a wrong email and a wrong password produce the IDENTICAL outcome', async () => {
    // Supabase returns the same `invalid_credentials` for both — the action must
    // not differentiate. We simulate both as the same code and assert identical shape.
    signInWithPassword.mockResolvedValue(authError('invalid_credentials'));
    const wrongPassword = await loginAction(input());
    const wrongEmail = await loginAction(input({ email: 'ghost@gmail.com' }));
    expect(fail(wrongPassword).error).toBe(fail(wrongEmail).error);
    expect(Object.keys(wrongPassword).sort()).toEqual(Object.keys(wrongEmail).sort());
  });
});

describe('loginAction — operational errors are NEUTRAL, not credential-blaming (WR-04)', () => {
  const NEUTRAL = /something went wrong/i;
  const CREDENTIAL = /that email or password isn't right/i;

  it('an explicit rate-limit code → neutral message (not "wrong password")', async () => {
    signInWithPassword.mockResolvedValue(authError('over_request_rate_limit'));
    const result = await loginAction(input());
    expect(fail(result).error).toMatch(NEUTRAL);
    expect(fail(result).error).not.toMatch(CREDENTIAL);
  });

  it('a 429 status (even without the rate-limit code) → neutral message', async () => {
    signInWithPassword.mockResolvedValue(authErrorStatus(429));
    expect(fail(await loginAction(input())).error).toMatch(NEUTRAL);
  });

  it('a 5xx server error → neutral message (no reset-loop bait)', async () => {
    signInWithPassword.mockResolvedValue(authErrorStatus(500));
    expect(fail(await loginAction(input())).error).toMatch(NEUTRAL);
    signInWithPassword.mockResolvedValue(authErrorStatus(503, 'unexpected_failure'));
    expect(fail(await loginAction(input())).error).toMatch(NEUTRAL);
  });

  it('an unknown / renamed gotrue code → neutral message (never credential-blaming)', async () => {
    signInWithPassword.mockResolvedValue(authError('some_future_unknown_code'));
    const f = fail(await loginAction(input()));
    expect(f.error).toMatch(NEUTRAL);
    expect(f.error).not.toMatch(CREDENTIAL);
  });

  it('only invalid_credentials gets the credential message (the funnel is precise)', async () => {
    signInWithPassword.mockResolvedValue(authError('invalid_credentials'));
    expect(fail(await loginAction(input())).error).toMatch(CREDENTIAL);
  });
});

describe('loginAction — the ONE exception: unconfirmed user → resend (D-07)', () => {
  it('returns the resend-prompt outcome on email_not_confirmed', async () => {
    signInWithPassword.mockResolvedValue(authError('email_not_confirmed'));
    const result = await loginAction(input());
    const f = fail(result);
    expect(f.unconfirmed).toBe(true);
    expect(f.email).toBe(VALID.email); // echoed so the page can drive resend
    expect(f.error).toMatch(/confirm your email/i);
  });
});

describe('loginAction — success', () => {
  it('returns ok:true for a confirmed user with valid credentials', async () => {
    const result = await loginAction(input());
    expect(ok(result).ok).toBe(true);
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    const arg = signInWithPassword.mock.calls[0][0] as { email: string; password: string };
    expect(arg.email).toBe(VALID.email);
    expect(arg.password).toBe(VALID.password);
  });
});

describe('loginAction — D-14 locked-account block (does not weaken the contract)', () => {
  it('a locked account is signed back out and gets the GENERIC suspended message', async () => {
    // Valid credentials (signInWithPassword resolves ok via beforeEach), but the
    // own-`locked` read reports the account is suspended.
    profileSingle.mockResolvedValue({ data: { locked: true }, error: null });
    const result = await loginAction(input());
    const f = fail(result);
    expect(f.error).toMatch(/account has been suspended/i);
    // No usable session — the just-created session is torn down.
    expect(signOut).toHaveBeenCalledTimes(1);
    // Not enumeration: no credential/unconfirmed signal leaked.
    expect(f.unconfirmed).toBeFalsy();
    expect(f.email).toBeUndefined();
  });

  it('a non-locked account still logs in normally (success unchanged)', async () => {
    // beforeEach defaults locked:false → ok:true, no sign-out.
    const result = await loginAction(input());
    expect(ok(result).ok).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
  });
});

describe('loginAction — source discipline (AUTH-05)', () => {
  it("begins with the 'use server' directive", () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const src = readFileSync(join(process.cwd(), 'src/lib/auth/login-action.ts'), 'utf-8');
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
    const src = readFileSync(join(process.cwd(), 'src/lib/auth/login-action.ts'), 'utf-8');
    expect(src).not.toMatch(/\.getSession\(/);
  });
});
