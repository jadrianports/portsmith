'use client';

/**
 * TemplateStep (18-04 Step 1 / UI-SPEC Surface 2 — D-11/D-12/D-13/D-18/D-19/GATE-02).
 *
 * The wizard's first step: the allowed-template gallery PLUS the inline live-preview
 * `<iframe>` of the REAL chosen template rendered with the user's current (seeded/edited)
 * content. The portfolio STAYS UNPUBLISHED throughout — the preview is a DRAFT render,
 * nothing public (D-12).
 *
 * THE GALLERY (D-13): one card per ALLOWED slug (public ∪ granted-to-me, the `allowed`
 * prop the RSC resolved via `getAvailableTemplates()`), the current slug pre-selected.
 * Display copy comes from the zod-free `resolveTemplateMeta` (NEVER `registry.ts` — D-25,
 * keeps zod off the bundle). A granted-restricted template carries the copper "Exclusive"
 * marker (runtime `restricted` flag, never static meta).
 *
 * WHY A WIZARD-LOCAL CARD GRID (not the shipped `TemplatePicker` verbatim): the shipped
 * `TemplateCard` is a `<Link>` that navigates the TOP WINDOW to `/api/preview/enable`
 * (preview-before-commit in the editor). Inside the wizard that would yank the user out
 * of `/onboarding` (RESEARCH Risk 1, PATTERNS § Step-1). The locked Surface-2 behavior is
 * the opposite: a card pick calls `switchTemplateAction` and RE-POINTS THE IFRAME, never
 * the top window. So this step renders its own cards (reusing the same `resolveTemplateMeta`
 * copy + the same chrome tokens) wired to that interaction.
 *
 * THE INLINE PREVIEW (D-11/D-19 — the lone two-layer exception): a same-origin
 * `<iframe src="/api/preview/enable?template={slug}" loading="lazy">`. The shipped enable
 * route enables draft mode, sets the candidate cookie, and 302s to `/{username}` INSIDE
 * the frame — landing on the real draft render. Re-pointing the `src` (keyed on the
 * selected slug) re-renders. The template paints inside the SEPARATE iframe document with
 * its own scoped `theme.css`/`.tmpl-*` tokens — frame-isolated, so chrome tokens cannot
 * bleed in and template tokens cannot bleed out (a stronger guarantee than the manual
 * banner scoping). We do NOT route the top window through the enable route.
 *
 * SWITCH (D-12 / GATE-02): a card pick calls the shipped `switchTemplateAction(slug)` —
 * the SOLE write-time grant authority (a forged switch to an ungranted restricted
 * template is rejected server-side). Content-lossless, so re-picking is free; the
 * portfolio stays `published = false`.
 *
 * MOBILE (D-18): the preview collapses behind a default-collapsed "Preview" toggle so the
 * gallery + Continue stay above the fold; the iframe is lazy-MOUNTED only when opened (so
 * the draft-render subrequest doesn't fire on a mobile-collapsed first paint) and carries
 * `loading="lazy"`.
 *
 * COOKIE CLEANUP (RESEARCH Risk 1, the one correctness hazard): leaving the picker fires
 * `GET /api/preview/disable` (cleanup effect on unmount) so the now-chosen-but-DRAFT state
 * doesn't leave a stale `__prerender_bypass` for the owner's own later anon visit. The
 * wizard's final disable also fires at the payoff (18-05); here it's belt-and-suspenders.
 *
 * TWO-LAYER IDENTITY (SHARED-E): every surface OUTSIDE the iframe consumes chrome tokens
 * ONLY (Evergreen/Copper, Inter); no template token, no inline hex. Every control is ≥44px
 * with the chrome focus ring; transitions are `motion-reduce:`-gated.
 */
