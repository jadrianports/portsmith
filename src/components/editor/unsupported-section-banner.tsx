'use client';

/**
 * UnsupportedSectionBanner (13.1-06 / UI-SPEC §7 / D-14 / D-15) — the calm,
 * NON-BLOCKING banner shown at the top of the form panel when the owner edits a
 * section the ACTIVE template can't render.
 *
 * It is purely advisory: it NEVER blocks editing or save, has no dismiss, and
 * reflects live template state (it disappears on its own when the section becomes
 * supported after a switch). The data is LOSSLESS — the section row persists
 * untouched; only its public RENDER is gated by the template (the EDIT-ALL grain).
 *
 * Copy is LOCKED (D-15) and names ONLY the current template — NEVER a template
 * that WOULD render the section (that could leak a restricted/un-granted template
 * name + would drag specs onto the bundle). The current template name is resolved
 * via `resolveTemplateMeta` from the ZOD-FREE `template-meta.ts` (D-25) — NEVER
 * `registry.ts` (which evaluates `z.enum(...)` at module scope and would pull Zod
 * into this chunk). This mirrors the `template-mismatch-warning.tsx` import
 * discipline.
 *
 * Tone mirrors `template-mismatch-warning.tsx:90-93`: a `--color-warning`-tinted
 * band on `--color-surface-muted`, a `triangle-alert` glyph (aria-hidden), and
 * `role="status"` `aria-live="polite"` (informational — NOT `alert`, which would
 * interrupt). It is WARNING + muted (calm), never the copper accent (accent stays
 * scarce: focus rings only on these surfaces).
 *
 * TWO-LAYER ISOLATION (CLAUDE.md): PLATFORM CHROME only — `--color-*` chrome
 * tokens + `--font-sans` (Inter) set explicitly so it can never inherit a
 * template face. No `.tmpl-*` reach, no inline hex.
 */
import { TriangleAlert } from 'lucide-react';

// Import from the ZOD-FREE metadata module, NOT '@/components/templates/registry'
// (D-25 / D-15): the banner names only the CURRENT template; resolving via the
// meta module keeps Zod off this chunk and avoids ever surfacing a would-render
// template name. Same discipline as template-mismatch-warning.tsx.
import { resolveTemplateMeta } from '@/components/templates/template-meta';

export interface UnsupportedSectionBannerProps {
  /**
   * The active template's slug — drives the CURRENT template name via
   * `resolveTemplateMeta(activeSlug).name` (the ONLY template named, D-15).
   */
  activeSlug: string;
}

/**
 * The calm, non-blocking unsupported-section banner. Render it only when the
 * active section's type is unsupported on the active template (the shell decides
 * membership from its `templateSpec`); it stays out of the way otherwise.
 */
export function UnsupportedSectionBanner({ activeSlug }: UnsupportedSectionBannerProps) {
  // D-15: name ONLY the current template (zod-free) — never a would-render one.
  const templateName = resolveTemplateMeta(activeSlug).name;

  return (
    <div
      // role="status" (NOT "alert"): an informational heads-up surfaced WITH the
      // editable form, never an error that interrupts the flow. Chrome font set
      // explicitly so it never inherits a template's display face.
      role="status"
      aria-live="polite"
      style={{ fontFamily: 'var(--font-sans)' }}
      className="font-sans rounded-md border border-warning/40 bg-surface-muted p-3 text-foreground"
    >
      <div className="flex items-start gap-2">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="min-w-0 text-sm leading-snug">
          This won’t show on {templateName}.{' '}
          <span className="text-muted-foreground">
            It’s saved — it appears if you switch to a template that supports it.
          </span>
        </p>
      </div>
    </div>
  );
}
