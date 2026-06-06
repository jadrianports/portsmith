/**
 * Projects section (aurora section 6) — the rosy card grid (translated from
 * `marketing-girl/src/components/Projects.tsx`). Mirrors the FROZEN `SectionProps`
 * contract + `present()` + content cast + null-guard + hide-if-empty +
 * `safeHref`/`isHttpImageSrc` guards EXACTLY. `index.tsx` wraps this in `<ScrollReveal
 * as="section">`, so this renders the INNER content.
 *
 * CARDS ONLY — the optional deep-link detail modal (TMPL-06) is minimal-only. Aurora
 * ships a pure card grid with NO modal, so this stays a pure SERVER COMPONENT (no
 * `'use client'`, no query-param deep-link read), keeping `/[username]` ● SSG/ISR (D-22).
 * The source's unsplash project images become null-guarded Storage-origin reads.
 *
 * Casts `section.content` to `ProjectsContent` (`{ heading, items: [{ title, description,
 * image?, image_alt?, tech_stack, live_url?, repo_url? }] }`).
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { ProjectsContent, ProjectItem } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { isHttpImageSrc } from '@/lib/safe-image';
import { hairlineStyle, headingStyle, kickerStyle, present, sectionShellStyle } from './shared';

/** A single project card — image, title, description, tech tags, View/Code links. */
function ProjectCard({ item }: { item: ProjectItem }) {
  const title = present(item.title) ? item.title : null;
  if (!title) return null;

  const description = present(item.description) ? item.description : null;
  const imageUrl = isHttpImageSrc(item.image) ? item.image : null;
  const imageAlt = present(item.image_alt) ? item.image_alt : null;
  const showImage = Boolean(imageUrl && imageAlt);

  const tech = Array.isArray(item.tech_stack) ? item.tech_stack.filter((t) => present(t)) : [];

  const liveUrl = safeHref(item.live_url) ?? null;
  const repoUrl = safeHref(item.repo_url) ?? null;

  return (
    <article
      className="tmpl-project-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: showImage ? '0 0 24px' : '24px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {showImage ? (
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 10',
            overflow: 'hidden',
            background: 'var(--surface-muted)',
          }}
        >
          <Image
            src={imageUrl as string}
            alt={imageAlt as string}
            width={1600}
            height={1000}
            unoptimized
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          padding: showImage ? '0 24px' : 0,
          flex: '1 1 auto',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: '1.25rem',
            lineHeight: 1.2,
            color: 'var(--fg)',
            margin: 0,
          }}
        >
          {title}
        </h3>

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
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  lineHeight: 1.4,
                  background: 'var(--surface-muted)',
                  color: 'var(--muted-fg)',
                }}
              >
                {t}
              </li>
            ))}
          </ul>
        ) : null}

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
                  letterSpacing: '0.1em',
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
                  letterSpacing: '0.1em',
                }}
              >
                Code ↗
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function Projects({ section }: SectionProps) {
  const content = (section?.content ?? null) as ProjectsContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.title))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Projects';

  return (
    <div className="tmpl-shell" style={sectionShellStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={kickerStyle}>Work</p>
        <div aria-hidden="true" style={hairlineStyle} />
      </div>

      <h2 style={headingStyle}>{heading}</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '28px',
        }}
      >
        {items.map((item, i) => (
          <ProjectCard key={present(item.id) ? item.id : `${item.title}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