import { CircleCheck, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { switchTemplateAction } from '@/lib/cms/switch-template-action';
import {
  groupAllowedByCategory,
  resolveTemplateMeta,
} from '@/components/templates/template-meta';
import type { AllowedTemplate } from '@/lib/templates/available-templates';

/** Copy (UI-SPEC Surface 2 + § Per-step coaching reassurance). */
const COPY = {
  galleryHeading: 'Templates',
  privacy: 'Only you can see this until you publish.',
  previewLabel: 'Preview',
  previewHeading: 'Live preview',
  hidePreview: 'Hide preview',
  current: 'Current',
  exclusive: 'Exclusive',
  switchError: 'We couldn’t switch your template. Please try again.',
} as const;

export interface TemplateStepProps {
  /** The owner's username — the preview iframe lands on `/{username}` (draft render). */
  username: string;
  /** The portfolio's CURRENT template slug — pre-selected (D-13) + the initial preview. */
  currentSlug: string;
  /** GATE-02 allowed-list (public ∪ granted) — PLAIN serializable, no zod/registry (D-25). */
  allowed: AllowedTemplate[];
}

export function TemplateStep({ username, currentSlug, allowed }: TemplateStepProps) {
  // The selected slug drives BOTH the gallery "● Current" mark AND the iframe src
  // (re-pointed on every pick). Initialized to the portfolio's current template (D-13).
  const [selectedSlug, setSelectedSlug] = useState(currentSlug);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mobile preview toggle (D-18) — default collapsed so the iframe subrequest doesn't
  // fire on a mobile first paint; lazy-mounted only when opened.
  const [previewOpen, setPreviewOpen] = useState(false);

  // The iframe src — the shipped enable route (draft mode + candidate cookie + 302 to
  // /{username} INSIDE the frame). `username` is unused in the URL (the route resolves
  // the owner server-side from claims.sub — open-redirect hardening), but is referenced
  // in the a11y label so the title names the rendered page.
  const previewSrc = `/api/preview/enable?template=${encodeURIComponent(selectedSlug)}`;
  const previewTitle = `Live preview of ${username}’s page on the ${resolveTemplateMeta(selectedSlug).name} template (only you can see this)`;

  /**
   * Cookie cleanup (RESEARCH Risk 1): on leaving the picker (unmount), fire
   * `GET /api/preview/disable` so the draft cookies don't survive for the owner's own
   * later anon visit. Same-origin GET; we ignore the redirect body. Belt-and-suspenders
   * over the payoff's final disable (18-05).
   */
  useEffect(() => {
    return () => {
      // keepalive lets the request survive the navigation away from the step.
      void fetch('/api/preview/disable', { method: 'GET', keepalive: true }).catch(
        () => {},
      );
    };
  }, []);

  /**
   * Pick a card → switch the template (GATE-02 sole authority) and re-point the preview.
   * Optimistic on the slug (so the gallery marker + iframe re-point immediately); reverts
   * to the prior slug on a server reject (an ungranted restricted target, or a write
   * failure) and surfaces the generic copy.
   */
  const onPick = useCallback(
    async (slug: string) => {
      if (slug === selectedSlug || switching) return;
      const previous = selectedSlug;
      setError(null);
      setSelectedSlug(slug); // optimistic — re-points the iframe immediately
      setSwitching(true);
      try {
        const result = await switchTemplateAction(slug);
        if (!result.ok) {
          setSelectedSlug(previous); // revert (GATE-02 reject / write failure)
          setError(result.error ?? COPY.switchError);
        }
      } catch {
        setSelectedSlug(previous);
        setError(COPY.switchError);
      } finally {
        setSwitching(false);
      }
    },
    [selectedSlug, switching],
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      {/* ── Region 1: the gallery (the control) ── */}
      <div className="flex flex-col gap-3 lg:w-1/2">
        {/* The wizard-local gallery, GROUPED by category (37-02 / TCAT-02, D-04 — mirror
            the dashboard picker's treatment over the local TemplateOption grid via the
            SAME shared helper). `groupAllowedByCategory` re-buckets ONLY the allowed set
            into curated order and DROPS empty categories, so no empty header renders
            (video stays hidden). All wizard state/interaction is unchanged. */}
        <div
          aria-label="Choose a template"
          role="group"
          className="flex flex-col gap-4"
        >
          {groupAllowedByCategory(allowed).map(({ key, label, items }) => (
            <div key={key} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </h3>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.map(({ slug, restricted }) => (
                  <li key={slug} className="flex">
                    <TemplateOption
                      slug={slug}
                      isSelected={slug === selectedSlug}
                      restricted={restricted}
                      disabled={switching}
                      onSelect={() => onPick(slug)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {error ? <Alert variant="error">{error}</Alert> : null}
      </div>

      {/* ── Region 2: the inline live preview (the payoff-preview, D-11) ── */}
      <div className="flex flex-col gap-2 lg:w-1/2">
        {/* Mobile (< lg): collapse the preview behind a default-collapsed toggle (D-18). */}
        <button
          type="button"
          onClick={() => setPreviewOpen((v) => !v)}
          aria-expanded={previewOpen}
          className={
            'inline-flex min-h-11 items-center justify-center rounded-md border border-border ' +
            'bg-surface px-4 text-sm font-semibold text-foreground outline-none transition-colors ' +
            'hover:bg-surface-muted motion-reduce:transition-none lg:hidden ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
          }
        >
          {previewOpen ? COPY.hidePreview : COPY.previewLabel}
        </button>

        {/* The framed preview. Lazy-mounted on mobile (only when opened); always mounted
            on desktop (≥ lg). The iframe is a separate document → two-layer isolation is
            free (the template paints with its own scoped theme.css inside the frame). */}
        <PreviewFrame
          src={previewSrc}
          title={previewTitle}
          switching={switching}
          // Re-mount the iframe whenever the slug changes so it re-runs enable + re-renders.
          frameKey={selectedSlug}
          mobileOpen={previewOpen}
        />

        <p className="text-[13px] leading-tight text-muted-foreground">{COPY.privacy}</p>
      </div>
    </div>
  );
}

/**
 * One template option in the wizard gallery — a real `<button>` (NOT the shipped
 * `<Link>` card, which navigates the top window). A pick calls `switchTemplateAction` via
 * `onSelect` and re-points the preview. The selected card carries a brand selection bar +
 * the copper "● Current" marker (color-independent: glyph + word, never color alone); a
 * granted-restricted template carries the copper "Exclusive" marker.
 */
function TemplateOption({
  slug,
  isSelected,
  restricted,
  disabled,
  onSelect,
}: {
  slug: string;
  isSelected: boolean;
  restricted: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const meta = resolveTemplateMeta(slug);
  const ariaLabel = isSelected
    ? `${meta.name} — your selected template`
    : `Choose the ${meta.name} template`;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isSelected}
      aria-label={ariaLabel}
      className={
        'group relative flex w-full flex-col gap-1 rounded-md border bg-surface p-3 text-left ' +
        'outline-none transition-colors motion-reduce:transition-none ' +
        'disabled:cursor-not-allowed disabled:opacity-70 ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
        (isSelected ? 'border-border-strong' : 'border-border hover:border-border-strong')
      }
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{meta.name}</span>
        <span className="inline-flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
          {restricted ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent">
              <Sparkles aria-hidden="true" className="size-4" />
              <span>{COPY.exclusive}</span>
            </span>
          ) : null}
          {isSelected ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent">
              <CircleCheck aria-hidden="true" className="size-4" />
              <span>
                <span aria-hidden="true">● </span>
                {COPY.current}
              </span>
            </span>
          ) : null}
        </span>
      </span>
      {meta.description ? (
        <span className="text-[13px] leading-snug text-muted-foreground">
          {meta.description}
        </span>
      ) : null}
      {/* Brand selection bar — the identity-weight selection cue (never the accent fill). */}
      <span
        aria-hidden="true"
        className={
          'pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-l-md bg-brand transition-opacity ' +
          'motion-reduce:transition-none ' +
          (isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100')
        }
      />
    </button>
  );
}

/**
 * The framed inline preview. A `rounded-md border border-border` bezel on
 * `--color-surface`; the iframe inside is the lone template-token surface (a separate
 * document — two-layer isolation is free). The iframe is LAZY-MOUNTED: it renders only
 * when the frame is actually visible — always on desktop (≥ lg, tracked via `matchMedia`)
 * and on mobile only when `mobileOpen` — so the draft-render subrequest never fires on a
 * mobile-collapsed first paint (D-18 / RESEARCH Risk 5). The `frameKey` forces a re-mount
 * on slug change so the enable route re-runs and the preview re-renders.
 */
function PreviewFrame({
  src,
  title,
  switching,
  frameKey,
  mobileOpen,
}: {
  src: string;
  title: string;
  switching: boolean;
  frameKey: string;
  mobileOpen: boolean;
}) {
  // Track the desktop breakpoint (≥ lg = 1024px) so the iframe auto-mounts on desktop
  // without the mobile "Preview" toggle, but stays unmounted on a collapsed mobile view.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const mounted = isDesktop || mobileOpen;

  return (
    <div
      className={
        'relative overflow-hidden rounded-md border border-border bg-surface ' +
        (mobileOpen ? 'block' : 'hidden') +
        ' lg:block'
      }
    >
      {/* A stable aspect box so the framed render reserves space (no CLS). */}
      <div className="aspect-[3/4] w-full sm:aspect-[4/3] lg:aspect-[3/4]">
        {mounted ? (
          <iframe
            key={frameKey}
            src={src}
            title={title}
            loading="lazy"
            className="h-full w-full border-0"
          />
        ) : null}
      </div>
      {/* A calm switching veil during the round-trip (color-independent: it's a dim, not
          a state the user must read). */}
      {switching ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-surface/40 transition-opacity motion-reduce:transition-none"
        />
      ) : null}
    </div>
  );
}
