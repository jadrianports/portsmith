/**
 * About section (D-P7-10 section 2) — the Newsprint magazine spread (07-UI-SPEC A.7
 * §2). Mirrors `minimal/sections/about.tsx`'s FROZEN `SectionProps` contract +
 * `present()` + content cast + null-guard + hide-if-empty EXACTLY; the visual body is
 * the editorial 2-col layout. `index.tsx` wraps this in `<ScrollReveal as="section">`,
 * so this renders the section's INNER content.
 *
 * RENDER CONTRACT (A.7 §2):
 *   - mono `02 — ABOUT` kicker above an ink rule.
 *   - a 2-col magazine spread on desktop (portrait LEFT in a near-square
 *     `--radius-md` frame with a thin INK border, bio RIGHT), stacked on mobile.
 *   - `about.avatar` renders ONLY when present (with its REQUIRED `avatar_alt`), via
 *     `next/image` with explicit width/height so it reserves space (no CLS).
 *   - `about.bio` as Body (18/1.6) capped at the ~68ch editorial measure.
 *   - `about.skills` (flat `string[]`) is DELIBERATELY NOT rendered here — superseded
 *     for display by the Skills section (D-09 / A.7 §2; lossless in schema, unrendered).
 *
 * AVATAR / next/image NOTE (Rule-3, matching minimal): avatars are free-form remote
 * `https` URLs; `next/image` optimization would require an `images.remotePatterns`
 * host allowlist (architectural) and the project does client-side WebP with NO server
 * image processing (CLAUDE.md, Vercel free tier). So the avatar uses `next/image` with
 * `unoptimized` — KEEPS width/height/CLS-safety + alt while rendering any host. WR-05:
 * `unoptimized` skips Next's host allowlist, so the src is scheme-checked here.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import Image from 'next/image';
import type { SectionProps } from './types';
import type { AboutContent } from '@/lib/validations';
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

export function About({ section }: SectionProps) {
  // Cast the validated JSONB content; null-guard the row + every field.
  const content = (section?.content ?? null) as AboutContent | null;
  if (!content) return null;

  const bio = present(content.bio) ? content.bio : null;

  // Avatar renders ONLY if a SAFE http(s) URL is present AND its required alt is
  // present (the Zod alt-text refine guarantees alt when avatar is set; re-guarded
  // defensively since every view column is nullable).
  const avatarUrl = isHttpImageSrc(content.avatar) ? content.avatar : null;
  const avatarAlt = present(content.avatar_alt) ? content.avatar_alt : null;
  const showAvatar = Boolean(avatarUrl && avatarAlt);

  // hide-if-empty: nothing meaningful to show → render nothing.
  if (!bio && !showAvatar) return null;

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
      {/* Mono kicker `02 — ABOUT` above an ink rule. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={kickerStyle}>02 — About</p>
        <div
          aria-hidden="true"
          style={{ height: '1px', width: '100%', background: 'var(--fg)' }}
        />
      </div>

      {/* 2-col magazine spread (portrait left, bio right), stacked on mobile via
          flex-wrap + a fixed portrait column and a flexible bio column. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: '48px',
        }}
      >
        {showAvatar ? (
          <div
            style={{
              flex: '0 0 auto',
              width: '220px',
              height: '260px',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              // A thin INK border (near-square editorial frame, A.7 §2).
              border: '1px solid var(--fg)',
            }}
          >
            <Image
              src={avatarUrl as string}
              alt={avatarAlt as string}
              width={220}
              height={260}
              // Remote avatars on arbitrary hosts → skip the optimizer; width/height
              // still reserve space → no CLS.
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

        {/* Bio — Body 18/1.6 capped at the ~68ch editorial measure. The about.skills
            array is intentionally NOT rendered (superseded by the Skills section). */}
        {bio ? (
          <p
            className="tmpl-measure"
            style={{
              flex: '1 1 320px',
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: 1.6,
              color: 'var(--fg)',
              margin: 0,
              whiteSpace: 'pre-line', // honor paragraph breaks in the seeded bio
            }}
          >
            {bio}
          </p>
        ) : null}
      </div>
    </div>
  );
}
