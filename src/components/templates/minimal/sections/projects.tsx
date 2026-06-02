/**
 * Projects section (D-05 section 4) — UI-SPEC §"4. Projects". The SHARED
 * `SectionProps` signature, the export name, and the `index.tsx` wiring are
 * UNCHANGED (frozen 03-04 contract — `index.tsx` is NOT edited, no new prop).
 * `index.tsx` already wraps this in `<ScrollReveal as="section">`, so this renders
 * the section's INNER content (no `<section>` of its own).
 *
 * RENDER CONTRACT (UI-SPEC §4 / D-10):
 *   - mono `04 / work` label + the heading.
 *   - a responsive CARD GRID (1 col mobile → 2–3 cols desktop) over
 *     `ProjectsContent.items`. Each card:
 *       · a WebP image (≤1600px) in a FIXED aspect-ratio box (render only when
 *         `image` present, with its REQUIRED `image_alt`), via `next/image` with
 *         explicit width/height so it reserves space and never shifts layout (CLS).
 *       · the title (Clash Display heading scale).
 *       · the description (Body 16/1.6).
 *       · tech-stack chips (mono, `--surface-muted` fill) from `tech_stack`.
 *       · the links "Visit ↗" (`live_url`) + "Code ↗" (`repo_url`) — each rendered
 *         ONLY when present (D-10), with the lucide `ArrowUpRight` glyph and a cyan
 *         underline-glow on hover (the `.tmpl-project-link` class in theme.css).
 *   - cards glow-lift on hover (border + soft magenta glow, low alpha — the
 *     `.tmpl-project-card` class in theme.css). Never blinding.
 *
 * These are REAL working products, not demos (D-10).
 *
 * DEEP-LINK MODAL (TMPL-06 / 06-04): the card grid + the modal it opens now live in
 * the `'use client'` `<ProjectsWithModal>` island. This section root STAYS a pure
 * Server Component: it reads `section.content.items` under the FROZEN
 * `SectionProps = { section }` contract (no new prop, no `searchParams`) and passes
 * the server-read `items` into the island, which is the ONLY client boundary. The
 * island owns the open/close state, the `useSearchParams()` initial deep-link read,
 * and the `window.history.pushState` URL sync — the page NEVER reads `searchParams`
 * server-side, so `/[username]` stays `● (SSG)`/ISR (D-18/D-22; the
 * `tests/build/route-table-ssg.test.ts` assertion is the binding guard). The card
 * VISUALS are unchanged (the island reuses the exact 16:9 box, mono chips, and
 * Visit/Code links, with the same `safeHref`/`isHttpImageSrc` guards).
 *
 * COLOR: no hardcoded hex — every UI value reads a scoped `var(--token)` from
 * theme.css. Outbound links open in a new tab with a safe `rel` (noopener noreferrer
 * — tab-nabbing hygiene, threat T-03-20). React escapes all seeded text by default
 * (no `dangerouslySetInnerHTML` — T-03-19).
 */
import type { SectionProps } from './types';
import type { ProjectsContent } from '@/lib/validations';
import { ProjectsWithModal } from '@/components/public/project-modal';

/** A string field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function Projects({ section }: SectionProps) {
  // Cast the validated JSONB content; null-guard the row + every field.
  const content = (section?.content ?? null) as ProjectsContent | null;
  if (!content) return null;

  // hide-if-empty: only items with a title survive; no items → hide the section.
  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.title))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Projects';

  return (
    <div
      // `.tmpl-shell`: the shared centered max-width + horizontal gutter (theme.css).
      className="tmpl-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        paddingBlock: '64px',
      }}
    >
      {/* Mono section label `04 / work` (cyan, per the section precedent). */}
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 500,
          lineHeight: 1.4,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--accent-cyan)',
          margin: 0,
        }}
      >
        04 / work
      </p>

      {/* Section heading (Clash Display Heading scale, foreground — not gradient). */}
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

      {/* The card grid + the deep-link modal it opens live in the client island.
          The server passes the validated items; the island is the sole 'use client'
          boundary (no server-side searchParams read → /[username] stays SSG). */}
      <ProjectsWithModal items={items} />
    </div>
  );
}
