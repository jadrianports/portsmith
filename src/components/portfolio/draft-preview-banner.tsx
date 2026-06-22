/**
 * DraftPreviewBanner — the RECIPIENT banner on `/draft/[token]` (DIST-02 / D-04).
 *
 * The cookieless-recipient sibling of the owner `PreviewBanner` (editor/preview-banner.tsx):
 * it overlays the read-only draft render and tells the recipient, unambiguously, that
 * they are looking at a PRIVATE, UNPUBLISHED preview shared with them — NOT the live
 * page, and NOT something they can edit. The recipient owns nothing, so this banner has
 * NO Exit / Publish / Edit controls (every one of those is an owner-only affordance).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ LOAD-BEARING ISOLATION (two-layer identity / the owner banner's §11 / D-17):  │
 * │ The banner overlays a TEMPLATE that owns its OWN scoped theme. To stop it from │
 * │ inheriting that theme it EXPLICITLY sets the chrome font (`--font-sans`, Inter)│
 * │ via `style` and uses ONLY chrome tokens (`--color-*`) — NEVER a template token,│
 * │ NEVER an inline hex, NEVER a `templates/*` import. `z-[100]` MUST outrank the  │
 * │ whole template z-scale (templates pin nav/scroll chrome up to z-60); at equal  │
 * │ z-index the template (later in the DOM) would paint over the banner. This is   │
 * │ the same isolation discipline the owner PreviewBanner documents.              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * A pure server component (no `'use client'`, no state, no controls) — it renders one
 * static status strip and ships zero JS. Visually DISTINCT from the owner banner: the
 * owner's reads "Draft · only you can see this page" with a Publish/Exit cluster; this
 * one reads "Shared draft preview — this is a private, unpublished preview" with no
 * controls, so neither can be mistaken for the other.
 */
import { Eye } from 'lucide-react';

export function DraftPreviewBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      // Chrome font set explicitly so the banner cannot inherit the template's display
      // face (`font-sans` maps to the chrome `--font-sans` Inter token).
      style={{ fontFamily: 'var(--font-sans)' }}
      className={
        // z-[100]: the TOP chrome layer — must sit above any template's own fixed/sticky
        // chrome (templates pin navs up to z-60), or the template paints over it. The
        // opaque `bg-surface` panel + 3px brand top edge + `shadow-card` give it weight
        // so a recipient can never mistake a private draft for the live page. Mirrors the
        // owner PreviewBanner's chrome-isolation discipline (chrome tokens only).
        'fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 ' +
        'border-b border-t-[3px] border-border border-t-brand bg-surface px-4 py-3 ' +
        'text-foreground shadow-card'
      }
    >
      <Eye aria-hidden="true" className="size-5 shrink-0 text-brand" />
      <div className="min-w-0 text-center">
        <p className="truncate text-[15px] font-semibold leading-tight text-foreground">
          Shared draft preview — this is a private, unpublished preview
        </p>
        <p className="truncate text-[13px] text-muted-foreground">
          Shared with you by the owner · not published, not editable
        </p>
      </div>
    </div>
  );
}
