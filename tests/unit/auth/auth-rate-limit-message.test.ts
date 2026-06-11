/**
 * Unit coverage for the auth rate-limit + BotID gate (HARD-04 / D-11 / D-06 / D-07).
 *
 * TWO load-bearing properties, both enumeration-safety invariants (Phase-2 D-07):
 *
 *   1. hashClientIpFromHeaders() — the Server-Action IP-subject helper (Pitfall 1:
 *      Server Actions have no `Request`, so it reads `await headers()`). It returns a
 *      stable HMAC-SHA256 hex digest when an IP header + REPORT_IP_HASH_SECRET are
 *      present, and DEGRADES to null (no IP, or no secret) so a missing secret never
 *      locks out a real user. The raw IP is NEVER returned — only the digest.
 *
 *   2. The over-cap / isBot branches in signupAction / loginAction / requestReset
 *      return the action's EXISTING generic outcome — never a distinct "rate limited"
 *      / "bot" signal that would become an existence oracle (Pitfall 2):
 *        - login over-cap/isBot  → GENERIC_ERROR  (NOT GENERIC_INVALID — bot ≠ credential)
 *        - signup over-cap/isBot → GENERIC_ERROR
 *        - reset over-cap/isBot  → the always-generic { ok: true, message }
 *      And a null hashClientIpFromHeaders() (degrade-when-no-secret) SKIPS the cap:
 *      countAndRecord is never called and the action proceeds normally.
 *
 * Task 1 writes the hashClientIpFromHeaders block; Task 3 completes the
 * enumeration-safety + degrade assertions over the three actions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// --- next/headers: a per-test-controllable header map ------------------------
// The REAL hashClientIpFromHeaders reads await headers(), so driving this map +
// REPORT_IP_HASH_SECRET exercises the real degrade-to-null path the actions rely
// on (a null subject SKIPS the cap). It is NOT mocked away.
let HEADERS: Map<string, string>;
vi.mock('next/headers', () => ({
  headers: async () => HEADERS,
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

// --- The rate-limit ledger: countAndRecord toggled true (allowed) / false (over-cap) ---
const countAndRecord = vi.fn();
vi.mock('@/lib/rate-limit/ledger', () => ({
  countAndRecord: (...args: unknown[]) => countAndRecord(...args),
}));

// --- BotID: default human; not the focus of this file (covered per-action) ---
const checkBotId = vi.fn();
vi.mock('botid/server', () => ({
  checkBotId: (...args: unknown[]) => checkBotId(...args),
}));

// --- The supabase server client: auth-call spies (must NEVER be reached on over-cap) ---
const signUp = vi.fn();
const signInWithPassword = vi.fn();
const resetPasswordForEmail = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getVerifiedClaims: async () => ({ sub: 'u1' }),
  createClient: async () => ({
    auth: {
      signUp: (...args: unknown[]) => signUp(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmail(...args),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { locked: false }, error: null }) }) }),
    }),
  }),
}));

// --- Turnstile + disposable-email: signup's earlier gates, always pass here ---
vi.mock('@/lib/auth/turnstile', () => ({ verifyTurnstile: async () => true }));
vi.mock('@/lib/auth/disposable-email', () => ({ isDisposableEmail: () => false }));

// Import AFTER the mocks are registered.
import { loginAction } from '@/lib/auth/login-action';
import { requestReset } from '@/lib/auth/reset-actions';
import { signupAction } from '@/lib/auth/signup-action';
import { hashClientIpFromHeaders } from '@/lib/trust/ip-hash';

const SECRET = 'unit-test-ip-hash-secret';

/** The login credential message — the throttle/bot branches must NOT use this. */
const CREDENTIAL = /that email or password isn't right/i;
/** The shared neutral/operational message the throttle/bot branches DO use. */
const GENERIC = /something went wrong/i;

