/**
 * Unit coverage for the server-fronted signup action — the gate (AUTH-01, D-05, D-07).
 *
 * The action is the highest-stakes security surface in the phase. It MUST enforce
 * the gate ORDER and never reach a later step when an earlier one fails:
 *
 *   1. signupSchema.safeParse  → field errors            (Zod re-parse, server gate)
 *   2. tos_accepted required    → field error            (D-09; literal(true))
 *   3. verifyTurnstile          → reject (Turnstile msg)  (D-05 — BEFORE signUp)
 *   4. isDisposableEmail        → reject (specific D-04)  (SAFE-01 — BEFORE signUp)
 *   5. supabase.auth.signUp     → generic "check your email" on success OR
 *                                 already-registered (D-07 — no existence branch)
 *
 * Strategy: mock `verifyTurnstile`, `isDisposableEmail`, and `@/lib/supabase/server`
 * (so `createClient().auth.signUp` is a spy). Assert that `signUp` is NOT called
 * when an earlier gate fails (the bot-bypass guarantee), and that an
 * already-registered result returns the SAME generic outcome as a fresh signup.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// --- Mocks for the composed guards + the supabase server client ---------------
const verifyTurnstile = vi.fn();
const isDisposableEmail = vi.fn();
const signUp = vi.fn();
// D-06/D-07: the BotID gate. Default no-op (isBot:false) so the unchanged gate
// ladder is unaffected; the isBot:true case asserts the enumeration-safe reject.
const checkBotId = vi.fn();
// D-11: the per-IP throttle. Default allowed; the over-cap case asserts the
// generic outcome + that signUp is never reached.
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
vi.mock('@/lib/auth/turnstile', () => ({
  verifyTurnstile: (...args: unknown[]) => verifyTurnstile(...args),
}));
vi.mock('@/lib/auth/disposable-email', () => ({
  isDisposableEmail: (...args: unknown[]) => isDisposableEmail(...args),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signUp: (...args: unknown[]) => signUp(...args) } }),
}));
// next/headers is referenced transitively in some action setups; stub defensively.
vi.mock('next/headers', () => ({
  headers: async () => new Map(),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

// Import AFTER the mocks are registered.
import { signupAction, type SignupResult } from '@/lib/auth/signup-action';

/** Narrow to the failure branch for assertions (throws if it was a success). */
function fail(result: SignupResult): Extract<SignupResult, { ok: false }> {
  if (result.ok) throw new Error('expected a failure result, got ok:true');
  return result;
}
/** Narrow to the success branch for assertions (throws if it was a failure). */
function ok(result: SignupResult): Extract<SignupResult, { ok: true }> {
  if (!result.ok) throw new Error('expected a success result, got ok:false');
  return result;
}

const VALID = {
  email: 'new.user@gmail.com',
  password: 'correct horse battery',
  username: 'newuser',
  turnstile_token: 'tok-valid',
  tos_accepted: true,
} as const;

