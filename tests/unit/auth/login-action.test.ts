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
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// --- Mock the supabase server client so signInWithPassword is a spy -----------
const signInWithPassword = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { signInWithPassword: (...args: unknown[]) => signInWithPassword(...args) },
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

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  signInWithPassword.mockReset().mockResolvedValue({
    data: { session: { access_token: 'a' }, user: { id: 'u1' } },
    error: null,
  });
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