beforeEach(() => {
  HEADERS = new Map();
  process.env.REPORT_IP_HASH_SECRET = SECRET;
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  // Defaults: a present hashed-IP subject (the HEADERS map below) + human + the
  // auth calls succeed when reached. Over-cap / degrade cases override.
  checkBotId.mockReset().mockResolvedValue({ isBot: false });
  countAndRecord.mockReset().mockResolvedValue(true);
  signUp.mockReset().mockResolvedValue({ data: { user: {} }, error: null });
  signInWithPassword
    .mockReset()
    .mockResolvedValue({ data: { session: { access_token: 'a' }, user: { id: 'u1' } }, error: null });
  resetPasswordForEmail.mockReset().mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

const SIGNUP_INPUT = {
  email: 'new.user@gmail.com',
  password: 'correct horse battery',
  username: 'newuser',
  turnstile_token: 'tok-valid',
  tos_accepted: true,
} as const;
const LOGIN_INPUT = { email: 'real.user@gmail.com', password: 'correct horse battery' } as const;
const RESET_INPUT = { email: 'real.user@gmail.com' } as const;

describe('hashClientIpFromHeaders() — Server-Action IP subject (Pitfall 1)', () => {
  it('returns a stable HMAC-SHA256 hex digest from the first x-forwarded-for entry', async () => {
    HEADERS.set('x-forwarded-for', '203.0.113.7, 70.41.3.18, 150.172.238.178');
    const a = await hashClientIpFromHeaders();
    const b = await hashClientIpFromHeaders();
    expect(a).toBeTruthy();
    expect(a).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    expect(a).toBe(b); // stable for the same IP + secret
  });

  it('returns null when REPORT_IP_HASH_SECRET is unset (degrade — cap skipped, no lockout)', async () => {
    HEADERS.set('x-forwarded-for', '203.0.113.7');
    delete process.env.REPORT_IP_HASH_SECRET;
    expect(await hashClientIpFromHeaders()).toBeNull();
  });

  it('returns null when no IP header is present (neither x-forwarded-for nor x-real-ip)', async () => {
    expect(await hashClientIpFromHeaders()).toBeNull();
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    HEADERS.set('x-real-ip', '198.51.100.42');
    const digest = await hashClientIpFromHeaders();
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns ONLY the digest — the raw IP never appears in the output', async () => {
    const ip = '203.0.113.7';
    HEADERS.set('x-forwarded-for', ip);
    const digest = await hashClientIpFromHeaders();
    expect(digest).toBeTruthy();
    expect(digest).not.toContain(ip); // the raw IP is never returned (privacy invariant)
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('over-cap returns the EXISTING generic outcome (enumeration-safe, Pitfall 2 / D-07)', () => {
  beforeEach(() => {
    // A present hashed-IP subject so the cap is consulted...
    HEADERS.set('x-forwarded-for', '203.0.113.7');
    // ...and over cap.
    countAndRecord.mockResolvedValue(false);
  });

  it('login over-cap returns GENERIC_ERROR — NOT the credential message — and never signs in', async () => {
    const result = await loginAction(LOGIN_INPUT);
    if (result.ok) throw new Error('expected over-cap failure');
    expect(result.error).toMatch(GENERIC);
    expect(result.error).not.toMatch(CREDENTIAL); // the throttle must not become an oracle
    expect(countAndRecord).toHaveBeenCalledWith('auth_login', expect.any(String), 60 * 60 * 1000, 20);
    expect(signInWithPassword).not.toHaveBeenCalled(); // throttled before gotrue
  });

  it('signup over-cap returns GENERIC_ERROR and never creates the account', async () => {
    const result = await signupAction(SIGNUP_INPUT);
    if (result.ok) throw new Error('expected over-cap failure');
    expect(result.error).toMatch(GENERIC);
    expect(countAndRecord).toHaveBeenCalledWith('auth_signup', expect.any(String), 60 * 60 * 1000, 10);
    expect(signUp).not.toHaveBeenCalled();
  });

  it('reset over-cap returns the SAME always-generic { ok:true, message } and never sends', async () => {
    const result = await requestReset(RESET_INPUT);
    expect(result.ok).toBe(true); // never a distinct "rate limited" shape
    if (result.ok) expect(result.message).toBeTruthy();
    expect(countAndRecord).toHaveBeenCalledWith('auth_reset', expect.any(String), 60 * 60 * 1000, 5);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe('degrade-when-no-secret: a null subject SKIPS the cap (D-11 — never a lockout)', () => {
  // No x-forwarded-for header set AND/OR no secret => hashClientIpFromHeaders()
  // returns null => the action must NOT call countAndRecord and must proceed.
  it('login: null subject means countAndRecord is never called and the action proceeds', async () => {
    HEADERS = new Map(); // no IP header → null subject
    const result = await loginAction(LOGIN_INPUT);
    expect(countAndRecord).not.toHaveBeenCalled(); // cap skipped
    expect(signInWithPassword).toHaveBeenCalledTimes(1); // proceeds normally
    expect(result.ok).toBe(true);
  });

  it('signup: missing REPORT_IP_HASH_SECRET means the cap is skipped and signUp is reached', async () => {
    HEADERS.set('x-forwarded-for', '203.0.113.7');
    delete process.env.REPORT_IP_HASH_SECRET; // secret unset → null subject
    const result = await signupAction(SIGNUP_INPUT);
    expect(countAndRecord).not.toHaveBeenCalled(); // cap skipped (no lockout)
    expect(signUp).toHaveBeenCalledTimes(1); // proceeds normally
    expect(result.ok).toBe(true);
  });

  it('reset: null subject means the cap is skipped and the email path runs', async () => {
    HEADERS = new Map(); // no IP header → null subject
    const result = await requestReset(RESET_INPUT);
    expect(countAndRecord).not.toHaveBeenCalled();
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });
});
