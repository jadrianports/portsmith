/**
 * `GET /api/onboarding/skip` — the SOFT-SKIP control (18-03 / D-04 / ONB-05). The
 * owner chooses to skip the onboarding wizard and go straight to the editor; this
 * route sets the one-shot `onboarding-skip` cookie and redirects to `/dashboard`,
 * where the D-02 gate reads-and-clears it (so THIS visit reaches the editor, but
 * the NEXT visit — cookie gone, `onboarded_at` still null — routes them back to
 * `/onboarding` until they actually publish).
 *
 * Mirrors the `/api/preview/enable` route-handler shape: a verified-identity check,
 * an async `cookies()` set in Next 16, and a TOP-LEVEL `redirect()` (never inside a
 * try/catch — `redirect()` throws the `NEXT_REDIRECT` control signal).
 *
 * SECURITY (threat register T-18-skip + T-18-redirect):
 * - getVerifiedClaims() (verified JWT via getClaims) — NEVER getSession() (AUTH-05).
 *   No verified session → redirect to /login. The cookie is therefore only ever set
 *   FOR a signed-in owner skipping THEIR OWN onboarding.
 * - The cookie carries NO identity and NO authz — it is a pure one-visit UX bypass.
 *   It does NOT stamp `onboarded_at` (D-04 — soft-skip stays RESUMABLE; only the
 *   wizard's terminal Publish via `markOnboardedAndPublish` durably marks finished).
 * - NO open redirect: the redirect target is the FIXED internal `/dashboard` literal,
 *   never a client-supplied destination (mirrors `/api/preview/enable`'s
 *   server-resolved target). No request value is read at all.
 * - The cookie is httpOnly + sameSite=lax + path=/ + a short maxAge — unreadable from
 *   client JS, and one-shot anyway (the gate clears it on the very next load).
 *
 * NEXT 16 ASYNC API: `cookies()` is ASYNC — `await` it first, THEN `.set()`. The old
 * sync form is removed.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getVerifiedClaims } from '@/lib/supabase/server';
import { ONBOARDING_SKIP_COOKIE } from '@/lib/onboarding/skip-cookie';

export async function GET(): Promise<never> {
  // (1) Verified identity — no session → bounce to login (NEVER getSession). The
  //     soft-skip is only ever granted to a signed-in owner for their own onboarding.
  const claims = await getVerifiedClaims();
  if (!claims?.sub) redirect('/login');

  // (2) Set the one-shot skip cookie. cookies() is async in Next 16 — await it.
  //     httpOnly + sameSite=lax + path=/ so it travels with the dashboard request
  //     and is unreadable from client JS; a short maxAge (5 min) is a backstop — the
  //     gate clears it on the next load anyway (one-shot). Does NOT stamp
  //     onboarded_at (D-04 — soft-skip stays resumable until publish).
  const cookieStore = await cookies();
  cookieStore.set(ONBOARDING_SKIP_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 5,
  });

  // (3) Redirect to the FIXED internal dashboard (no client-supplied destination →
  //     no open redirect). TOP-LEVEL — never inside a try/catch (it throws
  //     NEXT_REDIRECT).
  redirect('/dashboard');
}
