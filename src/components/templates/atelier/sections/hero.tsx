/**
 * Hero section (atelier section 1) — the dark-editorial full-bleed masthead, a FAITHFUL
 * 1:1 clone of the export's `Hero.tsx` (`lovable-exports/atelier/src/components/portfolio/
 * Hero.tsx`): a full-screen background image with a bottom-anchored content column — a
 * kicker, an OVERSIZED uppercase Bebas headline (`clamp(4rem,14vw,15rem)`, leading 0.82),
 * and a muted lede. `index.tsx` wraps this in `<ScrollReveal as="section" priority>`, so
 * this renders the hero's INNER content (no `<section>` of its own).
 *
 * TRANSLATION NOTES (lovable-ingest): the export hero used framer-motion (parallax `y` +
 * fade on scroll, an entrance `initial/animate`) and a bundled `hero.jpg` asset import.
 * ALL stripped: this is a pure Server Component (no client JS, no `'use client'`); the
 * masthead paints static (the LCP element gets ZERO entrance motion via ScrollReveal's
 * `priority` branch); the image is the null-guarded Storage-origin `content.background_image`
 * read, never a bundled asset. The visual result (layout, type scale, gradient overlay,
 * accent kicker) is reproduced EXACTLY.
 *
 * DATA SOURCES (null-guarded — every `public_*` view column + JSONB content is `| null`):
 *   - `content.heading`          → the oversized uppercase masthead headline (required —
 *     hide the hero if absent).
 *   - `content.subheading`       → the muted lede line below the headline.
 *   - `content.background_image` → the full-bleed Storage-origin portrait/scene.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { HeroContent } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';
import { kickerStyle, present } from './shared';

export function Hero({ section }: SectionProps) {
  const content = (section?.content ?? null) as HeroContent | null;
  if (!content) return null;

  const heading = present(content.heading) ? content.heading : null;
  if (!heading) return null; // hide-if-empty: nothing to anchor the hero on

  const tagline = present(content.subheading) ? content.subheading : null;
  const bgUrl = isHttpImageSrc(content.background_image) ? content.background_image : null;

  return (
    <div
      id="top"
      style={{
        position: 'relative',
        minHeight: 'max(720px, 100vh)',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Full-bleed background image + the export's top→bottom gradient scrim that fades
          the image into the page canvas (so the bottom-anchored copy stays legible). */}
      {bgUrl ? (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
          <Image
            src={bgUrl}
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            style={{ objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(to bottom, color-mix(in srgb, var(--bg) 40%, transparent) 0%, color-mix(in srgb, var(--bg) 20%, transparent) 40%, var(--bg) 100%)',
            }}
          />
        </div>
      ) : null}

      {/* Bottom-anchored masthead content. */}
      <div
        className="tmpl-shell"
        style={{
          position: 'relative',
          zIndex: 10,
          paddingBottom: 'clamp(64px, 12vh, 96px)',
          paddingTop: '96px',
        }}
      >
        <p style={{ ...kickerStyle, marginBottom: '24px' }}>Portfolio</p>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'clamp(4rem, 14vw, 15rem)',
            lineHeight: 0.82,
            textTransform: 'uppercase',
            color: 'var(--fg)',
            margin: 0,
          }}
        >
          {heading}
        </h1>

        {tagline ? (
          <p
            style={{
              marginTop: '32px',
              maxWidth: '36rem',
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: 1.6,
              color: 'var(--muted-fg)',
            }}
          >
            {tagline}
          </p>
        ) : null}
      </div>
    </div>
  );
}
