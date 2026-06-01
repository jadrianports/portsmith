/**
 * `GET /api/preview/enable` — turn ON Draft Mode for the OWNER, then redirect to
 * their OWN public slug so the `[username]/page.tsx` draft branch renders their
 * unpublished, last-saved portfolio through the real template (TMPL-05 / D-P4-09).
 *
 * This is the FIRST `app/api/**\/route.ts` handler in the repo. Draft Mode's
 * `enable()`/`disable()` are Route-Handler-only in Next 16, which is exactly why
 * the preview lives behind a route pair rather than a server action.
 *
 * SECURITY (threat register T-04-07a/b/e):
 * - getVerifiedClaims() (verified JWT via getClaims) — NEVER getSession() (AUTH-05).
 *   No verified session → redirect to /login.
 * - OWNER-ONLY + OPEN-REDIRECT HARDENING (T-04-07b): the redirect target is the
 *   caller's OWN username, RESOLVED SERVER-SIDE from `claims.sub`. Any client-
 *   supplied `?username`/URL is IGNORED — the same posture as the login form's
 *   `safeInternalPath` (never honor a client-supplied redirect destination). This
 *   makes the enable route incapable of bouncing the cookie-bearing visitor to an
 *   attacker-chosen URL, and incapable of setting the draft cookie for a slug the
 *   caller does not own (the page + owner-read re-confirm ownership anyway).
 *
 * NEXT 16 ASYNC API (RESEARCH Pattern 2): `draftMode()` is ASYNC — `await` it
 * first, THEN call `.enable()` (which sets the `__prerender_bypass` cookie). The
 * old sync form is removed.
 *
 * NOTE: `redirect()` throws a control-flow signal (`NEXT_REDIRECT`) — it must be
 * called at the top level of the handler, never inside a try/catch that would
 * swallow it.
 */
import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

export async function GET(): Promise<never> {
  // (1) Verified identity — no session → bounce to login (NEVER getSession).
  const claims = await getVerifiedClaims();
  if (!claims?.sub) redirect('/login');

  // (2) Resolve the caller's OWN username server-side. The redirect target is
  //     derived ONLY from this row — never from a client-supplied parameter
  //     (open-redirect hardening, mirrors login-form safeInternalPath).
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', claims.sub as string)
    .maybeSingle();

  // No profile/username yet → there is nothing to preview; send them to the
  // dashboard rather than guessing a slug.
  if (!profile?.username) redirect('/dashboard');

  // (3) Enable Draft Mode (sets __prerender_bypass) then redirect to the owner's
  //     OWN slug. draftMode() is async in Next 16 — MUST await before .enable().
  const draft = await draftMode();
  draft.enable();

  redirect(`/${profile.username}`);
}
