/**
 * Projects section (atelier section 3) — the dark-editorial "Selected Work" wall, a
 * FAITHFUL clone of the export's `SelectedWork.tsx`: a header row ("02 — Selected Work"
 * kicker + an OVERSIZED uppercase Bebas headline + a right-aligned meta block), then a
 * native CSS-columns masonry of work tiles (`columns-1 sm:columns-2 lg:columns-3
 * xl:columns-4`), each an image with a baseline-aligned caption (title left, year/accent
 * right) and a slow 1.03 scale-on-hover. `index.tsx` wraps this in `<ScrollReveal
 * as="section">`, so this renders the INNER content.
 *
 * TRANSLATION NOTES (lovable-ingest): the export used framer-motion staggered figure
 * reveals + 12 bundled `work-NN.jpg` imports with hardcoded titles/years. ALL stripped to
 * a pure Server Component: the reveals become the kit ScrollReveal + CSS; each image is a
 * null-guarded Storage-origin `item.image` read with its REQUIRED `item.image_alt`. The
 * masonry layout, the per-tile caption, the hover scale, and the header are reproduced
 * EXACTLY. The export's `year` caption maps to the project's `tech_stack` first tag (a
 * compact accent label) when present; the title is the project `title`.
 *
 * CARDS-FREE WALL: unlike aurora's boxed project cards, atelier reproduces the export's
 * caption-under-image masonry wall (no card chrome). Pure Server Component (no
 * `'use client'`), keeping `/[username]` ● SSG/ISR.
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
import { headingStyle, kickerStyle, present } from './shared';

/** A single masonry work tile — image + baseline caption (title / accent label). */
function WorkTile({ item }: { item: ProjectItem }) {
  const title = present(item.title) ? item.title : null;
  const imageUrl = isHttpImageSrc(item.image) ? item.image : null;
  const imageAlt = present(item.image_alt) ? item.image_alt : null;
  if (!imageUrl || !imageAlt) return null; // the wall is images — no image, no tile

  // A compact accent label on the right of the caption — the project's first tech tag
  // (the export's "— year" accent). Render-if-present.
  const tech = Array.isArray(item.tech_stack) ? item.tech_stack.filter((t) => present(t)) : [];
  const label = tech[0] ?? null;

  // The whole tile links to the live URL when present (the export's tiles are static, but
  // a safe live link is a faithful enhancement of "selected work"). safeHref drops a
  // dangerous scheme.
  const liveUrl = safeHref(item.live_url) ?? null;

  const figure = (
    <figure
      className="tmpl-gallery-tile"
      style={{ breakInside: 'avoid', margin: 0, marginBottom: 'var(--atelier-gap)' }}
    >
      <div style={{ overflow: 'hidden', background: 'var(--surface-muted)' }}>
        <Image
          src={imageUrl}
          alt={imageAlt}
          width={1280}
          height={960}
          loading="lazy"
          decoding="async"
          unoptimized
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>
      <figcaption
        style={{
          marginTop: '12px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '16px',
          fontFamily: 'var(--font-body)',
          fontSize: '12px',
        }}
      >
        <span style={{ color: 'var(--fg)' }}>{title}</span>
        {label ? <span style={{ color: 'var(--accent)' }}>— {label}</span> : null}
      </figcaption>
    </figure>
  );

  if (liveUrl) {
    return (
      <a
        href={liveUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'block', textDecoration: 'none', breakInside: 'avoid' }}
      >
        {figure}
      </a>
    );
  }
  return figure;
}

export function Projects({ section }: SectionProps) {
  const content = (section?.content ?? null) as ProjectsContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.title) && isHttpImageSrc(it?.image))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Selected Work';

  return (
    <div className="tmpl-shell" style={{ paddingBlock: 'clamp(96px, 14vh, 160px)' }}>
      {/* Header row — kicker + oversized headline (left) + a meta count (right). */}
      <div
        style={{
          marginBottom: 'clamp(56px, 8vh, 80px)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '32px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <p style={kickerStyle}>02 — Selected Work</p>
          <h2 style={headingStyle}>{heading}</h2>
        </div>
        <p
          style={{
            ...kickerStyle,
            color: 'var(--muted-fg)',
            textAlign: 'right',
          }}
        >
          {items.length} selected {items.length === 1 ? 'piece' : 'pieces'}
        </p>
      </div>

      {/* Native CSS-columns masonry wall (the export's `columns-*`). */}
      <div style={{ columns: 'var(--atelier-gallery-cols, 1)', columnGap: 'var(--atelier-gap)' }}>
        {items.map((item, i) => (
          <WorkTile key={present(item.id) ? item.id : `${item.title}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
