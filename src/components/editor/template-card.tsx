'use client';

/**
 * TemplateCard (07-05 / UI-SPEC B.5 #2) — one focusable template option in the
 * switcher gallery. The whole card is a single control that opens the
 * preview-before-commit flow for its template (it navigates to the Draft-Mode enable
 * route with a vetted candidate slug; the page renders the owner's OWN content
 * through that candidate, D-P7-08).
 *
 * Anatomy (top → bottom): a STATIC thumbnail in a fixed 16:10 box (zero CLS) · the
 * template name (Label 14/600) · a short muted description · the action affordance
 * (the whole card is the control).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ LOAD-BEARING — the draft-cookie race (T-07-16 / the 04-07 caveat):           │
 * │ the card link is `prefetch={false}`. next/link prefetch can race/delete the  │
 * │ `__prerender_bypass` draft cookie the enable route sets; prefetching the     │
 * │ enable route would also fire its Set-Cookie speculatively. MANDATORY.        │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * TWO-LAYER ISOLATION (D-17 / SHARED-5): PLATFORM CHROME — Evergreen & Copper
 * `--color-*` tokens + `--font-sans` (Inter) ONLY; NO template token, NO `.tmpl-*`
 * class, NO inline hex. The thumbnail is a static same-origin `public/` image, not a
 * live template-token surface. Accent (copper) is used ONLY for the "● Current" tag +
 * its `circle-check` glyph (the inherited reserved-for list); the candidate-selected
 * cue uses BRAND (mirrors the section-row active marker), never a button fill.
 *
 * `minimal` is a NORMAL equal option — NO "Founder"/"exclusive" label (D-P7-14).
 */
import Link from 'next/link';
import Image from 'next/image';
import { CircleCheck } from 'lucide-react';

export interface TemplateCardProps {
  /** The template slug (drives the enable-route candidate + the thumbnail path). */
  slug: string;
  /** The display name (Label) — e.g. "Minimal", "Editorial". */
  name: string;
  /** A short, plain-language description (Caption/Body, muted). */
  description: string;
  /** The REQUIRED descriptive thumbnail alt (D-P7-07 — never empty). */
  thumbnailAlt: string;
  /** Whether this template is the portfolio's CURRENT one (→ the "● Current" mark). */
  isCurrent: boolean;
  /**
   * 12-04 / D-P12-09 — whether this is a GRANTED restricted template (→ the copper
   * "Exclusive" marker). RUNTIME data from the allowed-list, never static meta. The
   * marker render lands with this prop's consumer; defaults to `false` (public).
   */
  restricted?: boolean;
}

export function TemplateCard({
  slug,
  name,
  description,
  thumbnailAlt,
  isCurrent,
}: TemplateCardProps) {
  // The a11y label per UI-SPEC B.5 #2: the Current card invites a re-preview; the
  // others invite a preview. Color-independent (the word "current" carries the state).
  const ariaLabel = isCurrent
    ? `${name} — your current template — preview again`
    : `Preview the ${name} template with your content`;

  return (
    <Link
      // The preview-before-commit entry: the enable route vets `?template=<slug>`,
      // sets the candidate cookie, enables Draft Mode, and redirects to the owner's
      // own slug (the page renders THIS template with the owner's content).
      // prefetch={false} is MANDATORY — the draft-cookie race (T-07-16).
      href={`/api/preview/enable?template=${slug}`}
      prefetch={false}
      aria-label={ariaLabel}
      style={{ fontFamily: 'var(--font-sans)' }}
      className={
        'group font-sans relative flex flex-col overflow-hidden rounded-md border ' +
        'border-border bg-surface text-left shadow-card outline-none transition ' +
        'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0'
      }
    >
      {/* THUMBNAIL — a fixed 16:10 box reserves space so there is ZERO CLS while the
          static WebP loads. next/image carries explicit width/height (1280×800 source
          aspect). A 1px border on a muted box keeps a light-edged screenshot reading
          as a framed card. loading="lazy" — it is below the dashboard fold. */}
      <span className="relative block aspect-[16/10] w-full overflow-hidden border-b border-border bg-surface-muted">
        <Image
          src={`/templates/${slug}.webp`}
          alt={thumbnailAlt}
          width={1280}
          height={800}
          loading="lazy"
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          className="h-full w-full object-cover"
        />
      </span>

      {/* META — name + description + (when current) the copper "● Current" tag. */}
      <span className="flex flex-1 flex-col gap-1 p-3">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{name}</span>
          {isCurrent ? (
            // The CURRENT marker: copper dot + word + circle-check glyph — the
            // inherited accent reserved-for "current/selected state" use. Word +
            // glyph make it color-independent. The card is NOT disabled (re-previewable).
            <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent">
              <CircleCheck aria-hidden="true" className="size-4" />
              <span>
                <span aria-hidden="true">● </span>Current
              </span>
            </span>
          ) : null}
        </span>
        <span className="text-[13px] leading-snug text-muted-foreground">{description}</span>
      </span>

      {/* CANDIDATE-SELECTED cue: a brand left-bar appears on hover/focus as the
          preview is about to spin up (mirrors ProfileRailEntry's bg-brand marker).
          Brand = the identity-weight selection cue; NEVER the accent (reserved). */}
      <span
        aria-hidden="true"
        className={
          'pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-l-md bg-brand ' +
          'opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ' +
          'motion-reduce:transition-none'
        }
      />
    </Link>
  );
}
