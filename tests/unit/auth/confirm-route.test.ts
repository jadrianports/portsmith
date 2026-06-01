/**
 * Unit coverage for the `/auth/confirm` GET route handler (AUTH-02 / AUTH-04 /
 * CR-02 / open-redirect hardening).
 *
 * The handler turns a single-use `token_hash` + `type` into a session via
 * `verifyOtp`, then routes: `recovery` → /update-password, `email` → the
 * validated `next` (default /dashboard). This test pins:
 *
 *   - CR-02 (the headline fix): the `type` query param is ALLOWLISTED. Only
 *     `email` and `recovery` are accepted — anything else (`signup`,
 *     `email_change`, `magiclink`, arbitrary input) is treated as null → generic
 *     /login?error=auth, and `verifyOtp` is NEVER called with the rogue type. A
 *     non-recovery verified token therefore can never be routed through the
 *     attacker-controlled `next` for a disallowed type.
 *   - the recovery branch ignores `next` and lands on /update-password.
 *   - the email branch honors a SAFE internal `next` but rejects an off-origin
 *     `next` (open-redirect hardening), defaulting to /dashboard.
 *   - a verifyOtp error → the single generic /login?error=auth (no leak).
 *   - WR-03: the redirect is RELATIVE (a bare path in the Location header) and the
 *     untrusted `Host` header is NEVER reflected into the redirect target — the
 *     browser resolves the relative path against its own origin (no open-redirect,
 *     no cross-origin cookie drop).
 *
 * Strategy: mock `@/lib/supabase/server` so `createClient().auth.verifyOtp` is a
 * spy, then drive the handler with a constructed `NextRequest` per case and assert
 * on the redirect `Location`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const verifyOtp = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { verifyOtp: (...args: unknown[]) => verifyOtp(...args) },
  }),
}));

// Import AFTER the mocks are registered.
import { GET } from '@/app/auth/confirm/route';

const ORIGIN = 'http://127.0.0.1:3000';

function confirmRequest(
  query: Record<string, string>,
  headers?: Record<string, string>,
): NextRequest {
  const url = new URL(`${ORIGIN}/auth/confirm`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url, headers ? { headers } : undefined);
}

/** The raw redirect Location header value (WR-03: a RELATIVE path, not an absolute URL). */
function rawLocation(res: { headers: Headers }): string {
  const loc = res.headers.get('location');
  if (!loc) throw new Error('expected a redirect Location header');
  return loc;
}

/**
 * Pull the redirect target path (+ query) out of the handler's response. WR-03:
 * the Location is RELATIVE, so resolve it against a dummy base to read pathname +
 * searchParams. The base host is asserted-against separately (it must never appear
 * in the raw header — see the WR-03 suite).
 */
function locationOf(res: { headers: Headers }): URL {
  return new URL(rawLocation(res), 'http://placeholder.invalid');
}

