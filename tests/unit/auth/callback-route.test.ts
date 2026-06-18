/**
 * Unit coverage for the `/auth/callback` PKCE GET route handler (OAUTH-01 /
 * OAUTH-06 / open-redirect hardening / T-28-04 / T-28-05).
 *
 * This is the OAuth redirect target: Google bounces the user back here with a
 * single-use `?code=`. The handler exchanges that code for a verified-email
 * session via `exchangeCodeForSession` (PKCE — NOT `verifyOtp`, which is the
 * email-link `/auth/confirm` concern), then routes to a validated internal path
 * (default `/dashboard`, whose RSC re-routes `onboarded_at IS NULL` users into
 * `/onboarding`). This test pins:
 *
 *   - success: `?code=good` → 303 with a RELATIVE `Location: /dashboard`.
 *   - validated next: `?code=good&next=/onboarding` → `/onboarding`.
 *   - off-origin next rejected: `?code=good&next=//evil.com` → falls back to
 *     `/dashboard` (safeInternalPath rejects protocol-relative — T-28-04).
 *   - exchange error: `?code=bad`, exchange resolves `{ error }` → the single
 *     generic `/login?error=auth` (no provider/email/reason leak — D-08/T-28-05).
 *   - no code (e.g. denied consent `?error=access_denied`) → `/login?error=auth`
 *     and `exchangeCodeForSession` is NEVER called.
 *   - WR-03: the redirect is RELATIVE (a bare path in Location) and an untrusted
 *     `Host` header is NEVER reflected into the target.
 *   - enumeration-safety: no case leaks a provider name, email, or failure reason.
 *
 * Strategy: mock `@/lib/supabase/server` so `createClient().auth.exchangeCodeForSession`
 * is a spy (mirrors confirm-route.test.ts), then drive the handler with a
 * constructed `NextRequest` per case and assert on the redirect `Location`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const exchangeCodeForSession = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSession(...args),
    },
  }),
}));

// Import AFTER the mocks are registered.
import { GET } from '@/app/auth/callback/route';

const ORIGIN = 'http://127.0.0.1:3000';

function callbackRequest(
  query: Record<string, string>,
  headers?: Record<string, string>,
): NextRequest {
  const url = new URL(`${ORIGIN}/auth/callback`);
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
 * Pull the redirect target path (+ query) out of the response. WR-03: the
 * Location is RELATIVE, so resolve it against a dummy base to read pathname +
 * searchParams. The base host is asserted-against separately (it must never
 * appear in the raw header).
 */
function locationOf(res: { headers: Headers }): URL {
  return new URL(rawLocation(res), 'http://placeholder.invalid');
}

beforeEach(() => {
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('/auth/callback — PKCE success path (OAUTH-01)', () => {
  it('exchanges a good code and routes to the default /dashboard', async () => {
    const res = await GET(callbackRequest({ code: 'good' }));
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession.mock.calls[0][0]).toBe('good');
    expect(locationOf(res).pathname).toBe('/dashboard');
    expect(res.status).toBe(303);
  });

  it('honors a safe internal next', async () => {
    const res = await GET(callbackRequest({ code: 'good', next: '/onboarding' }));
    expect(locationOf(res).pathname).toBe('/onboarding');
  });
});

describe('/auth/callback — open-redirect hardening for `next` (T-28-04)', () => {
  it('rejects an off-origin protocol-relative next and falls back to /dashboard', async () => {
    const res = await GET(callbackRequest({ code: 'good', next: '//evil.com/phish' }));
    // The Location is a RELATIVE path (WR-03) and the attacker host never appears.
    expect(rawLocation(res)).toBe('/dashboard');
    expect(rawLocation(res)).not.toContain('evil.com');
  });

  it('rejects an absolute-URL next and falls back to /dashboard', async () => {
    const res = await GET(callbackRequest({ code: 'good', next: 'https://evil.com' }));
    expect(locationOf(res).pathname).toBe('/dashboard');
    expect(rawLocation(res)).not.toContain('evil.com');
  });
});

describe('/auth/callback — failure is a single generic redirect (OAUTH-06 / D-08 / T-28-05)', () => {
  it('an exchange error → /login?error=auth (never reveals the reason)', async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: 'invalid code verifier', status: 400 },
    });
    const res = await GET(callbackRequest({ code: 'bad' }));
    const loc = locationOf(res);
    expect(loc.pathname).toBe('/login');
    expect(loc.searchParams.get('error')).toBe('auth');
    // No provider/email/reason leaked anywhere in the redirect.
    expect(rawLocation(res)).not.toMatch(/google/i);
    expect(rawLocation(res)).not.toMatch(/verifier/i);
  });

  it('denied consent (?error=access_denied, no code) → generic, exchange NEVER called', async () => {
    const res = await GET(callbackRequest({ error: 'access_denied' }));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    const loc = locationOf(res);
    expect(loc.pathname).toBe('/login');
    expect(loc.searchParams.get('error')).toBe('auth');
    // The provider's own error string is never reflected forward.
    expect(rawLocation(res)).not.toContain('access_denied');
  });

  it('a missing code → generic failure, exchange never called', async () => {
    const res = await GET(callbackRequest({}));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(locationOf(res).pathname).toBe('/login');
  });
});

describe('/auth/callback — WR-03 relative redirect, no Host-header trust', () => {
  it('emits a RELATIVE Location (a bare path, not an absolute URL) on success', async () => {
    const res = await GET(callbackRequest({ code: 'good' }));
    const loc = rawLocation(res);
    expect(loc).toBe('/dashboard');
    expect(loc.startsWith('/')).toBe(true);
    expect(loc.startsWith('//')).toBe(false);
    expect(/^https?:\/\//i.test(loc)).toBe(false);
    expect(res.status).toBe(303);
  });

  it('does NOT trust a spoofed Host header — the redirect host is never attacker.example', async () => {
    const res = await GET(
      callbackRequest({ code: 'good' }, { host: 'attacker.example' }),
    );
    expect(rawLocation(res)).toBe('/dashboard');
    expect(rawLocation(res)).not.toContain('attacker.example');
  });

  it('the generic failure redirect is also relative (no Host trust)', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'nope', status: 400 } });
    const res = await GET(
      callbackRequest({ code: 'bad' }, { host: 'attacker.example' }),
    );
    expect(rawLocation(res)).toBe('/login?error=auth');
    expect(rawLocation(res)).not.toContain('attacker.example');
  });
});
