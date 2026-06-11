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
let HEADERS: Map<string, string>;
vi.mock('next/headers', () => ({
  headers: async () => HEADERS,
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

// Import AFTER the mocks are registered.
import { hashClientIpFromHeaders } from '@/lib/trust/ip-hash';

const SECRET = 'unit-test-ip-hash-secret';

beforeEach(() => {
  HEADERS = new Map();
  process.env.REPORT_IP_HASH_SECRET = SECRET;
});

afterEach(() => {
  vi.clearAllMocks();
});

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
