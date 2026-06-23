/**
 * Gallery section (atelier — HAND-AUTHORED, the headline masonry, D-07). The image-first
 * "photo wall" for the visual-creative vertical. There is no export analog to ingest 1:1
 * (the export's wall was the SelectedWork projects masonry); this renderer is authored
 * against the export's scoped tokens, copying the `next/image` + `isHttpImageSrc` +
 * `aspect-ratio` box idiom from `aurora/sections/moodboard.tsx` but DEVIATING to native
 * stored dimensions (NO crop). `index.tsx` wraps this in `<ScrollReveal as="section">`,
 * so this renders the INNER content.
 *
 * RENDER CONTRACT (D-07/D-08/D-14):
 *   - casts `section.content` to `GalleryContent | null`, returns null when absent;
 *   - filters items by `isHttpImageSrc(it.url) && present(it.alt)` (Storage-origin guard +
 *     a11y); returns null when items empty (hide-if-empty);
 *   - renders a native CSS `columns` masonry (`columns: var(--atelier-gallery-cols, 1)`,
 *     `break-inside: avoid`) — the same wall the projects section uses, stepped 1→4 at
 *     the export's breakpoints;
 *   - each tile's box reserves space from the STORED `width`/`height` as
 *     `aspectRatio: ${w} / ${h}` (CLS-safe, NO crop — DEVIATES from moodboard's cropped
 *     4/3 `objectFit: cover`); the image is `next/image unoptimized loading="lazy"
 *     decoding="async"` with per-column responsive `sizes`;
 *   - threads `it.alt` straight to `<Image alt>` (the Zod-required alt — a11y, T-36-06).
 *
 * SCHEMA (sections.ts:423-434): `GalleryContent = { heading?(max100), items:
 * GalleryImage[](max40) }`; `GalleryImage = { id, url(http(s)), width(+int), height(+int),
 * alt(req non-empty) }`. All dims + alt are REQUIRED at the Zod gate, so after the
 * `isHttpImageSrc` host-guard the renderer can trust them.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { GalleryContent } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';
import { headingStyle, kickerStyle, present } from './shared';

export function Gallery({ section }: SectionProps) {
  const content = (section?.content ?? null) as GalleryContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((it) => isHttpImageSrc(it?.url) && present(it?.alt))
    : [];
  if (items.length === 0) return null; // hide-if-empty

  const heading = present(content.heading) ? content.heading : 'Gallery';

  return (
    <div className="tmpl-shell" style={{ paddingBlock: 'clamp(96px, 14vh, 160px)' }}>
      <div style={{ marginBottom: 'clamp(56px, 8vh, 80px)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <p style={kickerStyle}>Gallery</p>
        <h2 style={headingStyle}>{heading}</h2>
      </div>

      {/* Native CSS-columns masonry — no JS, no crop. Each tile keeps its native aspect
          ratio from the stored dims (D-07), so the wall packs unevenly like the export. */}
      <div style={{ columns: 'var(--atelier-gallery-cols, 1)', columnGap: 'var(--atelier-gap)' }}>
        {items.map((it) => (
          <figure
            key={it.id}
            className="tmpl-gallery-tile"
            style={{ breakInside: 'avoid', margin: 0, marginBottom: 'var(--atelier-gap)' }}
          >
            <div
              style={{
                // CLS-safe box reserved from the STORED dims — no crop (D-07/D-14).
                aspectRatio: `${it.width} / ${it.height}`,
                overflow: 'hidden',
                background: 'var(--surface-muted)',
              }}
            >
              <Image
                src={it.url}
                alt={it.alt}
                width={it.width}
                height={it.height}
                unoptimized
                loading="lazy"
                decoding="async"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}
