/**
 * `/auth/callback` — Google OAuth PKCE code exchange (OAUTH-01, OAUTH-06, D-08).
 *
 * The redirect target of `signInWithGoogleAction` (`signInWithOAuth`). Google
 * bounces the user back here with a single-use `?code=` (PKCE). This handler
 * exchanges that code for a verified-email session via `exchangeCodeForSession` —
 * NOT `verifyOtp` (that is the email-link `/auth/confirm` concern; Pitfall 2: the
 * two are different flows). The exchange MUST run on the SAME `@supabase/ssr`
 * server client (`createClient()`) that holds the PKCE code-verifier cookie set
 * by `signInWithOAuth` — a one-off client cannot read that verifier (Pitfall 2/4,
 * T-28-07). On success the ssr client writes the session cookies through the
 * route-handler cookie store; the Phase 1 middleware refreshes them thereafter.
 *
 * Routing: a successful exchange lands on the validated `next` (default
 * `/dashboard`). `/dashboard` is the single correct target for BOTH first-time and
 * returning OAuth users — its RSC already re-routes `onboarded_at IS NULL` users
 * into `/onboarding`, so an OAuth account (created with `onboarded_at = NULL`)
 * flows through the wizard exactly like an email/password signup, with zero new
 * routing logic (RESEARCH § Pattern 2 redirect-target decision).
 *
 * Enumeration-safety (OAUTH-06 / D-08 / T-28-05): EVERY failure — denied consent
 * (`?error=access_denied` with no code), a missing/invalid code, or an exchange
 * error — collapses to the SINGLE generic `/login?error=auth`. We never branch the
 * message and never reflect the provider's own error string, the email, or the
 * failure reason forward. The `/login?error=auth` banner already exists.
 *
 * Open-redirect hardening (WR-03 / T-28-04): `next` is UNTRUSTED. It is validated
 * by the shared `safeInternalPath` (rejects protocol-relative, scheme-bearing, and
 * non-`/`-prefixed values) and the redirect is RELATIVE (`relativeRedirect`) so the
 * browser resolves it against its own origin — never the untrusted `Host` header,
 * and never the 127.0.0.1↔localhost dev cookie-origin hop. Both helpers are shared
 * verbatim with `/auth/confirm` (see `@/lib/auth/safe-internal-path`).
 *
 * NOTE on location: this handler lives at the BARE `/auth/callback` path, NOT
 * inside the `(auth)` route group — the `redirectTo` the OAuth action sends to
 * Google (and the provider's allow-listed Redirect URL) must match this exact
 * path (the `(auth)` group segment is invisible in the URL).
 */
import { type NextRequest, type NextResponse } from 'next/server';

import { safeInternalPath, relativeRedirect } from '@/lib/auth/safe-internal-path';
import { createClient } from '@/lib/supabase/server';

/** Where a successful OAuth exchange lands when no (valid) `next` is given. */
const DEFAULT_NEXT = '/dashboard';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    // The SAME ssr client that holds the PKCE code-verifier cookie (Pitfall 2/4) —
    // never a one-off client. The exchange writes the session cookies on success.
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Validated INTERNAL path, emitted RELATIVE (no Host trust, no cookie drop).
      const destination = safeInternalPath(searchParams.get('next')) ?? DEFAULT_NEXT;
      return relativeRedirect(destination);
    }
  }

  // ONE generic outcome for denied consent / missing code / exchange error — never
  // leak the provider, email, or failure reason (D-08 / OAUTH-06 / T-28-05).
  return relativeRedirect('/login?error=auth');
}
