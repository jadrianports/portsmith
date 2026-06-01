'use client';

/**
 * PreviewBanner (04-UI-SPEC §11 / TMPL-05 / D-P4-09) — the ONE chrome element that
 * is ever overlaid on a portfolio-TEMPLATE surface.
 *
 * It sits atop the `minimal` template inside Draft Mode and tells the owner, in no
 * uncertain terms, that they are looking at a private draft only they can see, with
 * a one-click way out.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ LOAD-BEARING ISOLATION (two-layer identity / UI-SPEC §11):                    │
 * │ The banner overlays a template that owns its OWN scoped theme (Clash Display, │
 * │ Midnight-Outrun colors). To stop it from inheriting that theme, it EXPLICITLY │
 * │ sets the chrome font (`--font-sans`, Inter) and uses ONLY chrome tokens       │
 * │ (`--color-surface-muted`, `--color-warning`, `--color-foreground`,            │
 * │ `--color-border`) — NEVER a template token, NEVER an inline hex. This is the  │
 * │ only place a chrome component may visually sit on a template surface, so the  │
 * │ scoping is mandatory, not cosmetic.                                           │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Exit: a plain `<a href="/api/preview/disable">` (a full navigation to the
 * Route Handler that clears the draft cookie), NOT `next/link` — prefetch can
 * race/delete the `__prerender_bypass` cookie (RESEARCH Pattern 2 caveat).
 *
 * Reduced-motion: the entry slide is suppressed under `prefers-reduced-motion`.
 */
import { CircleAlert } from 'lucide-react';

export interface PreviewBannerProps {
  /** The owner's slug — shown so the banner is unambiguous about WHICH page. */
  username: string;
  /** When false, append the "not public yet" caption (the draft is unpublished). */
  published: boolean;
}

export function PreviewBanner({ username, published }: PreviewBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      // Chrome font is set explicitly so the banner cannot inherit the template's
      // display face. `font-sans` maps to the chrome `--font-sans` (Inter) token.
      style={{ fontFamily: 'var(--font-sans)' }}
      className={
        'preview-banner-enter font-sans fixed inset-x-0 top-0 z-50 flex items-center ' +
        'justify-between gap-3 border-b border-border bg-surface-muted px-4 py-2.5 text-warning'
      }
    >
      <div className="flex min-w-0 items-center gap-2">
        <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            Draft preview — only you can see this
          </p>
          {!published ? (
            <p className="truncate text-[13px] text-muted-foreground">
              This page is not public yet.
            </p>
          ) : null}
        </div>
        <span className="sr-only">Previewing /{username}</span>
      </div>

      {/* Full navigation (not next/link) to the disable Route Handler — clears the
          draft cookie and returns to the dashboard. Ghost-button styling, chrome
          tokens only. */}
      <a
        href="/api/preview/disable"
        className={
          'inline-flex shrink-0 items-center justify-center rounded-md border border-border ' +
          'bg-transparent px-3 py-1.5 text-sm font-semibold text-foreground outline-none ' +
          'transition-colors hover:bg-surface focus-visible:outline-2 ' +
          'focus-visible:outline-offset-2 focus-visible:outline-ring'
        }
      >
        Exit preview
      </a>
    </div>
  );
}
