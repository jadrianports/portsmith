'use server';

/**
 * Google OAuth initiate action (OAUTH-01, D-01, D-07, D-08, D-09).
 *
 * The server-side front door for "Sign in with Google". Like `signupAction` /
 * `loginAction`, this is a Server Action (`'use server'`) so the SERVER boundary
 * owns the auth call — a bot cannot bypass it by calling `supabase.auth` directly
 * from the browser. The client only renders a button that invokes this action.
 *
 * Flow:
 *   1. providerSchema.parse('google') — D-01 single-literal allowlist (the Zod
 *      gate for this action; future-extensible to 'github' when OAUTH-02 lands).
 *   2. supabase.auth.signInWithOAuth({ provider, options: { redirectTo } }) — the
 *      `redirectTo` is an ABSOLUTE URL built from `NEXT_PUBLIC_SITE_URL` (the
 *      siteUrl convention; NEVER the request Host), pointing at the BARE
 *      `/auth/callback` PKCE route. It MUST exactly match an
 *      `additional_redirect_urls` entry (Plan 03 adds it) or GoTrue rejects it.
 *      This call also sets the PKCE code-verifier cookie through the same ssr
 *      server client the callback later reads (Pitfall 2/4, load-bearing).
 *   3. On success `data.url` is the provider consent URL → `redirect(data.url)` at
 *      TOP LEVEL (throws NEXT_REDIRECT — never inside a swallowing try/catch).
 *
 * D-09 (deliberate): the OAuth path is NOT Turnstile/BotID/disposable/ledger
 * gated. Google's consent screen is the bot barrier, and the OAuth redirect never
 * submits the credential form — so none of the credential-path gates apply here,
 * and they remain entirely intact for signup/login. Do NOT add an anti-spam gate.
 *
 * D-08 (enumeration-safe): on any non-redirect error (`error` or a missing
 * `data.url`) the action returns a BARE `{ ok: false }` — no provider name, no
 * reason, no email. The button island surfaces a single generic failure.
 *
 * Verified-identity discipline (AUTH-05): this action never calls `getSession()`.
 */
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

/**
 * D-01: the provider allowlist. A single literal today (Google-only scope); add
 * `'github'` here (a `z.union`/`z.enum`) when OAUTH-02 lands — the only change the
 * action needs to support a second provider.
 */
const providerSchema = z.literal('google');

/**
 * Initiate Google OAuth. Returns `{ ok: false }` ONLY on a (rare) non-redirect
 * failure; the success path throws `NEXT_REDIRECT` (it never returns normally),
 * which is why the return type is `{ ok: false } | never`.
 */
export async function signInWithGoogleAction(): Promise<{ ok: false } | never> {
  const provider = providerSchema.parse('google');
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      // Absolute from NEXT_PUBLIC_SITE_URL (siteUrl convention) — NEVER the request
      // Host. Must EXACTLY match an additional_redirect_urls entry (Plan 03).
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  // Generic, enumeration-safe (D-08) — no provider/reason leak.
  if (error || !data?.url) {
    return { ok: false };
  }

  // Top-level redirect (throws NEXT_REDIRECT) — outside any try/catch so the
  // redirect signal is never swallowed. Sends the browser to Google's consent.
  redirect(data.url);
}
