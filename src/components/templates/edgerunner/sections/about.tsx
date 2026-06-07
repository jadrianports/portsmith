/**
 * About section (edgerunner section 2) — the synthwave intro spread (translated from
 * `synthwave-founder/src/components/sections/About.tsx`). Mirrors the FROZEN
 * `SectionProps` contract + `present()` + content cast + null-guard + hide-if-empty
 * EXACTLY. `index.tsx` wraps this in `<ScrollReveal as="section">`, so this renders the
 * INNER content.
 *
 * RENDER CONTRACT: a mono `02 / about` kicker + neon hairline, then a 2-col spread on
 * desktop (~`1fr / 1.4fr`, the export's grid ratio): avatar LEFT in a holographic panel
 * (`.tmpl-holo-panel` glass + neon-cyan top-border glow + scanline overlay, the export's
 * `holo-panel` / `shadow-neon-cyan`), bio RIGHT via `mutedBodyStyle`/readable. Stacked on
 * mobile (flex-wrap). `about.avatar` renders ONLY when present (with its REQUIRED
 * `avatar_alt`) via `next/image` `unoptimized` — D-08 host-lock: `isHttpImageSrc` only
 * passes Supabase Storage origins. `about.skills` (flat `string[]`) is NOT rendered here
 * — superseded by the Skills section (D-09).
 *
 * HIDE-IF-EMPTY: neither avatar nor bio → return null.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import Image from 'next/image';
import type { CSSProperties } from 'react';

import type { SectionProps } from './types';
import type { AboutContent } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';
import { mutedBodyStyle, present, sectionShellStyle } from './shared';
import { SectionHeading } from './ui/section-heading';

export function About({ section }: SectionProps) {
  const content = (section?.content ?? null) as AboutContent | null;
  if (!content) return null;

  const bio = present(content.bio) ? content.bio : null;

  // D-08 host-lock: only Supabase Storage origins pass isHttpImageSrc.
  const avatarUrl = isHttpImageSrc(content.avatar) ? content.avatar : null;
  const avatarAlt = present(content.avatar_alt) ? content.avatar_alt : null;
  const hasRealAvatar = Boolean(avatarUrl && avatarAlt);

  // hide-if-empty: nothing meaningful to show → render nothing.
  if (!bio && !hasRealAvatar) return null;

  // Shared holographic card shell styles (used by both real-avatar and placeholder paths).
  const holoCardStyle: CSSProperties = {
    flex: '0 0 auto',
    position: 'relative',
    width: '240px',
    // 3:4 aspect ratio (the export's `aspect-[3/4]` / `max-w-xs`).
    aspectRatio: '3 / 4',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    // Neon-cyan outer glow — the export's `shadow-neon-cyan`.
    boxShadow:
      '0 0 0 1.5px color-mix(in oklab, var(--neon-cyan) 60%, transparent), ' +
      '0 0 32px -8px color-mix(in oklab, var(--neon-cyan) 50%, transparent), ' +
      '0 18px 44px -28px color-mix(in oklab, var(--neon-cyan) 35%, transparent)',
  };

  return (
    <div className="tmpl-shell" style={sectionShellStyle}>
      {/* Section header — centered eyebrow + big neon-glow title. */}
      <SectionHeading eyebrow="// ABOUT" title="Decoded" accent="cyan" />

      {/* 2-col layout on desktop (roughly 1fr / 1.4fr via flex-grow weights — the
          export's `lg:grid-cols-[1fr_1.4fr]`). Stacks on mobile (flex-wrap). */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: '48px',
        }}
      >
        {/* LEFT COL — holographic portrait.
            When a real avatar URL+alt exists: render it via next/image.
            Otherwise (no avatar uploaded yet): render the designed placeholder card —
            a pink→cyan gradient fill + "// avatar.holo" mono label. This ensures the
            left column is ALWAYS present so the 2-col layout holds. */}
        {hasRealAvatar ? (
          <div className="tmpl-holo-panel" style={holoCardStyle}>
            {/* Portrait image (full-bleed, object-cover). */}
            <Image
              src={avatarUrl as string}
              alt={avatarAlt as string}
              width={240}
              height={320}
              unoptimized
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {/* Scanline overlay — the export's `repeating-linear-gradient` CRT scanlines.
                Decorative aria-hidden overlay: token-based, no hardcoded hex, no pointer-events. */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                backgroundImage:
                  'repeating-linear-gradient(' +
                  'to bottom, ' +
                  'transparent 0, transparent 3px, ' +
                  'color-mix(in oklab, var(--neon-cyan) 8%, transparent) 4px, ' +
                  'transparent 5px' +
                  ')',
              }}
            />
          </div>
        ) : (
          /* Placeholder holographic portrait card — visible even when no avatar is
             uploaded. Gradient fill (pink→cyan, the neon-gradient) + a centered
             "// avatar.holo" mono label. Matches the reference's "KN"-monogram holo
             card design: tall card, neon-cyan glow border, gradient background fill,
             CRT scanlines, small retro label at bottom. */
          <div
            aria-hidden="true"
            style={{
              ...holoCardStyle,
              background: 'var(--neon-gradient)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
            }}
          >
            {/* Scanline overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                backgroundImage:
                  'repeating-linear-gradient(' +
                  'to bottom, ' +
                  'transparent 0, transparent 3px, ' +
                  'color-mix(in oklab, var(--bg-deep) 20%, transparent) 4px, ' +
                  'transparent 5px' +
                  ')',
              }}
            />
            {/* Neon glyph — the "◈" diamond mark used as a visual anchor */}
            <span
              style={{
                position: 'relative',
                fontFamily: 'var(--font-mono)',
                fontSize: '52px',
                lineHeight: 1,
                color: 'var(--bg-deep)',
                opacity: 0.85,
                userSelect: 'none',
              }}
            >
              ◈
            </span>
            {/* "// avatar.holo" retro label */}
            <span
              style={{
                position: 'relative',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--bg-deep)',
                opacity: 0.75,
                userSelect: 'none',
              }}
            >
              {'// avatar.holo'}
            </span>
          </div>
        )}

        {/* RIGHT COL — bio copy (Space Grotesk body, 18px/1.65, `var(--fg)` — matching
            the export's `text-lg leading-relaxed text-foreground/85`). */}
        {bio ? (
          <p
            style={{
              flex: '1 1 320px',
              maxWidth: '65ch',
              ...mutedBodyStyle,
              fontSize: '18px',
              lineHeight: 1.65,
              // Export uses foreground/85 (85% opacity); reproduce via muted-fg → fg.
              color: 'var(--fg)',
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
