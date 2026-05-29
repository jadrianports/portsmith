import { NextResponse, type NextRequest } from 'next/server';

/**
 * PASSTHROUGH STUB — Plan 04 (Supabase clients) replaces this body.
 *
 * Plan 04 swaps the no-op below for `await updateSession(request)` from
 * `src/lib/supabase/middleware.ts`, which refreshes the Supabase auth session on
 * every request and writes refreshed cookies to BOTH the request and the
 * response (the only supported `@supabase/ssr` refresh model). Per the SSR
 * contract, run NO code between client creation and the `getClaims()`/`getUser()`
 * auth call — it breaks the refresh/cookie-write timing
 * (repo-root CLAUDE.md "@supabase/ssr triad").
 *
 * Until then this is a pure passthrough so the app builds and runs.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets. Plan 04 keeps
  // this matcher when it wires session refresh.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
