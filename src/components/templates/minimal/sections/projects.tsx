/**
 * Projects section (D-05 section 4) — UI-SPEC §"4. Projects". Replaces the 03-04
 * stub: the body is real, the SHARED `SectionProps` signature, the export name, and
 * the `index.tsx` wiring are UNCHANGED (frozen 03-04 contract — `index.tsx` is NOT
 * edited, no new prop). `index.tsx` already wraps this in `<ScrollReveal
 * as="section">`, so this renders the section's INNER content (no `<section>` of its
 * own).
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
 * CARDS ONLY — there is deliberately NO expand-on-click overlay, NO query-param
 * deep-link, and NO click-to-expand interaction here. The deep-link/overlay feature
 * (TMPL-06) is DEFERRED to Phase 6 (D-10), so this file ships zero such logic: it is
 * a pure Server Component with no client state and no overlay component. The cards
 * are self-contained with their own outbound links.
 *
 * COLOR: no hardcoded hex — every UI value reads a scoped `var(--token)` from
 * theme.css. Outbound links open in a new tab with a safe `rel` (noopener noreferrer
 * — tab-nabbing hygiene, threat T-03-20). React escapes all seeded text by default
 * (no `dangerouslySetInnerHTML` — T-03-19).
 */
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import type { SectionProps } from './types';
import type { ProjectsContent, ProjectItem } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { isHttpImageSrc } from '@/lib/safe-image';

/** A string field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** A single outbound project link ("Visit ↗" / "Code ↗") — cyan glow on hover. */
function ProjectLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="tmpl-project-link"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        minHeight: '44px',
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: 'var(--fg)',
        textDecoration: 'none',
      }}
    >
      {label}
      <ArrowUpRight size={14} aria-hidden="true" strokeWidth={2} />
    </a>
  );
}

/** A single project card. Cards only — no expand overlay/deep-link (TMPL-06 → P6). */
function ProjectCard({ item }: { item: ProjectItem }) {
  // WR-05: the <Image> src must be an http(s) URL — `unoptimized` skips Next's host
  // allowlist, so a `data:`/arbitrary-scheme src would otherwise be loaded directly.
  const imageUrl = isHttpImageSrc(item.image) ? item.image : null;
  const imageAlt = present(item.image_alt) ? item.image_alt : null;
  // Image renders ONLY when both a safe URL and its required alt are present (the
  // Zod alt-text refine guarantees alt when image is set; re-guard defensively).
  const showImage = Boolean(imageUrl && imageAlt);

  // CR-01: outbound links rendered ONLY when they are safe http(s) hrefs.
  const liveUrl = safeHref(item.live_url) ?? null;
  const repoUrl = safeHref(item.repo_url) ?? null;

  const techStack = Array.isArray(item.tech_stack)
    ? item.tech_stack.filter((t) => present(t))
    : [];

  return (
    <article
      className="tmpl-project-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        // Soft low-alpha drop shadow at rest (no neon at rest — UI-SPEC §Elevation).
        boxShadow: '0 8px 24px -16px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* WebP image in a FIXED aspect-ratio box — reserves space (no CLS). Rendered
          only when present, with its required alt. */}
      {showImage ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: 'var(--surface-muted)',
          }}
        >
          <Image
            src={imageUrl as string}
            alt={imageAlt as string}
            // Fill the fixed-aspect box; the box owns the reserved space → no CLS.
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            // Remote project images on arbitrary hosts → skip the Vercel optimizer
            // (no images.remotePatterns allowlist; client-WebP pipeline, CLAUDE.md).
            // The aspect-ratio box still reserves space, so this stays CLS-safe.
            unoptimized
            style={{ objectFit: 'cover' }}
          />
        </div>
      ) : null}

      {/* Title (Clash Display heading scale, foreground). */}
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: '1.25rem',
          lineHeight: 1.2,
          color: 'var(--fg)',
          margin: 0,
        }}
      >
        {item.title}
      </h3>

      {/* Description (Body 16/1.6). */}
      {present(item.description) ? (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: 1.6,
            color: 'var(--muted-fg)',
            margin: 0,
          }}
        >
          {item.description}
        </p>
      ) : null}

      {/* Tech-stack chips (mono, surface-muted fill). */}
      {techStack.length > 0 ? (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          {techStack.map((tech, ti) => (
            <li
              key={`${tech}-${ti}`}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                lineHeight: 1.4,
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-muted)',
                color: 'var(--muted-fg)',
                border: '1px solid var(--border)',
              }}
            >
              {tech}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Outbound links — "Visit ↗" (live_url) + "Code ↗" (repo_url), each gated on
          presence (D-10). The card is self-contained; no expand overlay/deep-link. */}
      {liveUrl || repoUrl ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            marginTop: 'auto',
            paddingTop: '8px',
          }}
        >
          {liveUrl ? <ProjectLink href={liveUrl} label="Visit ↗" /> : null}
          {repoUrl ? <ProjectLink href={repoUrl} label="Code ↗" /> : null}
        </div>
      ) : null}
    </article>
  );
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

      {/* Responsive card grid — auto-fill so it reflows from 1 col (mobile) up to
          2–3 cols (desktop) with no media-query gymnastics. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '24px',
        }}
      >
        {items.map((item, i) => (
          <ProjectCard key={present(item.id) ? item.id : `${item.title}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
