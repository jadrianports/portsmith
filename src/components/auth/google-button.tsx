'use client';

/**
 * Google sign-in button island (OAUTH-06 / D-07 / D-09 / SHARED-E).
 *
 * A SEPARATE client island that sits below the credential form on BOTH /login
 * and /signup. It is deliberately NOT part of `login-form.tsx` / `signup-form.tsx`
 * (D-09): the credential path's Zod/Turnstile/BotID/ToS state and submit handler
 * stay byte-unchanged, so the anti-spam gate-stack is untouched. The button only
 * triggers the server-owned `signInWithGoogleAction` (the server boundary owns the
 * auth call — a bot can't bypass it by calling supabase.auth from the browser).
 *
 * Behavior: `signInWithGoogleAction` REDIRECTS on success (throws NEXT_REDIRECT,
 * which propagates out of the await and navigates the browser to Google's consent
 * screen). It only RETURNS on the rare `{ ok: false }` non-redirect failure — the
 * single case where we re-enable the button and surface a generic error (D-08:
 * no provider/reason leak).
 *
 * Tokens: chrome-only (Evergreen/Copper, Inter). The surface/border/text are
 * `--theme`-driven (no inline hex, SHARED-E). The official Google "G" glyph is the
 * one sanctioned multi-color mark (Google brand-guideline requirement; lucide has
 * no Google glyph) and is `aria-hidden` decoration. `min-h-11` is the ≥44px WCAG
 * 2.5.5 touch target; `focus-visible:outline-ring` is the chrome accent focus ring.
 */
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { signInWithGoogleAction } from '@/lib/auth/oauth-action';

/**
 * The official multi-color Google "G" mark (decorative). Required by Google's
 * brand guidelines for "Sign in with Google" and the only sanctioned inline-color
 * SVG in the chrome (it is a brand asset, not a theme color — SHARED-E exception).
 */
function GoogleGlyph() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function GoogleButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      // Redirects on success (throws NEXT_REDIRECT). Only returns on { ok: false }.
      const result = await signInWithGoogleAction();
      if (result && !result.ok) {
        setFailed(true);
        setPending(false);
      }
    } catch {
      // A NEXT_REDIRECT propagates here on success and is re-thrown by React; a
      // genuine network error lands here too — surface generically, re-enable.
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {failed ? (
        <Alert variant="error">Couldn&apos;t start Google sign-in. Please try again.</Alert>
      ) : null}

      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending || undefined}
        className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px motion-reduce:active:translate-y-0 motion-reduce:transition-none disabled:cursor-not-allowed disabled:text-muted-foreground"
      >
        {pending ? (
          <>
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            <span>Connecting…</span>
          </>
        ) : (
          <>
            <GoogleGlyph />
            <span>Continue with Google</span>
          </>
        )}
      </button>
    </div>
  );
}

/**
 * The "or continue with" divider + GoogleButton block, rendered identically below
 * the credential form on BOTH auth pages (D-07). Page-level placement (an RSC
 * imports this island once, below the form island) keeps the two islands maximally
 * separate while guaranteeing identical markup.
 */
export function GoogleSignInSection() {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[13px] text-muted-foreground">or continue with</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton />
    </div>
  );
}
