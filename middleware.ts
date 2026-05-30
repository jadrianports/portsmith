import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Root middleware. Delegates to `updateSession`, which refreshes the Supabase
 * auth session on every request and writes the refreshed cookies to BOTH the
 * request and the response (the only supported `@supabase/ssr` refresh model).
 *
 * Per the SSR contract, `updateSession` runs NO code between client creation
 * and the `getClaims()` auth call — that timing is load-bearing for the
 * refresh/cookie-write (repo-root CLAUDE.md "@supabase/ssr triad").
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
