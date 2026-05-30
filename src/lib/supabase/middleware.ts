import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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
  const isProtected =
    path.startsWith('/dashboard') || path.startsWith('/admin');
  if (isProtected && !claims) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirectedFrom', path);
    return NextResponse.redirect(redirectUrl);
  }

  // Always return `supabaseResponse` unchanged so the refreshed cookies are
  // preserved. If you build your own response, copy over its cookies first.
  return supabaseResponse;
}
