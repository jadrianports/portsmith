/**
 * `/auth/confirm` — email-confirmation + password-recovery token exchange (AUTH-02, AUTH-04, D-06).
 *
 * A single GET route handler the Supabase email templates point at. With the
 * built-in mailer + the `token_hash` template (configured in 02-02), the link
 * carries `?token_hash=…&type={email|recovery}` — so this handler uses
 * `verifyOtp({ type, token_hash })`, NEVER `exchangeCodeForSession` (Pitfall 2:
 * the latter is for the PKCE `?code=` flow, which this project does not use).
 * `verifyOtp` turns the single-use server-verified OTP into a real session by
 * writing the `@supabase/ssr` cookies through the awaited server client; the
 * Phase 1 middleware then refreshes that session on every subsequent request
 * (consumed, not rebuilt — AUTH-03).
 *
 * Routing (D-06):
 *   - `type === 'recovery'` → `/update-password` (Plan 05's recovery landing).
 *   - otherwise (email confirm) → the validated `next`, defaulting to `/dashboard`.
 *   - any failure (missing/invalid token, verifyOtp error) → `/login?error=auth`,
 *     a single generic redirect that NEVER leaks which token or type failed
 *     (Pitfall 3 / T-02-15).
 *
 * Security — open-redirect hardening (Security A5 / T-02-12 / WR-03): `next` is an
 * UNTRUSTED query parameter. It is constrained to an internal, same-origin,
 * absolute-path string (must start with a single `/`, must not start with `//`
 * or `/\`, and must not parse as an absolute URL). Anything else falls back to
 * `/dashboard`.
 *
 * The redirect is RELATIVE (WR-03): we emit the validated PATH as the `Location`
 * header (a 303 with a bare `/dashboard`-style value) and let the BROWSER resolve
 * it against the actual request origin. This is the fix for two compounding
 * problems the earlier absolute-URL form had:
 *   - it built the redirect origin from the untrusted `Host` header → a classic
 *     open-redirect (a request with `Host: attacker.example` bounced the
 *     just-authenticated user to `https://attacker.example/dashboard`);
 *   - but it COULD NOT simply adopt the server's normalized host either, because
 *     under `next dev` the confirm email lands on 127.0.0.1:3000 while the server
 *     normalizes to localhost:3000 — two DISTINCT cookie origins, so an absolute
 *     redirect to the normalized host would land the browser on a different origin
 *     than the one verifyOtp wrote the session cookie to (no session → bounce to
 *     /login).
 * A relative Location resolves against the origin the browser is ALREADY on (the
 * verifyOtp cookie's origin), so it neither trusts the Host header nor drops the
 * dev cookie. The token query is never carried forward (we emit only the path).
 *
 * NOTE on location: this handler lives at the BARE `/auth/confirm` path, NOT
 * inside the `(auth)` route group — the email-template URL must match this exact
 * path (the `(auth)` group segment is invisible in the URL, so its pages are
 * `/login`, `/signup`, … but the confirm handler must be a real `/auth/confirm`).
 */
import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/** Where a successful email confirmation lands when no (valid) `next` is given. */
const DEFAULT_NEXT = '/dashboard';
/** Where a successful `type=recovery` exchange lands (Plan 05's update-password). */
const RECOVERY_NEXT = '/update-password';

/**
 * The ONLY `type` values this handler accepts (CR-02). The Supabase email
 * templates emit exactly these two — confirmation links carry `type=email` and
 * recovery links carry `type=recovery` (see supabase/templates/*.html). Anything
 * else (`signup`, `email_change`, `magiclink`, `invite`, or arbitrary attacker
 * input) is treated as a generic failure: we do NOT pass an unvalidated string
 * into `verifyOtp`, and we never route a non-`recovery` verified token through the
 * attacker-controlled `next`. Add a value here ONLY when a real runtime path emits
 * it through this route.
 */
const ALLOWED_TYPES = new Set<EmailOtpType>(['email', 'recovery']);

/**
 * Returns a safe, INTERNAL redirect path or `null` if `raw` is not a same-origin
 * absolute path. Rejects:
 *   - null / empty
 *   - protocol-relative (`//host`, `/\host`) — these navigate off-origin
 *   - anything that parses as an absolute URL (has a scheme + host)
 *   - anything that does not start with a single `/`
 */
function safeInternalPath(raw: string | null): string | null {
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
 * drop the verifyOtp cookie by hopping origins. The token query is never carried.
 */
function relativeRedirect(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  // CR-02: allowlist the type rather than blindly casting an arbitrary query
  // string to EmailOtpType. Anything not in ALLOWED_TYPES → null → generic failure.
  const rawType = searchParams.get('type');
  const type =
    rawType && ALLOWED_TYPES.has(rawType as EmailOtpType)
      ? (rawType as EmailOtpType)
      : null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // The destination is an allowlisted INTERNAL path (recovery / validated next
      // / default), emitted as a RELATIVE Location so the browser stays on the
      // verifyOtp cookie's origin (no Host trust, no cross-origin cookie drop).
      const destination =
        type === 'recovery'
          ? RECOVERY_NEXT
          : (safeInternalPath(searchParams.get('next')) ?? DEFAULT_NEXT);
      return relativeRedirect(destination);
    }
  }

  // Generic failure — never leak which token/type failed (Pitfall 3 / T-02-15).
  // A relative path with the generic error flag.
  return relativeRedirect('/login?error=auth');
}
