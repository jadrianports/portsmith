'use client';

/**
 * PreviewBanner (04-UI-SPEC §11 / UI-SPEC B.5 #6 / TMPL-05 / D-P4-09) — the ONE
 * chrome element that is ever overlaid on a portfolio-TEMPLATE surface.
 *
 * It sits atop the previewed template inside Draft Mode and tells the owner, in no
 * uncertain terms, that they are looking at a private draft only they can see, with a
 * one-click way out.
 *
 * 07-05 — the SWITCH-FLOW confirm bar (REUSED, not redesigned — UI-SPEC B.5 #6):
 * when previewing a CANDIDATE template (`candidateSlug` present — the page sets it
 * from the vetted `preview-template` cookie), the banner additionally shows:
 *   - a "Previewing the {Template} template" line (Label, chrome tokens);
 *   - the warn-but-allow MismatchWarning (above the confirm — D-P7-12), if any;
 *   - a confirm bar: "Use this template" (BRAND fill — the confirm) + "Back to
 *     templates" (ghost — exits Draft Mode via the disable route, dropping the
 *     candidate). If the candidate IS the current template, the confirm reads "Keep
 *     this template" (a no-op dismiss → back to the gallery).
 * "Use this template" calls `switchTemplateAction(candidateSlug)`; on `ok` it shows
 * the calm "Your page now uses the {Template} template" success beat (the Phase-4
 * publish-beat chord: brand confirm + `--color-accent` glyph + `--color-success`
 * caption) with a "View live ↗" link, then EXITS Draft Mode so the owner lands on the
 * now-live public page. On error it surfaces the destructive switch-error Alert with
 * retry. The confirm is NEVER disabled by the mismatch (warn-but-allow — D-P7-11).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ LOAD-BEARING ISOLATION (two-layer identity / UI-SPEC §11 / D-17):            │
 * │ The banner overlays a template that owns its OWN scoped theme. To stop it    │
 * │ from inheriting that theme it EXPLICITLY sets the chrome font (`--font-sans`, │
 * │ Inter) and uses ONLY chrome tokens (`--color-*`) — NEVER a template token,   │
 * │ NEVER an inline hex. This is the only place a chrome component may visually   │
 * │ sit on a template surface, so the scoping is mandatory, not cosmetic. The    │
 * │ accent (copper) is used ONLY for the success-beat `circle-check` glyph (the   │
 * │ inherited reserved-for list); the confirm uses BRAND fill, the success       │
 * │ caption uses `--color-success`.                                              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Exit / Back / View-live: full navigations via plain `<a href>` / `window.location`
 * (NOT next/link) — prefetch can race/delete the `__prerender_bypass` draft cookie
 * (RESEARCH Pattern 2 caveat / T-07-16). "Back to templates" + the post-switch exit
 * both target `/api/preview/disable`, which clears Draft Mode AND the candidate cookie.
 *
 * Reduced-motion: entry slide + the success wash are suppressed under
 * `prefers-reduced-motion`; state / color / copy still change.
 */
