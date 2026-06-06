/**
 * Projects section (edgerunner section 5) — the synthwave "selected work" grid
 * (translated from `synthwave-founder/src/components/sections/Projects.tsx`). The SHARED
 * `SectionProps` signature + the `index.tsx` wiring are UNCHANGED. `index.tsx` wraps
 * this in `<ScrollReveal as="section">`, so this renders the INNER content.
 *
 * RENDER CONTRACT: mono `05 / work` kicker + the heading, then the card grid + the
 * deep-link modal it opens — both live in the `'use client'` `<ProjectsWithModal>`
 * island (REUSED from `@/components/public/project-modal`, the focus-trapped,
 * deep-linkable, WCAG-4.1.2-correct modal). This section root STAYS a pure Server
 * Component: it reads `section.content.items` under the FROZEN `SectionProps`
 * (no `searchParams` server-side → `/[username]` stays SSG/ISR, D-18/D-22) and passes
 * the validated items into the island.
 *
 * A4 RESOLVED (the export's `longDescription`): the modal reads `item.description`
 * (`project-modal.tsx`, full untruncated); `projectItemSchema` has NO `longDescription`
 * field — so edgerunner reuses `description` as-is. No schema add, no modal change.
 *
 * COLOR: every UI value reads a scoped `var(--token)` from theme.css (the island
 * styles via the `.tmpl-project-card` / `.tmpl-project-link` / `.tmpl-modal-*` classes
 * theme.css defines for edgerunner). React escapes all seeded text by default.
 */
import type { SectionProps } from './types';
import type { ProjectsContent } from '@/lib/validations';
import { ProjectsWithModal } from '@/components/public/project-modal';
import { present } from './shared';

export function Projects({ section }: SectionProps) {
  const content = (section?.content ?? null) as ProjectsContent | null;
  if (!content) return null;

  // hide-if-empty: only items with a title survive; no items → hide the section.
  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.title))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Selected work';

  return (
    <div
      className="tmpl-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        paddingBlock: 'clamp(64px, 12vh, 120px)',
      }}
    >
      {/* Mono section label `05 / work` (neon-cyan CRT label). */}
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '18px',
          fontWeight: 400,
          lineHeight: 1.2,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: 'var(--neon-cyan)',
          margin: 0,
        }}
      >
        05 / work
      </p>

      {/* Section heading (Orbitron display, foreground — not gradient). */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(1.75rem, 4vw, 2rem)',
          lineHeight: 1.2,
          color: 'var(--fg)',
          margin: 0,
        }}
      >
        {heading}
      </h2>

      {/* The card grid + the deep-link modal it opens live in the client island. The
          server passes the validated items; the island is the sole 'use client'
          boundary (no server-side searchParams read → /[username] stays SSG). */}
      <ProjectsWithModal items={items} />
    </div>
  );
}
