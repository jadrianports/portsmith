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
 * Security — open-redirect hardening (Security A5 / T-02-12): `next` is an
 * UNTRUSTED query parameter. It is constrained to an internal, same-origin,
 * absolute-path string (must start with a single `/`, must not start with `//`
 * or `/\`, and must not parse as an absolute URL). Anything else falls back to
 * `/dashboard`. The redirect URL is built from the request's own origin with the
 * query string stripped, so an attacker cannot smuggle an external host or carry
 * the token forward.
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

  // Build every redirect from the request's own origin with the query stripped,
  // so neither the token nor an attacker-supplied host is ever carried forward.
  const redirectTo = request.nextUrl.clone();
  redirectTo.search = '';

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirectTo.pathname =
        type === 'recovery'
          ? RECOVERY_NEXT
          : (safeInternalPath(searchParams.get('next')) ?? DEFAULT_NEXT);
      return NextResponse.redirect(redirectTo);
    }
  }

  // Generic failure — never leak which token/type failed (Pitfall 3 / T-02-15).
  redirectTo.pathname = '/login';
  redirectTo.searchParams.set('error', 'auth');
  return NextResponse.redirect(redirectTo);
}
