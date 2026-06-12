'use client';

/**
 * PayoffStep (18-05 / UI-SPEC Surface 5 — the full-screen "You're live" payoff, D-15).
 *
 * The wizard's TERMINAL step (a full-screen takeover, NOT a modal — no Modal primitive
 * exists). Reached after the Publish step's `markOnboardedAndPublish` resolves ok. It
 * is the emotional arrival moment of ONB-06: the user's real, live, shareable address,
 * front and centre, with one-click copy + native share.
 *
 * THE LIVE URL IS HOST-INDEPENDENT (D-22 / T-18-host-url, load-bearing): the readback
 * field, the "View my live page ↗" link, the Copy link, and the native Share ALL use
 * `siteUrl('/' + username)` — which reads ONLY `NEXT_PUBLIC_SITE_URL`, NEVER the request
 * Host. The later domain switch is an env change only; the displayed URL can't be
 * poisoned by a forged Host header.
 *
 * DISABLE-ON-EXIT (D-15 / T-18-draft-disable): "Go to my dashboard" fires
 * `GET /api/preview/disable` BEFORE navigating, clearing `__prerender_bypass` +
 * `preview-template` so the now-PUBLISHED owner's OWN anon visit to their URL gets the
 * live ISR page, not a stale draft render (RESEARCH Risk 1 — the single correctness
 * hazard, made a discrete exit action). (The disable route itself redirects to
 * `/dashboard`, so following it lands the user in the editor.)
 *
 * SHARE IS FEATURE-DETECTED (UI-SPEC): the "Share" button is rendered ONLY when
 * `navigator.share` exists (mounted-client check) — absent → it simply isn't there. NO
 * social SDKs / QR (Phase 20 owns OG cards).
 *
 * MOTION (D-15, "warm + subtle"): the card uses the scoped `.payoff-enter` keyframe
 * (~250ms ease-out fade/rise, in the shipped `.preview-banner-enter` idiom). It animates
 * ONLY under `prefers-reduced-motion: no-preference`; under reduced-motion the payoff
 * appears in its FINAL state instantly (the keyframe is media-gated in globals.css).
 * NO confetti, NO emoji.
 *
 * TWO-LAYER IDENTITY (SHARED-E): chrome tokens ONLY (Evergreen/Copper, Inter); CTAs are
 * brand fill, the "View my live page ↗" link rests foreground → copper on hover (the
 * reserved accent), the URL sits in a `--color-surface-muted` readback field. No inline hex.
 */
