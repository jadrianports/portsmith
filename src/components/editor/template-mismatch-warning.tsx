'use client';

/**
 * TemplateMismatchWarning (07-05 / UI-SPEC B.5 #5 / TMPL-02 success criterion 3) —
 * the warn-but-allow confirm-step panel.
 *
 * The forward-looking safety net for the template switch: given the candidate
 * template's spec + the user's FILLED + VISIBLE section types, it lists any section
 * the candidate cannot render, so the user is never surprised that a section
 * "disappeared" after switching. It ALWAYS reassures that nothing is lost (the
 * TMPL-02 lossless guarantee — the rows stay in the DB, just unrendered, and
 * switching back restores them).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ LOAD-BEARING: WARN-BUT-ALLOW (D-P7-11/12).                                    │
 * │ This panel NEVER disables or gates the "Use this template" confirm. It is a   │
 * │ caution, not a blocker. It renders ONLY inside the confirm step (no           │
 * │ persistent editor badge — D-P7-12). In v1 it renders NOTHING: both shipped    │
 * │ templates cover all 7 CMS-produced types (D-P7-05), so                        │
 * │ `unsupportedFilledSections` returns [] for every real switch — but it is      │
 * │ fully wired so a future unsupported-section template fires it.                │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * TWO-LAYER ISOLATION (D-17 / SHARED-5): this is PLATFORM CHROME. It binds ONLY to
 * Evergreen & Copper `--color-*` chrome tokens + `--font-sans` (Inter) and imports NO
 * template token / no `.tmpl-*` class. The `--color-warning` tint mirrors the
 * PreviewBanner's caution treatment.
 */
import { TriangleAlert } from 'lucide-react';

import { unsupportedFilledSections } from '@/lib/templates/mismatch';
// Import from the zod-free metadata module, NOT '@/components/templates/registry':
// this is a CLIENT island reachable from the public /[username] route (via the
// draft-mode PreviewBanner), and any registry import drags zod onto the public First
// Load JS (D-25 budget — see template-meta.ts).
import { resolveTemplateMeta } from '@/components/templates/template-meta';
import type { TemplateSpec } from '@/components/templates/minimal/spec';

/** Human-readable labels for the known CMS section types (the rows the panel lists). */
const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero',
  about: 'About',
  skills: 'Skills',
  projects: 'Projects',
  experience: 'Experience',
  testimonials: 'Testimonials',
  contact: 'Contact',
  blog_preview: 'Blog',
};

/** A type → display label, falling back to the raw type for an unknown one. */
function labelForType(type: string): string {
  return SECTION_LABELS[type] ?? type;
}

export interface TemplateMismatchWarningProps {
  /** The candidate template slug (drives the "{Template}" name in the copy). */
  candidateSlug: string;
  /** The candidate template's spec — drives `unsupportedFilledSections`. */
  candidateSpec: TemplateSpec;
  /** The owner's FILLED + VISIBLE section types (from `filledVisibleSectionTypes`). */
  filledVisibleTypes: string[];
}

/**
 * Render the warn-but-allow mismatch panel, or `null` when the candidate covers every
 * filled-visible section (the v1 default — both templates support all produced types).
 * NEVER disables the confirm; the consumer (PreviewBanner) keeps "Use this template"
 * enabled regardless (D-P7-11).
 */
export function TemplateMismatchWarning({
  candidateSlug,
  candidateSpec,
  filledVisibleTypes,
}: TemplateMismatchWarningProps) {
  // The spec-aware predicate (NEVER hardcoded minimalSpec — D-P7-11). Returns [] in v1.
  const unsupported = unsupportedFilledSections(filledVisibleTypes, candidateSpec);
  if (unsupported.length === 0) return null; // lossless switch → silent (v1 default).

  const templateName = resolveTemplateMeta(candidateSlug).name;

  return (
    <div
      // role="status" (not "alert"): this is an informational caution surfaced WITH
      // the confirm, not an error interrupting the flow. Chrome font set explicitly so
      // it never inherits a template's display face.
      role="status"
      aria-live="polite"
      style={{ fontFamily: 'var(--font-sans)' }}
      className={
        'font-sans rounded-md border border-warning/40 bg-surface-muted p-3 text-foreground'
      }
    >
      <div className="flex items-start gap-2">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            Some sections won&apos;t show on this template
          </p>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            The {templateName} template doesn&apos;t have a place for the section
            {unsupported.length > 1 ? 's' : ''} below. They&apos;ll be hidden on your
            page — but your content is saved, and switching back will bring it back.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {unsupported.map((type) => (
              <li
                key={type}
                className={
                  'inline-flex items-center rounded-sm border border-border bg-surface ' +
                  'px-2 py-0.5 text-[13px] font-semibold text-foreground'
                }
              >
                {labelForType(type)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
