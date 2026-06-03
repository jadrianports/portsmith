/**
 * `GET /api/preview/enable` — turn ON Draft Mode for the OWNER, then redirect to
 * their OWN public slug so the `[username]/page.tsx` draft branch renders their
 * unpublished, last-saved portfolio through the real template (TMPL-05 / D-P4-09).
 *
 * This is the FIRST `app/api/**\/route.ts` handler in the repo. Draft Mode's
 * `enable()`/`disable()` are Route-Handler-only in Next 16, which is exactly why
 * the preview lives behind a route pair rather than a server action.
 *
 * SECURITY (threat register T-04-07a/b/e + T-07-13):
 * - getVerifiedClaims() (verified JWT via getClaims) — NEVER getSession() (AUTH-05).
 *   No verified session → redirect to /login.
 * - OWNER-ONLY + OPEN-REDIRECT HARDENING (T-04-07b): the redirect target is the
 *   caller's OWN username, RESOLVED SERVER-SIDE from `claims.sub`. Any client-
 *   supplied `?username`/URL is IGNORED — the same posture as the login form's
 *   `safeInternalPath` (never honor a client-supplied redirect destination). This
 *   makes the enable route incapable of bouncing the cookie-bearing visitor to an
 *   attacker-chosen URL, and incapable of setting the draft cookie for a slug the
 *   caller does not own (the page + owner-read re-confirm ownership anyway).
 * - CANDIDATE-TEMPLATE PREVIEW (07-05 / T-07-13, V5): the ONLY value read from the
 *   client is the OPTIONAL `?template=<slug>` — the template to preview, NOT a
 *   redirect destination. It is `templateSlugSchema.safeParse`'d against registry
 *   membership; a successful parse sets a small httpOnly `preview-template` cookie
 *   that the page's DRAFT branch reads to render the owner's OWN content through the
 *   candidate template. An unknown/crafted slug fails the parse → NO cookie is set →
 *   a raw slug NEVER reaches a render path (the page re-validates the cookie anyway).
 *   The candidate rides the EXISTING `__prerender_bypass` draft cookie branch; the
 *   public path stays cookie-less → `/[username]` stays `● SSG` (T-07-15 / Pitfall 2).
 *
 * NEXT 16 ASYNC API (RESEARCH Pattern 2): `draftMode()` AND `cookies()` are ASYNC —
 * `await` them first, THEN call `.enable()` / `.set()`. The old sync form is removed.
 *
 * NOTE: `redirect()` throws a control-flow signal (`NEXT_REDIRECT`) — it must be
 * called at the top level of the handler, never inside a try/catch that would
 * swallow it.
 */
import { cookies, draftMode } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { templateSlugSchema } from '@/components/templates/registry';
import { PREVIEW_TEMPLATE_COOKIE } from '@/lib/preview/cookie';

export async function GET(request: Request): Promise<never> {
  // (1) Verified identity — no session → bounce to login (NEVER getSession).
  const claims = await getVerifiedClaims();
  if (!claims?.sub) redirect('/login');

  // (2) CANDIDATE TEMPLATE (the ONLY client-supplied value used here, V5): read the
  //     optional `?template=<slug>` and Zod-validate it against registry membership.
  //     `safeParse` of a missing/unknown/crafted slug yields `success: false` → we
  //     simply do NOT set the cookie (a raw slug never reaches a render path,
  //     T-07-13). This is the TEMPLATE to preview — NOT a redirect destination; the
  //     redirect target below stays server-resolved from `claims.sub`.
  const candidate = templateSlugSchema.safeParse(
    new URL(request.url).searchParams.get('template'),
  );

  // (3) Resolve the caller's OWN username server-side. The redirect target is
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

  // (4) Enable Draft Mode (sets __prerender_bypass). draftMode() is async in Next 16
  //     — MUST await before .enable().
  const draft = await draftMode();
  draft.enable();

  // (5) On a VALID candidate only, set the `preview-template` cookie in the SAME
  //     handler (RESEARCH Open-Q1). cookies() is async in Next 16 — await it. The
  //     page DRAFT branch re-validates this value before rendering (defense-in-depth,
  //     T-07-14); a missing cookie → the draft branch falls back to the persisted slug.
  if (candidate.success) {
    const cookieStore = await cookies();
    cookieStore.set(PREVIEW_TEMPLATE_COOKIE, candidate.data, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  }

  redirect(`/${profile.username}`);
}
