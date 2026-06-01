/**
 * About section (D-05 section 2) — UI-SPEC §"2. About". Replaces the 03-04 stub:
 * the body is real, the SHARED `SectionProps` signature, the export name, and the
 * `index.tsx` wiring are UNCHANGED (frozen 03-04 contract — `index.tsx` is NOT
 * edited, no new prop). `index.tsx` already wraps this in `<ScrollReveal
 * as="section">`, so this renders the section's INNER content (no `<section>` of
 * its own).
 *
 * RENDER CONTRACT (UI-SPEC §2):
 *   - mono `02 / about` label.
 *   - two-column on desktop (avatar left, bio right), stacked on mobile.
 *   - `about.avatar` rendered in a `--radius-full` frame with a faint cyan ring
 *     ONLY when present (with its REQUIRED `avatar_alt`), via `next/image` with
 *     explicit width/height so it reserves space and never shifts layout (CLS).
 *   - `about.bio` as Body (16/1.6) at a comfortable measure (~65ch).
 *   - the `about.skills` flat `string[]` is DELIBERATELY NOT rendered here — it is
 *     superseded for display by the dedicated Skills section (D-09 / UI-SPEC §2).
 *     It stays in the schema (lossless), just unrendered, to avoid duplication.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 *
 * AVATAR / next/image NOTE (Rule-3): avatars are free-form remote `https` URLs
 * (Supabase Storage / any host). `next/image` optimization would require an
 * `images.remotePatterns` allowlist in `next.config.ts` for every possible avatar
 * host — an architectural, host-dependent decision, and the project's image
 * pipeline is client-side WebP with NO server image processing (CLAUDE.md, Vercel
 * free tier). So the avatar uses `next/image` with `unoptimized` — it KEEPS the
 * width/height/CLS-safety + alt contract this plan requires, renders any remote URL
 * with no remote-host config, and skips the Vercel optimizer. The seed currently
 * ships `avatar: ''` (no avatar), so this path is inert until a real URL is seeded.
 */
import Image from 'next/image';
import type { SectionProps } from './types';
import type { AboutContent } from '@/lib/validations';

/** A string field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function About({ section }: SectionProps) {
  // Cast the validated JSONB content; null-guard the row + every field.
  const content = (section?.content ?? null) as AboutContent | null;
  if (!content) return null;

  const bio = present(content.bio) ? content.bio : null;

  // Avatar renders ONLY if a URL is present AND its required alt is present
  // (the Zod alt-text refine guarantees alt when avatar is set; we re-guard
  // defensively since every view column is nullable).
  const avatarUrl = present(content.avatar) ? content.avatar : null;
  const avatarAlt = present(content.avatar_alt) ? content.avatar_alt : null;
  const showAvatar = Boolean(avatarUrl && avatarAlt);

  // hide-if-empty: nothing meaningful to show → render nothing.
  if (!bio && !showAvatar) return null;

  return (
    <div
      // `.tmpl-shell`: the shared centered max-width + horizontal gutter (theme.css).
      // `paddingBlock` keeps the vertical section rhythm; the shell owns the gutter.
      className="tmpl-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        paddingBlock: '64px',
      }}
    >
      {/* Mono section label `02 / about` (cyan, per the hero precedent). */}
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 500,
          lineHeight: 1.4,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--accent-cyan)',
          margin: 0,
        }}
      >
        02 / about
      </p>

      {/* Two-column on desktop (avatar left, bio right), stacked on mobile.
          `auto-fit` + a min track collapses to one column on narrow viewports
          with no media query; the avatar column is fixed-ish via its own size. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: '32px',
        }}
      >
        {showAvatar ? (
          <div
            style={{
              flex: '0 0 auto',
              width: '160px',
              height: '160px',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              // Faint cyan ring (UI-SPEC §2) — a 2px ring via box-shadow, low alpha.
              boxShadow: '0 0 0 2px var(--accent-cyan)',
            }}
          >
            <Image
              src={avatarUrl as string}
              alt={avatarAlt as string}
              width={160}
              height={160}
              // Remote avatars on arbitrary hosts → skip the optimizer (see header
              // note); width/height still reserve space → no CLS.
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

        {/* Bio — Body 16/1.6 at a comfortable ~65ch measure. The about.skills
            array is intentionally NOT rendered (superseded by the Skills section). */}
        {bio ? (
          <p
            style={{
              flex: '1 1 280px',
              maxWidth: '65ch',
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: '16px',
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
