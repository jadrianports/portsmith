/**
 * About section (edgerunner section 2) — the synthwave intro spread (translated from
 * `synthwave-founder/src/components/sections/About.tsx`). Mirrors the FROZEN
 * `SectionProps` contract + `present()` + content cast + null-guard + hide-if-empty
 * EXACTLY. `index.tsx` wraps this in `<ScrollReveal as="section">`, so this renders the
 * INNER content.
 *
 * RENDER CONTRACT: a mono kicker + neon hairline, then a 2-col spread on desktop
 * (avatar LEFT in a neon-bordered frame, bio RIGHT), stacked on mobile. `about.avatar`
 * renders ONLY when present (with its REQUIRED `avatar_alt`), via `next/image`
 * `unoptimized` (the project does client-side WebP, no server image processing —
 * CLAUDE.md). `about.skills` (flat `string[]`) is NOT rendered here — superseded by the
 * Skills section (D-09).
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { AboutContent } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';
import { hairlineStyle, kickerStyle, present, sectionShellStyle } from './shared';

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={kickerStyle}>02 / about</p>
        <div aria-hidden="true" style={hairlineStyle} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '48px' }}>
        {showAvatar ? (
          <div
            style={{
              flex: '0 0 auto',
              width: '240px',
              height: '280px',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              border: '1px solid var(--border-strong)',
              // Neon-cyan edge glow (the synthwave holo-panel framing).
              boxShadow: '0 18px 44px -28px color-mix(in oklab, var(--neon-cyan) 45%, transparent)',
            }}
          >
            <Image
              src={avatarUrl as string}
              alt={avatarAlt as string}
              width={240}
              height={280}
              unoptimized
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ) : null}

        {bio ? (
          <p
            style={{
              flex: '1 1 320px',
              maxWidth: '65ch',
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: 1.65,
              color: 'var(--fg)',
              margin: 0,
              whiteSpace: 'pre-line',
            }}
          >
            {bio}
          </p>
        ) : null}
      </div>
    </div>
  );
}