beforeEach(() => {
  verifyOtp.mockReset().mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('/auth/confirm — CR-02 type allowlist', () => {
  it('accepts type=email and routes to the default /dashboard', async () => {
    const res = await GET(confirmRequest({ token_hash: 'tok', type: 'email' }));
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(verifyOtp.mock.calls[0][0]).toEqual({ type: 'email', token_hash: 'tok' });
    expect(locationOf(res).pathname).toBe('/dashboard');
  });

  it('accepts type=recovery and routes to /update-password (ignoring next)', async () => {
    const res = await GET(
      confirmRequest({ token_hash: 'tok', type: 'recovery', next: '/somewhere' }),
    );
    expect(verifyOtp.mock.calls[0][0]).toEqual({ type: 'recovery', token_hash: 'tok' });
    expect(locationOf(res).pathname).toBe('/update-password');
  });

  it.each(['signup', 'email_change', 'magiclink', 'invite', 'phone_change', 'bogus'])(
    'REJECTS a disallowed type=%s without ever calling verifyOtp → generic /login?error=auth',
    async (badType) => {
      const res = await GET(
        confirmRequest({ token_hash: 'tok', type: badType, next: '/evil' }),
      );
      // The rogue type is never passed into verifyOtp.
      expect(verifyOtp).not.toHaveBeenCalled();
      const loc = locationOf(res);
      expect(loc.pathname).toBe('/login');
      expect(loc.searchParams.get('error')).toBe('auth');
    },
  );

  it('treats a missing type as a generic failure', async () => {
    const res = await GET(confirmRequest({ token_hash: 'tok' }));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(locationOf(res).pathname).toBe('/login');
  });
});

describe('/auth/confirm — open-redirect hardening for `next` (email branch)', () => {
  it('honors a safe internal next', async () => {
    const res = await GET(
      confirmRequest({ token_hash: 'tok', type: 'email', next: '/dashboard/settings' }),
    );
    expect(locationOf(res).pathname).toBe('/dashboard/settings');
  });

  it('rejects an off-origin protocol-relative next and falls back to /dashboard', async () => {
    const res = await GET(
      confirmRequest({ token_hash: 'tok', type: 'email', next: '//evil.com/phish' }),
    );
    // The Location is a RELATIVE path (WR-03) and the attacker host never appears in
    // it — a `//evil.com/...` next is rejected and falls back to /dashboard.
    expect(rawLocation(res)).toBe('/dashboard');
    expect(rawLocation(res)).not.toContain('evil.com');
  });

  it('rejects an absolute-URL next and falls back to /dashboard', async () => {
    const res = await GET(
      confirmRequest({ token_hash: 'tok', type: 'email', next: 'https://evil.com' }),
    );
    expect(locationOf(res).pathname).toBe('/dashboard');
  });
});

describe('/auth/confirm — failure is a single generic redirect (no leak)', () => {
  it('a verifyOtp error → /login?error=auth (never reveals which token/type failed)', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'token expired', status: 401 } });
    const res = await GET(confirmRequest({ token_hash: 'tok', type: 'recovery' }));
    const loc = locationOf(res);
    expect(loc.pathname).toBe('/login');
    expect(loc.searchParams.get('error')).toBe('auth');
  });

  it('a missing token_hash → generic failure, verifyOtp never called', async () => {
    const res = await GET(confirmRequest({ type: 'email' }));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(locationOf(res).pathname).toBe('/login');
  });
});

describe('/auth/confirm — WR-03 relative redirect, no Host-header trust', () => {
  it('emits a RELATIVE Location (a bare path, not an absolute URL) on success', async () => {
    const res = await GET(confirmRequest({ token_hash: 'tok', type: 'email' }));
    const loc = rawLocation(res);
    expect(loc).toBe('/dashboard');
    // A relative path begins with a single '/', not a scheme or '//' authority.
    expect(loc.startsWith('/')).toBe(true);
    expect(loc.startsWith('//')).toBe(false);
    expect(/^https?:\/\//i.test(loc)).toBe(false);
    expect(res.status).toBe(303);
  });

  it('does NOT trust a spoofed Host header — the redirect host is never attacker.example', async () => {
    const res = await GET(
      confirmRequest(
        { token_hash: 'tok', type: 'email' },
        { host: 'attacker.example' },
      ),
    );
    // The Location is relative, so the attacker Host can never leak into it. The
    // browser resolves '/dashboard' against its OWN origin (the verifyOtp cookie's
    // origin) — no open-redirect bounce to attacker.example.
    expect(rawLocation(res)).toBe('/dashboard');
    expect(rawLocation(res)).not.toContain('attacker.example');
  });

  it('the generic failure redirect is also relative (no Host trust)', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'token expired', status: 401 } });
    const res = await GET(
      confirmRequest({ token_hash: 'tok', type: 'email' }, { host: 'attacker.example' }),
    );
    expect(rawLocation(res)).toBe('/login?error=auth');
    expect(rawLocation(res)).not.toContain('attacker.example');
  });
});
