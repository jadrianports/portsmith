/**
 * Shared open-redirect hardening for the auth redirect routes (WR-03 / T-02-12 /
 * T-28-04). Both `/auth/confirm` (email-link `verifyOtp`) and `/auth/callback`
 * (PKCE `exchangeCodeForSession`) import these two helpers so the hardening lives
 * in ONE place — no copy-paste drift between the two routes.
 *
 * The discipline these helpers encode:
 *   - `next` is an UNTRUSTED query parameter. It is constrained to an internal,
 *     same-origin, absolute-path string (must start with a single `/`, must not
 *     start with `//` or `/\`, and must not parse as an absolute URL). Anything
 *     else is rejected (the caller falls back to a safe default).
 *   - The redirect is RELATIVE: we emit the validated PATH as the `Location`
 *     header (a 303 with a bare `/dashboard`-style value) and let the BROWSER
 *     resolve it against the actual request origin. This neither trusts the
 *     untrusted `Host` header (a classic open-redirect) nor drops the just-written
 *     session cookie by hopping origins (under `next dev` the auth redirect lands
 *     on 127.0.0.1:3000 while the server normalizes to localhost:3000 — two
 *     DISTINCT cookie origins, so an absolute redirect to the normalized host
 *     would land the browser on a different origin than the one the auth call
 *     wrote the session cookie to → no session → bounce to /login). A relative
 *     Location resolves against the origin the browser is ALREADY on (the auth
 *     cookie's origin). The token/code query is never carried forward.
 */
import { NextResponse } from 'next/server';

/**
 * Returns a safe, INTERNAL redirect path or `null` if `raw` is not a same-origin
 * absolute path. Rejects:
 *   - null / empty
 *   - protocol-relative (`//host`, `/\host`) — these navigate off-origin
 *   - anything that parses as an absolute URL (has a scheme + host)
 *   - anything that does not start with a single `/`
 */
export function safeInternalPath(raw: string | null): string | null {
  if (!raw) return null;
  // Must be an absolute path beginning with exactly one forward slash.
  if (!raw.startsWith('/')) return null;
  // Reject protocol-relative and backslash-smuggling forms (`//`, `/\`).
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  // Belt-and-suspenders: if it parses as an absolute URL, it is not a bare path.
  try {
    // A bare path throws here (no base) — an absolute URL (http:, javascript:, …)
    // does not, so a successful parse means `raw` carried a scheme: reject it.
    new URL(raw);
    return null;
  } catch {
    // Expected for a genuine relative path — fall through and accept it.
  }
  return raw;
}

/**
 * Emit a RELATIVE 303 redirect (WR-03). `path` is an already-validated internal
 * absolute path (begins with a single `/`); the browser resolves it against the
 * request origin it is already on, so we never trust the `Host` header and never
 * drop the session cookie by hopping origins. The token/code query is never carried.
 */
export function relativeRedirect(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}
