/**
 * Projects section (D-P7-10 section 4) — the Newsprint card grid (07-UI-SPEC A.7 §4 /
 * D-P7-10). Mirrors `minimal/sections/projects.tsx`'s FROZEN `SectionProps` contract +
 * `present()` + content cast + null-guard + hide-if-empty + `safeHref`/`isHttpImageSrc`
 * guards; the visual body is the editorial card grid. `index.tsx` wraps this in
 * `<ScrollReveal as="section">`, so this renders the section's INNER content.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ CARDS ONLY — the optional deep-link detail modal (TMPL-06) is MINIMAL-ONLY    │
 * │ this phase (07-UI-SPEC A.7 §4). Newsprint ships a pure card grid with NO       │
 * │ modal, consistent with the "one new template, full coverage" boundary. This   │
 * │ is INTENTIONAL and NOT a coverage gap — `projects` is fully rendered; only     │
 * │ the optional deep-link detail view is deferred (a Newsprint detail view is a   │
 * │ fast-follow). Therefore this section stays a pure SERVER COMPONENT (no         │
 * │ `'use client'`, no `useSearchParams`, no query-param deep-link read), so       │
 * │ `/[username]` stays `● (SSG)`/ISR (D-22). Do NOT import the minimal modal      │
 * │ island here.                                                                   │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * RENDER CONTRACT (A.7 §4): a responsive CARD GRID (1 col mobile → 2–3 cols desktop)
 * with consistent Swiss gutters. Each card: an optional fixed-aspect WebP (≤1600px) in
 * a 16:9 aspect-ratio box (render only when `image` present + `image_alt` required, no
 * CLS); the title (Space Grotesk 600); the description (Body); mono tech tags
 * (`--surface-muted` fill, near-square); "View ↗" (`live_url`) / "Code ↗" (`repo_url`)
 * links (render-only-if-present, ink + vermilion underline-shift on hover via the
 * `.tmpl-project-link` class). Cards lift on hover (border-strong + soft neutral
 * shadow + translateY(-2px), NO glow — the `.tmpl-project-card` class).
 *
 * COLOR: no hardcoded hex — every UI value reads a scoped `var(--token)` from
 * theme.css. Outbound links open in a new tab with a safe `rel` (noopener noreferrer —
 * tab-nabbing hygiene). React escapes all seeded text by default (T-07-07).
 */
import Image from 'next/image';
import type { SectionProps } from './types';
import type { ProjectsContent, ProjectItem } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { isHttpImageSrc } from '@/lib/safe-image';

/** A string field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Mono kicker label — uppercase JetBrains Mono. */
const kickerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  fontWeight: 500,
  lineHeight: 1.4,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: 'var(--muted-fg)',
  margin: 0,
};

/** A single project card — image, title, description, tech tags, View/Code links. */
function ProjectCard({ item }: { item: ProjectItem }) {
  const title = present(item.title) ? item.title : null;
  if (!title) return null;

  const description = present(item.description) ? item.description : null;
  // Image renders only if a SAFE http(s) URL is present AND its required alt is
  // present. WR-05: `unoptimized` skips Next's host allowlist, so scheme-check here.
  const imageUrl = isHttpImageSrc(item.image) ? item.image : null;
  const imageAlt = present(item.image_alt) ? item.image_alt : null;
  const showImage = Boolean(imageUrl && imageAlt);

  const tech = Array.isArray(item.tech_stack)
    ? item.tech_stack.filter((t) => present(t))
    : [];

  // Links — render-only-if-present (D-10). CR-01: dropped unless a safe http(s) href.
  const liveUrl = safeHref(item.live_url) ?? null;
  const repoUrl = safeHref(item.repo_url) ?? null;

  return (
    <article
      className="tmpl-project-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '24px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {showImage ? (
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--surface-muted)',
          }}
        >
          <Image
            src={imageUrl as string}
            alt={imageAlt as string}
            width={1600}
            height={900}
            // Remote images on arbitrary hosts → skip the optimizer; the fixed
            // aspect-ratio box reserves space → no CLS.
            unoptimized
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      ) : null}

      {/* Title — Space Grotesk 600 (the structural heading face, A.7 §4). */}
      <h3
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: '1.25rem',
          lineHeight: 1.2,
          color: 'var(--fg)',
          margin: 0,
        }}
      >
        {title}
      </h3>

      {/* Description — Body. */}
      {description ? (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: 1.6,
            color: 'var(--muted-fg)',
            margin: 0,
            whiteSpace: 'pre-line',
          }}
        >
          {description}
        </p>
      ) : null}

      {/* Mono tech tags — near-square, --surface-muted fill. */}
      {tech.length > 0 ? (
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
          {tech.map((t, ti) => (
            <li
              key={`${t}-${ti}`}
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                lineHeight: 1.4,
                background: 'var(--surface-muted)',
                color: 'var(--muted-fg)',
                border: '1px solid var(--border)',
              }}
            >
              {t}
            </li>
          ))}
        </ul>
      ) : null}

      {/* View / Code links — render-only-if-present, ink + vermilion underline-shift. */}
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
          {liveUrl ? (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tmpl-project-link"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: '44px',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
              }}
            >
              View ↗
            </a>
          ) : null}
          {repoUrl ? (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tmpl-project-link"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: '44px',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
              }}
            >
              Code ↗
            </a>
          ) : null}
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
      className="tmpl-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        paddingBlock: 'clamp(64px, 12vh, 120px)',
      }}
    >
      {/* Mono kicker `04 — WORK` above an ink rule. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={kickerStyle}>04 — Work</p>
        <div
          aria-hidden="true"
          style={{ height: '1px', width: '100%', background: 'var(--fg)' }}
        />
      </div>

      {/* Section heading (Fraunces, ink — not the accent). */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(1.5rem, 3vw, 2rem)',
          lineHeight: 1.15,
          color: 'var(--fg)',
          margin: 0,
        }}
      >
        {heading}
      </h2>

      {/* Responsive CARD GRID (cards only — no modal). auto-fill reflows from 1 col
          (mobile) to 2–3 cols (desktop) with no media query. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '32px',
        }}
      >
        {items.map((item, i) => (
          <ProjectCard key={present(item.id) ? item.id : `${item.title}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
