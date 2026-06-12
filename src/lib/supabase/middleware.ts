import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { ONBOARDING_SKIP_COOKIE } from '@/lib/onboarding/skip-cookie';

/**
 * Refreshes the Supabase auth session on every request (the only supported
 * `@supabase/ssr` refresh model) and writes the refreshed cookies to BOTH the
 * request and the outgoing `NextResponse`.
 *
 * Contract (do not "tidy" this):
 *  - Use `createServerClient` here, NEVER `createBrowserClient` — middleware
 *    must refresh + persist via request/response cookies.
 *  - `setAll` writes each refreshed cookie to the request cookies AND a freshly
 *    recreated response, so the new tokens land on both the request (for any
 *    downstream Server Component this pass) and the response (back to the
 *    browser).
 *  - Run NO code between client creation and the `getClaims()` auth call. The
 *    auth call is what triggers the refresh + cookie writes; inserting code in
 *    between breaks the refresh/cookie-write timing (CLAUDE.md "@supabase/ssr
 *    triad" — "do not run code between client creation and the auth call").
 *
 * TODO(01-08): parameterize with the generated `Database` type once Plan 08
 *   runs `supabase gen types`.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: no code between createServerClient above and getClaims below.
  // getClaims() verifies the JWT signature (AUTH-05) and drives the refresh +
  // cookie writes. getSession() is NEVER used here — it is spoofable.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  // Minimal, correct route protection. Real dashboard/route-protection UI is
  // P2/P4; here we only redirect unauthenticated requests away from protected
  // route groups so the matcher + verified-identity wiring is exercised.
  const path = request.nextUrl.pathname;
  // `/onboarding` is the first-run wizard (18-03 / T-18-onboarding-anon) — an
  // unauthenticated request must be bounced to /login before it can reach the
  // wizard. This is a single string in the EXISTING predicate: NO DB read is added
  // here (the `onboarded_at` first-run gate lives in the /dashboard RSC, not in
  // middleware), and NO code is inserted between `createServerClient` and
  // `getClaims()` above (the load-bearing @supabase/ssr refresh-timing rule).
  const isProtected =
    path.startsWith('/dashboard') ||
    path.startsWith('/admin') ||
    path.startsWith('/onboarding');
  if (isProtected && !claims) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirectedFrom', path);
    return NextResponse.redirect(redirectUrl);
  }

  // ONE-SHOT onboarding-skip clear (18-03 / D-04 / ONB-05). The soft-skip cookie set
  // by `/api/onboarding/skip` lets a not-yet-onboarded owner reach the editor for
  // exactly ONE `/dashboard` visit. The dashboard RSC gate READS the cookie (an RSC
  // may not mutate cookies), so middleware — which runs before the RSC and owns the
  // response cookies — clears it HERE on the same `/dashboard` request: the cookie is
  // still readable by the RSC this pass (it lives on the request), but is deleted from
  // the OUTGOING response, so the NEXT request no longer carries it and the gate
  // re-fires (escapable for one visit, never a loop). This is NOT a DB read and runs
  // AFTER `getClaims()`, so the @supabase/ssr refresh-timing rule is preserved.
  if (path.startsWith('/dashboard') && request.cookies.has(ONBOARDING_SKIP_COOKIE)) {
    // Delete with the SAME `path: '/'` the skip route set it at, so the browser
    // reliably drops the httpOnly cookie (a bare name-only delete uses the default
    // path and can leave a path-'/' cookie behind).
    supabaseResponse.cookies.delete({ name: ONBOARDING_SKIP_COOKIE, path: '/' });
  }

  // Always return `supabaseResponse` unchanged so the refreshed cookies are
  // preserved. If you build your own response, copy over its cookies first.
  return supabaseResponse;
}
