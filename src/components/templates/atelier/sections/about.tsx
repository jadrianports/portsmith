/**
 * About section (atelier section 2) — the dark-editorial intro spread, a FAITHFUL clone
 * of the export's `About.tsx`: a 12-column grid — a portrait in the left 4 columns (with a
 * small accent-dot meta line under it), and the right 8 columns carrying a "01 — About"
 * kicker, an OVERSIZED uppercase Bebas headline, and the bio copy. `index.tsx` wraps this
 * in `<ScrollReveal as="section">`, so this renders the INNER content.
 *
 * TRANSLATION NOTES (lovable-ingest): the export used framer-motion staggered reveals and
 * a bundled `portrait.jpg` import + hardcoded marketing prose (an oversized headline + a
 * pull-quote blockquote + two body columns). ALL stripped to a pure Server Component: the
 * reveals become the kit ScrollReveal + CSS; the portrait is the null-guarded
 * Storage-origin `content.avatar` read (with its REQUIRED `avatar_alt`); the prose is the
 * data-driven `content.bio`. The export's hard-coded headline ("I make pictures…") and
 * pull-quote are NOT reproduced as literal copy (they were placeholder content, not
 * structure) — the structural spread (portrait col-4 / copy col-8, kicker, big headline,
 * body) is reproduced EXACTLY.
 *
 * RENDER CONTRACT: kicker + heading + the 2-col spread (portrait LEFT, bio RIGHT), stacked
 * on mobile. `content.avatar` renders ONLY when present (with its REQUIRED `avatar_alt`),
 * via `next/image unoptimized` (the project does client-side WebP, no server image
 * processing — CLAUDE.md).
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { AboutContent } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';
import { headingStyle, kickerStyle, present, sectionShellStyle } from './shared';

export function About({ section }: SectionProps) {
  const content = (section?.content ?? null) as AboutContent | null;
  if (!content) return null;

  const bio = present(content.bio) ? content.bio : null;

  const avatarUrl = isHttpImageSrc(content.avatar) ? content.avatar : null;
  const avatarAlt = present(content.avatar_alt) ? content.avatar_alt : null;
  const showAvatar = Boolean(avatarUrl && avatarAlt);

  // hide-if-empty: nothing meaningful to show → render nothing.
  if (!bio && !showAvatar) return null;

  return (
    <div className="tmpl-shell" style={sectionShellStyle}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: '48px',
          alignItems: 'start',
        }}
      >
        {/* LEFT — portrait (cols 1–4) with the export's accent-dot meta line. */}
        {showAvatar ? (
          <div style={{ gridColumn: 'span 12', minWidth: 0 }} className="tmpl-about-portrait">
            <Image
              src={avatarUrl as string}
              alt={avatarAlt as string}
              width={768}
              height={1024}
              loading="lazy"
              unoptimized
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            <p style={{ ...kickerStyle, marginTop: '16px', color: 'var(--muted-fg)' }}>
              <span aria-hidden="true" style={{ color: 'var(--accent)' }}>
                ●
              </span>{' '}
              About
            </p>
          </div>
        ) : null}

        {/* RIGHT — kicker + oversized headline + bio (cols 5–12). */}
        <div
          style={{
            gridColumn: 'span 12',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
          className="tmpl-about-body"
        >
          <p style={kickerStyle}>01 — About</p>

          <h2 style={headingStyle}>About</h2>

          {bio ? (
            <p
              className="tmpl-measure"
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: '18px',
                lineHeight: 1.7,
                color: 'var(--muted-fg)',
                margin: 0,
                whiteSpace: 'pre-line',
              }}
            >
              {bio}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
