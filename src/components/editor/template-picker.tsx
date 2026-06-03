'use client';

/**
 * TemplatePicker / TemplatePickerGallery (07-05 / UI-SPEC B.5 #1) — the template
 * gallery surfaced in the dashboard editor's "Template" rail entry.
 *
 * It lists every switchable template as an EQUAL option (D-P7-14) — one `TemplateCard`
 * per registry template (`minimal` + `editorial` in v1) — and marks whichever the
 * portfolio currently uses with the copper "● Current" tag. Selecting a card opens the
 * preview-before-commit flow (the card navigates to the Draft-Mode enable route).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ `minimal` is a NORMAL equal peer — NO "Founder"/"exclusive" badge, no hiding │
 * │ (D-P7-14). The ONLY differentiated state is the "● Current" marker.          │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * TWO-LAYER ISOLATION (D-17 / SHARED-5): PLATFORM CHROME — Evergreen & Copper
 * `--color-*` tokens + `--font-sans` (Inter) ONLY; NO template token / `.tmpl-*` class.
 */
import { listTemplates } from '@/components/templates/registry';

import { TemplateCard } from './template-card';

export interface TemplatePickerProps {
  /** The portfolio's CURRENT template slug — the card marked "● Current". */
  currentSlug: string;
  /** When true, render the loading skeleton instead of the cards. */
  loading?: boolean;
}

export function TemplatePicker({ currentSlug, loading = false }: TemplatePickerProps) {
  const templates = listTemplates();

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
        // One card per template; both equal peers (D-P7-14); current marked.
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {templates.map(({ slug, meta }) => (
            <li key={slug} className="flex">
              <TemplateCard
                slug={slug}
                name={meta.name}
                description={meta.description}
                thumbnailAlt={meta.thumbnailAlt}
                isCurrent={slug === currentSlug}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