function input(overrides: Record<string, unknown> = {}) {
  return { ...VALID, ...overrides };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  // D-06: default BotID to "human" so the existing gate ladder is unaffected.
  checkBotId.mockReset().mockResolvedValue({ isBot: false });
  // D-11: default to a present hashed-IP subject + allowed, so the unchanged
  // happy path still reaches signUp. Over-cap / null-subject cases override.
  hashClientIpFromHeaders.mockReset().mockResolvedValue('hashed-ip');
  countAndRecord.mockReset().mockResolvedValue(true);
  verifyTurnstile.mockReset().mockResolvedValue(true);
  isDisposableEmail.mockReset().mockReturnValue(false);
  signUp.mockReset().mockResolvedValue({ data: { user: {} }, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('signupAction — Zod gate (step 1)', () => {
  it('rejects an invalid email with a field error and never verifies/creates', async () => {
    const result = await signupAction(input({ email: 'not-an-email' }));
    expect(fail(result).fieldErrors?.email).toBeTruthy();
    expect(verifyTurnstile).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('rejects a reserved/invalid username before any side effect', async () => {
    const result = await signupAction(input({ username: 'admin' }));
    expect(fail(result).fieldErrors?.username).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe('signupAction — ToS gate (step 2, D-09)', () => {
  it('rejects when tos_accepted is not true, before Turnstile/signUp', async () => {
    const result = await signupAction(input({ tos_accepted: false }));
    expect(fail(result).fieldErrors?.tos_accepted).toBeTruthy();
    expect(verifyTurnstile).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe('signupAction — BotID gate (step 2b, D-06/D-07 — enumeration-safe reject)', () => {
  it('on isBot returns the GENERIC outcome and never reaches Turnstile/signUp', async () => {
    checkBotId.mockResolvedValue({ isBot: true });
    const result = await signupAction(input());
    const f = fail(result);
    expect(f.error).toMatch(/something went wrong/i); // GENERIC_ERROR — never a "bot" signal
    expect(verifyTurnstile).not.toHaveBeenCalled(); // gate order: stops before Turnstile
    expect(countAndRecord).not.toHaveBeenCalled(); // no ledger write for a bot (Pitfall 3)
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe('signupAction — Turnstile gate (step 3, D-05 — the bot-bypass guarantee)', () => {
  it('does NOT reach signUp when the Turnstile token fails verification', async () => {
    verifyTurnstile.mockResolvedValue(false);
    const result = await signupAction(input());
    expect(fail(result)).toBeTruthy();
    expect(verifyTurnstile).toHaveBeenCalledTimes(1);
    expect(isDisposableEmail).not.toHaveBeenCalled(); // gate order: stops here
    expect(signUp).not.toHaveBeenCalled();
  });

  it('rejects an empty Turnstile token at the Zod step (still never reaches signUp)', async () => {
    const result = await signupAction(input({ turnstile_token: '' }));
    expect(fail(result)).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe('signupAction — disposable-email gate (step 4, SAFE-01 / D-04)', () => {
  it('rejects a disposable email with the specific D-04 message, before signUp', async () => {
    isDisposableEmail.mockReturnValue(true);
    const result = await signupAction(input({ email: 'x@mailinator.com' }));
    expect(fail(result).error).toMatch(/disposable or temporary email/i);
    expect(verifyTurnstile).toHaveBeenCalledTimes(1); // ran before disposable
    expect(signUp).not.toHaveBeenCalled(); // disposable blocks creation
  });
});

describe('signupAction — signUp call shape (step 5)', () => {
  it('calls signUp with options.data {username, display_name} + emailRedirectTo /auth/confirm', async () => {
    await signupAction(input());
    expect(signUp).toHaveBeenCalledTimes(1);
    const arg = signUp.mock.calls[0][0] as {
      email: string;
      password: string;
      options: { data: { username: string; display_name: string }; emailRedirectTo: string };
    };
    expect(arg.email).toBe(VALID.email);
    expect(arg.password).toBe(VALID.password);
    expect(arg.options.data).toEqual({ username: 'newuser', display_name: 'newuser' });
    expect(arg.options.emailRedirectTo).toMatch(/\/auth\/confirm$/);
  });
});

describe('signupAction — enumeration-safe outcome (D-07 / T-02-07)', () => {
  it('returns the SAME generic success outcome for a fresh signup and an already-registered email', async () => {
    // Fresh signup
    signUp.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    const fresh = await signupAction(input());

    // Already-registered: Supabase returns an obfuscated user with no identities;
    // the action must NOT branch the message on this.
    signUp.mockResolvedValueOnce({
      data: { user: { id: 'u2', identities: [] } },
      error: null,
    });
    const existing = await signupAction(input());

    expect(ok(existing).email).toBe(ok(fresh).email);
    // Identical shape (no extra fields leaking existence).
    expect(Object.keys(existing).sort()).toEqual(Object.keys(fresh).sort());
  });

  it('does not contain a real .getSession( call (verified-identity discipline)', () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const src = readFileSync(join(process.cwd(), 'src/lib/auth/signup-action.ts'), 'utf-8');
    expect(src).not.toMatch(/\.getSession\(/);
  });

  it("begins with the 'use server' directive", () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const src = readFileSync(join(process.cwd(), 'src/lib/auth/signup-action.ts'), 'utf-8');
    const firstCode = src
      .split('\n')
      .map((l: string) => l.trim())
      .find(
        (l: string) =>
          l.length > 0 && !l.startsWith('//') && !l.startsWith('/*') && !l.startsWith('*'),
      );
    expect(firstCode).toMatch(/^['"]use server['"];?$/);
  });
});
