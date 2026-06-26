'use server';

/**
 * Sign-out server action (AUTH — the user-facing logout that was missing).
 *
 * A `'use server'` action so the session teardown happens on the server boundary:
 * `supabase.auth.signOut()` on the authenticated `@supabase/ssr` server client clears
 * the auth cookies via the cookie handler (the same cookie-clearing path the account-
 * delete route and the locked-account login branch already use), then `redirect('/login')`
 * sends the now-anonymous user to the sign-in page.
 *
 * Rendered as a plain `<form action={logoutAction}>` + submit button (no client JS), so
 * it works identically from the chrome header (a client island) and the Settings RSC.
 *
 * No identity read is needed: signing out is safe regardless of state (a stale/expired
 * session signs out to a clean redirect; `getSession()` is never used — AUTH-05). The
 * `redirect()` throws the framework's NEXT_REDIRECT, which the form POST resolves into a
 * navigation — never caught/swallowed here.
 */
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
