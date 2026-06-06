'use client';

/**
 * TemplatePicker / TemplatePickerGallery (07-05 / UI-SPEC B.5 #1) — the template
 * gallery surfaced in the dashboard editor's "Template" rail entry.
 *
 * It renders ONE `TemplateCard` per ALLOWED template (12-04 / GATE-02) — the data-layer
 * allowed-list (`public ∪ granted-to-me`) the dashboard RSC resolves via
 * `getAvailableTemplates()` and threads in as the `allowed` prop. It marks whichever
 * the portfolio currently uses with the copper "● Current" tag, and a granted-restricted
 * template carries the copper "Exclusive" marker (D-P12-09). Selecting a card opens the
 * preview-before-commit flow (the card navigates to the Draft-Mode enable route).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ GATE-02 (D-P12-14): ONLY allowed templates are shown — NO locked/upsell      │
 * │ cards for templates the caller may not use. The narrowing is a UX nicety;    │
 * │ the SOLE authority is the 12-03 write-time grant gate in switchTemplateAction │
 * │ (a forged switch to a non-offered restricted template is rejected            │
 * │ server-side regardless of what this picker renders).                          │
 * │ "Exclusive" (D-P12-09, supersedes D-P7-14) rides the `restricted` flag from   │
 * │ the allowed-list — RUNTIME data, never static meta.                           │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * TWO-LAYER ISOLATION (D-17 / SHARED-5): PLATFORM CHROME — Evergreen & Copper
 * `--color-*` tokens + `--font-sans` (Inter) ONLY; NO template token / `.tmpl-*` class.
 */
// Import display copy from the zod-free metadata module, NOT
// '@/components/templates/registry' (a registry import drags zod into this client
// chunk — see template-meta.ts / D-25). The `allowed` slugs + `restricted` flags are
// PLAIN serializable props from the server (no zod), so nothing here needs the registry.
import { resolveTemplateMeta } from '@/components/templates/template-meta';

import { TemplateCard } from './template-card';

export interface TemplatePickerProps {
  /** The portfolio's CURRENT template slug — the card marked "● Current". */
  currentSlug: string;
  /**
   * 12-04 / GATE-02 — the data-layer allowed-list (`public ∪ granted-to-me`), resolved
   * by the dashboard RSC. One card is rendered per allowed slug; `restricted` drives the
   * "Exclusive" marker (D-P12-09). PLAIN serializable data — no zod, no registry import.
   */
  allowed: { slug: string; restricted: boolean }[];
  /** When true, render the loading skeleton instead of the cards. */
  loading?: boolean;
}

export function TemplatePicker({ currentSlug, allowed, loading = false }: TemplatePickerProps) {

  return (
    <section
      style={{ fontFamily: 'var(--font-sans)' }}
      className="font-sans flex flex-col gap-4 text-foreground"
      aria-label="Choose a template"
    >
      <div className="flex flex-col gap-1">
        {/* Display heading + the reassuring Body subline (UI-SPEC B.8). */}
        <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          Choose a template
        </h2>
        <p className="text-base text-muted-foreground">
          Switch any time — your content stays the same.
        </p>
      </div>

      {loading ? (
        // Loading skeleton: surface-muted shimmer cards (motion-reduce → static).
        // Matches the card grid so the layout does not shift when cards load.
        <ul
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
          aria-hidden="true"
        >
          {[0, 1].map((i) => (
            <li
              key={i}
              className="flex flex-col overflow-hidden rounded-md border border-border bg-surface"
            >
              <span className="block aspect-[16/10] w-full animate-pulse bg-surface-muted motion-reduce:animate-none" />
              <span className="flex flex-col gap-2 p-3">
                <span className="h-4 w-24 animate-pulse rounded-sm bg-surface-muted motion-reduce:animate-none" />
                <span className="h-3 w-40 animate-pulse rounded-sm bg-surface-muted motion-reduce:animate-none" />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        // The gallery: 1 col mobile → 2 cols tablet → 2–3 cols desktop, md/lg gutters.
        // ONE card per ALLOWED slug (GATE-02 — no locked/upsell cards); current marked;
        // granted-restricted carries the "Exclusive" marker (D-P12-09). Display copy is
        // looked up from the zod-free `resolveTemplateMeta` (never registry.ts / D-25).
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {allowed.map(({ slug, restricted }) => {
            const meta = resolveTemplateMeta(slug);
            return (
              <li key={slug} className="flex">
                <TemplateCard
                  slug={slug}
                  name={meta.name}
                  description={meta.description}
                  thumbnailAlt={meta.thumbnailAlt}
                  isCurrent={slug === currentSlug}
                  restricted={restricted}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
