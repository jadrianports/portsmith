/**
 * Moodboard section (aurora — NEW marketer-vertical type, 11-04 Step C1). Translated from
 * `marketing-girl/src/components/Moodboard.tsx` (a captioned image gallery + an optional
 * brand palette). A FIRST-CLASS mapped soft-enum type (`moodboard` is in
 * `sectionContentSchemas`). Mirrors the FROZEN `SectionProps` contract + `present()` +
 * content cast + null-guard + hide-if-empty + `isHttpImageSrc`. `index.tsx` wraps this in
 * `<ScrollReveal as="section">`, so this renders the INNER content.
 *
 * Casts `section.content` to `MoodboardContent` (`{ heading, subheading?, items: [{ id,
 * image?, image_alt?, caption? }], palette?: [{ color, name? }] }`).
 *
 * RENDER CONTRACT: a mono kicker + heading + optional subheading, then a masonry-ish
 * responsive gallery of captioned images (each renders ONLY when a SAFE Storage-origin
 * image + its required alt are present), then an optional brand palette row of swatches.
 * The source's unsplash gallery images become null-guarded Storage-origin reads. The
 * palette `color` is a validated hex literal (NOT a free string), so it is safe to set as
 * an inline `background-color` — NOT a CSS-injection sink (schema guarantees `#RGB`/`#RRGGBB`).
 *
 * COLOR: no hardcoded hex for UI chrome — every UI value reads a scoped `var(--token)`.
 * The ONLY inline color values are the validated per-swatch palette hexes (user content,
 * hex-constrained at the Zod gate).
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { MoodboardContent, MoodboardImage, PaletteSwatch } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';
import { hairlineStyle, headingStyle, kickerStyle, present, sectionShellStyle } from './shared';

/** A single captioned gallery tile — renders only with a SAFE image + required alt. */
function MoodboardTile({ item }: { item: MoodboardImage }) {
  const imageUrl = isHttpImageSrc(item.image) ? item.image : null;
  const imageAlt = present(item.image_alt) ? item.image_alt : null;
  if (!imageUrl || !imageAlt) return null;

  const caption = present(item.caption) ? item.caption : null;

  return (
    <figure
      style={{
        position: 'relative',
        margin: 0,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'var(--surface-muted)',
      }}
    >
      <div style={{ width: '100%', aspectRatio: '4 / 3', overflow: 'hidden' }}>
        <Image
          src={imageUrl}
          alt={imageAlt}
          width={800}
          height={600}
          unoptimized
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
      {caption ? (
        <figcaption
          style={{
            padding: '12px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontWeight: 400,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--muted-fg)',
          }}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** A single palette swatch — the validated hex as an inline background (safe, hex-gated). */
function Swatch({ swatch }: { swatch: PaletteSwatch }) {
  const color = present(swatch.color) ? swatch.color : null;
  if (!color) return null;
  const name = present(swatch.name) ? swatch.name : null;

  return (
    <li style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          width: '56px',
          height: '56px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border-strong)',
          // SAFE: `color` is Zod-validated to `#RGB`/`#RRGGBB` (not a free string), so it
          // is a constrained literal, NOT a CSS-injection sink.
          background: color,
        }}
      />
      {name ? (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--muted-fg)',
          }}
        >
          {name}
        </span>
      ) : null}
    </li>
  );
}

export function Moodboard({ section }: SectionProps) {
  const content = (section?.content ?? null) as MoodboardContent | null;
  if (!content) return null;

  const tiles = Array.isArray(content.items)
    ? content.items.filter((it) => isHttpImageSrc(it?.image) && present(it?.image_alt))
    : [];
  const palette = Array.isArray(content.palette)
    ? content.palette.filter((s) => present(s?.color))
    : [];

  // hide-if-empty: no renderable tile AND no swatch → render nothing.
  if (tiles.length === 0 && palette.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Moodboard';
  const subheading = present(content.subheading) ? content.subheading : null;

  return (
    <div className="tmpl-shell" style={sectionShellStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={kickerStyle}>Moodboard</p>
        <div aria-hidden="true" style={hairlineStyle} />
      </div>

      <h2 style={headingStyle}>{heading}</h2>

      {subheading ? (
        <p
          className="tmpl-measure"
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: 1.55,
            color: 'var(--muted-fg)',
            margin: 0,
          }}
        >
          {subheading}
        </p>
      ) : null}

      {tiles.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '20px',
          }}
        >
          {tiles.map((item, i) => (
            <MoodboardTile key={present(item.id) ? item.id : `${item.caption}-${i}`} item={item} />
          ))}
        </div>
      ) : null}

      {palette.length > 0 ? (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            alignItems: 'flex-start',
          }}
        >
          {palette.map((swatch, i) => (
            <Swatch key={present(swatch.name) ? `${swatch.name}-${i}` : `swatch-${i}`} swatch={swatch} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
