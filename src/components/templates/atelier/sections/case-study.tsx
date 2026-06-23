/**
 * Case Study section (atelier — HAND-AUTHORED, the stacked narrative, D-11/D-12). "One
 * project told as a story." Authored against the export's scoped tokens, drawing on the
 * export's `CaseStudies.tsx` editorial voice (kicker + big title + body + a meta `<dl>`)
 * and the `aurora/sections/moodboard.tsx` image idiom. `index.tsx` wraps this in
 * `<ScrollReveal as="section">`, so this renders the INNER content.
 *
 * RENDER CONTRACT — per item (D-11, every block INDEPENDENTLY hide-empty):
 *   - title (h3, oversized Bebas) →
 *   - a quiet meta line `[role, client, year].filter(present).join(' · ')` (hidden if all
 *     empty) →
 *   - for each of challenge / process / outcome: a small kicker (Challenge / Process /
 *     Outcome) + the body block — rendered ONLY when `present(block)` (each independently
 *     hidden) →
 *   - a COMPACT responsive image grid (`repeat(auto-fit, minmax(...))`) of the item's ≤5
 *     images — DISTINCT from the headline columns-masonry (D-12 / Pitfall 5), so a small
 *     image set never reads as a sparse masonry. Same CLS-safe stored-dims +
 *     `isHttpImageSrc` + lazy idiom.
 *
 * SCHEMA (sections.ts:441-471): `CaseStudyContent = { heading?(max100), items:
 * CaseStudyItem[](max12) }`; `CaseStudyItem = { id, title(req,max150), role?/client?/year?
 * (meta), challenge?/process?/outcome?(each max2000 SINGLE block), images:
 * CaseStudyImage[](max5) }`. After the `isHttpImageSrc` host-guard, the REQUIRED image
 * dims + alt can be trusted.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { CaseStudyContent, CaseStudyItem, CaseStudyImage } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';
import { headingStyle, kickerStyle, present } from './shared';

/** One narrative block — a kicker label + a body paragraph, render-only-if-present. */
function NarrativeBlock({ label, body }: { label: string; body: string | undefined | null }) {
  if (!present(body)) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={kickerStyle}>{label}</p>
      <p
        className="tmpl-measure"
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontSize: '16px',
          lineHeight: 1.7,
          color: 'var(--muted-fg)',
          whiteSpace: 'pre-line',
        }}
      >
        {body}
      </p>
    </div>
  );
}

/** The COMPACT image grid — distinct from the headline masonry (D-12). */
function CaseImages({ images }: { images: CaseStudyImage[] }) {
  const safe = Array.isArray(images)
    ? images.filter((im) => isHttpImageSrc(im?.url) && present(im?.alt))
    : [];
  if (safe.length === 0) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--atelier-gap)',
      }}
    >
      {safe.map((im) => (
        <div
          key={im.id}
          style={{
            aspectRatio: `${im.width} / ${im.height}`,
            overflow: 'hidden',
            background: 'var(--surface-muted)',
          }}
        >
          <Image
            src={im.url}
            alt={im.alt}
            width={im.width}
            height={im.height}
            unoptimized
            loading="lazy"
            decoding="async"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      ))}
    </div>
  );
}

/** One case-study article — stacked narrative + the compact image grid. */
function CaseArticle({ item }: { item: CaseStudyItem }) {
  const title = present(item.title) ? item.title : null;
  if (!title) return null;

  const meta = [item.role, item.client, item.year].filter(present).join(' · ');

  return (
    <article style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'clamp(2rem, 3.4vw, 3.25rem)',
            lineHeight: 0.95,
            textTransform: 'uppercase',
            color: 'var(--fg)',
            margin: 0,
          }}
        >
          {title}
        </h3>
        {meta ? (
          <p style={{ ...kickerStyle, color: 'var(--muted-fg)' }}>{meta}</p>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <NarrativeBlock label="Challenge" body={item.challenge} />
        <NarrativeBlock label="Process" body={item.process} />
        <NarrativeBlock label="Outcome" body={item.outcome} />
      </div>

      <CaseImages images={item.images} />
    </article>
  );
}

export function CaseStudy({ section }: SectionProps) {
  const content = (section?.content ?? null) as CaseStudyContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.title))
    : [];
  if (items.length === 0) return null; // hide-if-empty

  const heading = present(content.heading) ? content.heading : 'Case Studies';

  return (
    <div className="tmpl-shell" style={{ paddingBlock: 'clamp(96px, 14vh, 160px)' }}>
      <div style={{ marginBottom: 'clamp(56px, 8vh, 96px)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <p style={kickerStyle}>03 — Case Studies</p>
        <h2 style={headingStyle}>{heading}</h2>
      </div>

      {/* Stacked articles — generous vertical rhythm (the export's `space-y-28 md:space-y-40`). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(80px, 12vh, 160px)' }}>
        {items.map((item, i) => (
          <CaseArticle key={present(item.id) ? item.id : `${item.title}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