import { Check, Copy, ExternalLink, Share2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { siteUrl } from '@/lib/url';

/** Copy (UI-SPEC § Payoff screen Copywriting — verbatim; curly apostrophe). */
const COPY = {
  headline: 'You’re live',
  subline: 'Your page is published and ready to share.',
  copy: 'Copy link',
  copied: 'Link copied',
  share: 'Share',
  shareTitle: 'My portfolio',
  viewLive: 'View my live page ↗',
  dashboard: 'Go to my dashboard',
  copyFallback: 'Copy the link above to share your page.',
} as const;

export interface PayoffStepProps {
  /** The owner's username — the live URL is `siteUrl('/' + username)` (host-independent). */
  username: string;
}

export function PayoffStep({ username }: PayoffStepProps) {
  // The host-independent live URL (D-22) — NEVER the request host.
  const liveUrl = siteUrl('/' + username);
  // The protocol-stripped readback (host + path is what the user reads).
  const liveUrlDisplay = liveUrl.replace(/^https?:\/\//, '');

  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // navigator.share is detected on the MOUNTED client (it is undefined during SSR);
  // the Share button is rendered only when present (no SSR/CSR mismatch — it mounts
  // false then flips true after hydration if supported).
  const [canShare, setCanShare] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // Re-settle the "Link copied" confirmation back after ~2.2s (the chrome saved-beat grain).
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  /** Copy the live URL to the clipboard → the confirmed "Link copied" state (announced). */
  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        // Clipboard blocked/unavailable → surface the selectable-URL fallback copy.
        setCopyFailed(true);
        return;
      }
      await navigator.clipboard.writeText(liveUrl);
      setCopyFailed(false);
      setCopied(true);
    } catch {
      // A blocked clipboard write → the fallback "Copy the link above" guidance.
      setCopyFailed(true);
    }
  }, [liveUrl]);

  /** Native Web Share (supported devices only) — the live URL, no social SDK. */
  const handleShare = useCallback(async () => {
    try {
      await navigator.share({ title: COPY.shareTitle, url: liveUrl });
    } catch {
      // The user cancelled the share sheet, or it failed — a no-op (never an error UI).
    }
  }, [liveUrl]);

  /**
   * "Go to my dashboard" — fire `GET /api/preview/disable` FIRST (clear the draft
   * cookie so the owner's own anon visit gets live ISR, T-18-draft-disable) THEN
   * navigate. The disable route redirects to `/dashboard`, so a full navigation to it
   * both clears the cookie and lands the user in the editor. A failed clear must not
   * trap the user — proceed regardless.
   */
  const goToDashboard = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    // A full navigation to the disable route: it clears __prerender_bypass +
    // preview-template, then 302s to /dashboard. One hop does both.
    window.location.assign('/api/preview/disable');
  }, [leaving]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-16 sm:py-24">
      <div className="payoff-enter flex w-full max-w-md flex-col items-center gap-6 rounded-md border border-border bg-surface p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
        {/* Headline + sub-line (the moment — the warmth is the motion + copy, no emoji). */}
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            {COPY.headline}
          </h1>
          <p className="text-base leading-normal text-muted-foreground">{COPY.subline}</p>
        </div>

        {/* The live URL — a selectable, host-independent readback field (D-22). */}
        <div className="w-full">
          <span className="sr-only">Your live page address</span>
          <p className="select-all break-all rounded-sm bg-surface-muted px-3 py-2 text-base leading-normal text-foreground">
            {liveUrlDisplay}
          </p>
        </div>

        {/* Primary actions: Copy link (brand) + Share (native, supported devices only). */}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="primary"
            onClick={handleCopy}
            className="w-full sm:w-auto"
            aria-label={copied ? COPY.copied : COPY.copy}
          >
            {copied ? (
              <>
                <Check aria-hidden="true" className="size-4" />
                <span>{COPY.copied}</span>
              </>
            ) : (
              <>
                <Copy aria-hidden="true" className="size-4" />
                <span>{COPY.copy}</span>
              </>
            )}
          </Button>

          {canShare ? (
            <Button variant="ghost" onClick={handleShare} className="w-full sm:w-auto">
              <Share2 aria-hidden="true" className="size-4" />
              <span>{COPY.share}</span>
            </Button>
          ) : null}
        </div>

        {/* Polite announcement of the copy confirmation (word, not color alone). */}
        <span aria-live="polite" className="sr-only">
          {copied ? COPY.copied : ''}
        </span>

        {/* Copy fallback (clipboard blocked) — the selectable URL above + this guidance. */}
        {copyFailed ? (
          <p className="text-[13px] leading-tight text-muted-foreground">
            {COPY.copyFallback}
          </p>
        ) : null}

        {/* "View my live page ↗" — resting foreground, copper on hover, new tab (D-22 URL). */}
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={
            'inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-foreground ' +
            'underline-offset-2 outline-none transition-colors hover:text-accent hover:underline ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
            'motion-reduce:transition-none'
          }
        >
          <span>{COPY.viewLive}</span>
          <ExternalLink aria-hidden="true" className="size-4" />
          <span className="sr-only"> (opens your public page in a new tab)</span>
        </a>

        {/* Exit — "Go to my dashboard" (brand fill) fires /api/preview/disable on exit. */}
        <div className="w-full">
          <Button
            variant="primary"
            onClick={goToDashboard}
            disabled={leaving}
            className="w-full"
          >
            {COPY.dashboard}
          </Button>
        </div>
      </div>
    </main>
  );
}