import { CircleAlert, CircleCheck, ExternalLink, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';

import { switchTemplateAction } from '@/lib/cms/switch-template-action';
import type { TemplateSpec } from '@/components/templates/minimal/spec';

import { TemplateMismatchWarning } from './template-mismatch-warning';

/** The disable route — clears Draft Mode + the candidate cookie (full nav, no prefetch). */
const DISABLE_HREF = '/api/preview/disable';
/** How long the calm "switched & live" success beat holds before exiting Draft Mode. */
const SUCCESS_BEAT_MS = 2200;

export interface PreviewBannerProps {
  /** The owner's slug — shown so the banner is unambiguous about WHICH page. */
  username: string;
  /** When false, append the "not public yet" caption (the draft is unpublished). */
  published: boolean;
  /**
   * 07-05 — the CANDIDATE template slug being previewed (from the vetted
   * `preview-template` cookie). When omitted, the banner renders its plain Phase-4
   * "Exit preview" shape (no confirm bar). When present, the switch-flow confirm bar
   * renders.
   */
  candidateSlug?: string;
  /** The candidate's display name ("Editorial") for the confirm copy. */
  candidateName?: string;
  /** The portfolio's CURRENT (persisted) slug — drives the "Keep this template" no-op. */
  currentSlug?: string;
  /** The current template's display name (for the "Keep this template" path copy). */
  currentName?: string;
  /**
   * The owner's FILLED + VISIBLE section types (from `filledVisibleSectionTypes`).
   * Feeds the warn-but-allow MismatchWarning. `[]`/undefined → the warning is silent.
   */
  filledVisibleTypes?: string[];
  /** The candidate template's spec — feeds the MismatchWarning predicate. */
  candidateSpec?: TemplateSpec;
}

export function PreviewBanner({
  username,
  published,
  candidateSlug,
  candidateName,
  currentSlug,
  currentName,
  filledVisibleTypes,
  candidateSpec,
}: PreviewBannerProps) {
  // The switch-flow renders only when a vetted candidate is being previewed.
  const isSwitchFlow = Boolean(candidateSlug);
  // The candidate equals the current persisted template → the confirm is a no-op
  // "Keep this template" dismiss (UI-SPEC B.5 #3 / B.8).
  const candidateIsCurrent = isSwitchFlow && candidateSlug === currentSlug;
  const templateName = candidateName ?? candidateSlug ?? '';

  return (
    <div
      role="status"
      aria-live="polite"
      // Chrome font is set explicitly so the banner cannot inherit the template's
      // display face. `font-sans` maps to the chrome `--font-sans` (Inter) token.
      style={{ fontFamily: 'var(--font-sans)' }}
      className={
        'preview-banner-enter font-sans fixed inset-x-0 top-0 z-50 flex flex-col gap-2 ' +
        'border-b border-border bg-surface-muted px-4 py-2.5 text-warning'
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              Draft preview — only you can see this
            </p>
            {isSwitchFlow ? (
              // The switch-flow context line (Label, chrome tokens). Uses foreground
              // (not warning) so it reads as neutral context, not a caution.
              <p className="truncate text-[13px] font-semibold text-foreground">
                Previewing the {templateName} template
              </p>
            ) : !published ? (
              <p className="truncate text-[13px] text-muted-foreground">
                This page is not public yet.
              </p>
            ) : null}
          </div>
          <span className="sr-only">Previewing /{username}</span>
        </div>

        {isSwitchFlow ? (
          <SwitchConfirm
            candidateSlug={candidateSlug as string}
            templateName={templateName}
            candidateIsCurrent={candidateIsCurrent}
            currentName={currentName}
            username={username}
          />
        ) : (
          // Phase-4 plain exit: full navigation (not next/link) to the disable Route
          // Handler — clears the draft cookie and returns to the dashboard.
          <a
            href={DISABLE_HREF}
            className={
              'inline-flex shrink-0 items-center justify-center rounded-md border border-border ' +
              'bg-transparent px-3 py-1.5 text-sm font-semibold text-foreground outline-none ' +
              'transition-colors hover:bg-surface focus-visible:outline-2 ' +
              'focus-visible:outline-offset-2 focus-visible:outline-ring'
            }
          >
            Exit preview
          </a>
        )}
      </div>

      {/* The warn-but-allow MismatchWarning renders ABOVE the confirm (D-P7-12), only
          in the switch flow and only when the candidate omits a filled section. It
          NEVER disables the confirm. Silent in v1 (both templates cover all types). */}
      {isSwitchFlow && candidateSpec && filledVisibleTypes ? (
        <TemplateMismatchWarning
          candidateSlug={candidateSlug as string}
          candidateSpec={candidateSpec}
          filledVisibleTypes={filledVisibleTypes}
        />
      ) : null}
    </div>
  );
}

/**
 * The confirm-bar control: "Use this template" (brand) / "Keep this template" (ghost,
 * when the candidate is already current) + "Back to templates" (ghost), with the
 * committing / switched-&-live / error beats (UI-SPEC B.5 #4). Split out so the action
 * state (`useTransition` + the result) lives in one place.
 */
function SwitchConfirm({
  candidateSlug,
  templateName,
  candidateIsCurrent,
  currentName,
  username,
}: {
  candidateSlug: string;
  templateName: string;
  candidateIsCurrent: boolean;
  currentName?: string;
  username: string;
}) {
  const [isPending, startTransition] = useTransition();
  // null = idle; 'ok' = switched-&-live beat showing; 'error' = the retry Alert.
  const [outcome, setOutcome] = useState<null | 'ok' | 'error'>(null);

  /** Run the switch, then on success hold the beat and exit Draft Mode. */
  function commit() {
    setOutcome(null);
    startTransition(async () => {
      const res = await switchTemplateAction(candidateSlug);
      if (res.ok) {
        setOutcome('ok');
        // Hold the calm success beat (~2.2s, mirrors the Phase-4 saved beat), then
        // EXIT Draft Mode via a full navigation to the disable route so the owner
        // lands on the now-live public page (the candidate cookie is cleared there).
        // window.location (not next/link) — prefetch can race the draft cookie.
        window.setTimeout(() => {
          window.location.href = DISABLE_HREF;
        }, SUCCESS_BEAT_MS);
      } else {
        setOutcome('error');
      }
    });
  }

  // ── SWITCHED & LIVE — the calm success beat (brand confirm morphs to the accent
  //    circle-check + the success caption + View live ↗; holds ~2.2s, then exits). ──
  if (outcome === 'ok') {
    return (
      <div
        // success-bg wash (suppressed under reduced motion via the class below)
        className={
          'flex shrink-0 items-center gap-2 rounded-md bg-success-bg px-3 py-1.5 ' +
          'preview-banner-enter motion-reduce:[animation:none]'
        }
        role="status"
        aria-live="polite"
      >
        <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-accent" />
        <span className="text-[13px] font-semibold text-success">
          Your page now uses the {templateName} template.
        </span>
        <a
          href={`/${username}`}
          className={
            'inline-flex items-center gap-1 text-[13px] font-semibold text-success underline ' +
            'underline-offset-2 outline-none focus-visible:outline-2 ' +
            'focus-visible:outline-offset-2 focus-visible:outline-ring'
          }
        >
          View live
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {/* Back to templates — full nav to the disable route (clears Draft Mode +
            candidate cookie, returns to the dashboard gallery). Plain <a>, no prefetch. */}
        <a
          href={DISABLE_HREF}
          className={
            'inline-flex items-center justify-center rounded-md border border-border ' +
            'bg-transparent px-3 py-1.5 text-sm font-semibold text-foreground outline-none ' +
            'transition-colors hover:bg-surface focus-visible:outline-2 ' +
            'focus-visible:outline-offset-2 focus-visible:outline-ring'
          }
        >
          Back to templates
        </a>

        {candidateIsCurrent ? (
          // The candidate is ALREADY current → a no-op "Keep this template" dismiss
          // (ghost). Keeping the current template needs no write — just exit to the
          // gallery (the disable route). (UI-SPEC B.5 #3.)
          <a
            href={DISABLE_HREF}
            aria-label={`Keep the ${currentName ?? templateName} template`}
            className={
              'inline-flex items-center justify-center rounded-md border border-border ' +
              'bg-transparent px-3 py-1.5 text-sm font-semibold text-foreground outline-none ' +
              'transition-colors hover:bg-surface focus-visible:outline-2 ' +
              'focus-visible:outline-offset-2 focus-visible:outline-ring'
            }
          >
            Keep this template
          </a>
        ) : (
          // Use this template — the BRAND-fill confirm. NEVER disabled by the
          // mismatch (warn-but-allow — D-P7-11); disabled ONLY while committing.
          <button
            type="button"
            onClick={commit}
            disabled={isPending}
            aria-busy={isPending}
            className={
              'inline-flex items-center justify-center gap-1.5 rounded-md bg-brand px-3 py-1.5 ' +
              'text-sm font-semibold text-brand-foreground outline-none transition-colors ' +
              'hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 ' +
              'focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-70 ' +
              'motion-reduce:transition-none'
            }
          >
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                Switching…
              </>
            ) : (
              'Use this template'
            )}
          </button>
        )}
      </div>

      {/* ── ERROR — the destructive switch-error Alert with retry (nothing changed). ── */}
      {outcome === 'error' ? (
        <p
          role="alert"
          className={
            'rounded-md bg-destructive-bg px-3 py-1.5 text-[13px] font-semibold text-destructive'
          }
        >
          We couldn&apos;t switch your template. Please try again.
        </p>
      ) : null}
    </div>
  );
}
