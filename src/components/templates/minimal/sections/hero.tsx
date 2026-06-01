/**
 * Hero section (D-05 section 1) — the synthwave centerpiece (UI-SPEC §"1. Hero";
 * "Midnight Outrun"). Replaces the 03-04 stub: the body is real, the SHARED
 * `SectionProps` signature, the export name, and the `index.tsx` wiring are
 * UNCHANGED (frozen 03-04 contract — `index.tsx` is NOT edited, no new prop is
 * introduced). `index.tsx` already wraps this in `<ScrollReveal as="section">`, so
 * this component renders the hero's INNER content (no `<section>` of its own).
 *
 * DATA SOURCES (null-guarded — every `public_*` view column and the JSONB content
 * is `| null`). Under the frozen `SectionProps` contract the Hero receives ONLY the
 * resolved hero `public_sections` row, so it renders from the hero CONTENT:
 *   - `content.heading`     → the big sunset-gradient NAME. The founder seed writes
 *     `profile.display_name` INTO the hero `heading` (founder-content fixture), so
 *     this IS the display name surfaced through the section contract.
 *   - `content.subheading`  → the tagline / role line, rendered as Muted-Body
 *     (Body 16px in `--muted-fg`).
 *   - `content.cta_text`    → defaults to the locked "Work with me" copy (D-12).
 *   - `content.cta_url`     → the Contact anchor (empty ⇒ in-page `#contact`).
 *   - `content.resume_url`  → the "Download résumé" ghost button, rendered ONLY when
 *     present (D-14). The seed sources this from `profile.resume_url`; surfacing it
 *     through the hero content keeps the frozen `{ section }` contract intact (the
 *     other 6 by-type sections and the parallel 03-06/07/08 swap rely on it). When
 *     no résumé URL is present the button hides (hide-if-empty).
 *
 * COLOR (no hardcoded hex for UI — SHARED-D; UI tokens via `var(--token)`; the only
 * literal color values are inside the documented decorative sunset/glow gradients,
 * which the UI-SPEC explicitly exempts as the one atmospheric moment):
 *   - The sunset-gradient name uses the scoped `--sunset-gradient` token (defined in
 *     theme.css from the token hexes) text-clipped + a subtle glow.
 *   - The "Work with me" CTA is a magenta fill (`--accent`) whose LABEL is
 *     `var(--bg)`: in DARK that resolves to the dark ink `#0C0B1E` (AA 5.60:1 — the
 *     UI-SPEC's hard "never white on magenta" rule); in LIGHT `--bg` is the pale
 *     canvas on the deep-pink fill (AA 5.43:1). One token, AA-safe in BOTH modes,
 *     and never the literal `#fff` / `white`.
 */
import type { SectionProps } from './types';
import type { HeroContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';

/**
 * The hero content as it flows through the section contract. It is `HeroContent`
 * (validated at seed time) plus an OPTIONAL `resume_url` the seed may surface from
 * `profile.resume_url` for the "Download résumé" button (D-14). Optional ⇒ the
 * button simply hides when absent.
 */
type HeroSectionContent = HeroContent & { resume_url?: string | null };

/** A string field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function Hero({ section }: SectionProps) {
  // Cast the validated JSONB content; null-guard the row + every field.
  const content = (section?.content ?? null) as HeroSectionContent | null;
  if (!content) return null;

  // The sunset-gradient NAME — the seed writes profile.display_name into heading.
  const displayName = present(content.heading) ? content.heading : null;
  if (!displayName) return null; // hide-if-empty: nothing to anchor the hero on

  const tagline = present(content.subheading) ? content.subheading : null;
  // CTA copy is locked to "Work with me" (D-12); honor a seeded override.
  const ctaText = present(content.cta_text) ? content.cta_text : 'Work with me';
  // Empty/absent cta_url ⇒ the in-page Contact anchor. CR-01: the seeded URL passes
  // through `safeHref` (it permits the `#contact` anchor); a dangerous/unparseable
  // scheme falls back to the safe in-page anchor rather than rendering a live link.
  const ctaHref = safeHref(content.cta_url) ?? '#contact';
  // The "Download résumé" button is gated on a present résumé URL (sourced from
  // profile.resume_url through the seed) — render-only-if-present (D-14). CR-01:
  // dropped entirely unless it is a safe http(s) href.
  const resumeUrl = safeHref(content.resume_url) ?? null;

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: '24px',
        padding: '64px 0',
        overflow: 'hidden',
      }}
    >
      {/* Decorative synthwave backdrop — sunset glow + retro-sun arc + grid-horizon.
          CSS/SVG only, restrained alpha, reduced-motion-safe (theme.css zeroes any
          animation under prefers-reduced-motion). aria-hidden: purely atmospheric. */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      >
        {/* Sunset radial glow behind the headline (the one big atmospheric moment). */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '40%',
            width: 'min(92vw, 760px)',
            height: 'min(92vw, 760px)',
            transform: 'translate(-50%, -50%)',
            background:
              'radial-gradient(circle at 50% 60%, rgba(255,45,149,0.16), rgba(140,30,255,0.10) 42%, transparent 70%)',
            filter: 'blur(10px)',
          }}
        />
        {/* Retro-sun arc — a banded sunset-gradient circle (the gold→violet ramp). */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '36%',
            width: 'min(72vw, 480px)',
            height: 'min(72vw, 480px)',
            transform: 'translate(-50%, -50%)',
            borderRadius: 'var(--radius-full)',
            background: 'var(--sunset-gradient)',
            opacity: 0.22,
            maskImage:
              'repeating-linear-gradient(to bottom, #000 0 14px, transparent 14px 22px)',
            WebkitMaskImage:
              'repeating-linear-gradient(to bottom, #000 0 14px, transparent 14px 22px)',
          }}
        />
        {/* Perspective grid-horizon — converging hairlines, low opacity (~8%). */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '38%',
            background:
              'repeating-linear-gradient(to right, var(--accent-cyan) 0 1px, transparent 1px 56px), repeating-linear-gradient(to top, var(--accent-violet) 0 1px, transparent 1px 48px)',
            opacity: 0.08,
            transform: 'perspective(420px) rotateX(62deg)',
            transformOrigin: 'bottom',
            maskImage: 'linear-gradient(to top, #000, transparent)',
            WebkitMaskImage: 'linear-gradient(to top, #000, transparent)',
          }}
        />
      </div>

      {/* Foreground content (above the backdrop). SHELLED: `.tmpl-shell` gives the
          centered 72rem column + horizontal gutter (theme.css) so the hero text no
          longer pins to x=0 — while the decorative backdrop above stays FULL-BLEED
          (it is a sibling outside this shell, so the sun/grid/glow still span the
          viewport). Inside the shell the text keeps its ~62ch reading measure and
          sits LEFT (`marginRight: auto`) per the hero's left-aligned design. */}
      <div
        className="tmpl-shell"
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            width: '100%',
            maxWidth: '62ch',
            marginRight: 'auto',
          }}
        >
        {/* Mono section label `01 / intro`. */}
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
          01 / intro
        </p>

        {/* The big sunset-gradient NAME (Clash Display, text-clipped sunset + glow).
            Sourced from profile.display_name via the hero content's heading. */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 'clamp(3.25rem, 7vw, 4.5rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            margin: 0,
            backgroundImage: 'var(--sunset-gradient)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            filter: 'drop-shadow(0 2px 18px rgba(255,45,149,0.22))',
          }}
        >
          {displayName}
        </h1>

        {/* Role line / tagline — Muted-Body (Body 16px in --muted-fg). */}
        {tagline ? (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: 1.5,
              color: 'var(--muted-fg)',
              margin: 0,
            }}
          >
            {tagline}
          </p>
        ) : null}

        {/* "Available for work" status dot — magenta dot, gentle pulse (the pulse is
            disabled under reduced-motion by theme.css's blanket animation reset). */}
        <p
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--muted-fg)',
            margin: 0,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent)',
              boxShadow: '0 0 0 4px rgba(255,45,149,0.18)',
              animation: 'tmpl-hero-pulse 2.4s ease-in-out infinite',
            }}
          />
          Available for work
        </p>

        {/* CTAs — primary "Work with me" (magenta fill, var(--bg) label) + the
            secondary "Download résumé" ghost button (rendered only if present). */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px' }}>
          <a
            href={ctaHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '44px',
              padding: '0 24px',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '16px',
              background: 'var(--accent)',
              color: 'var(--bg)',
              textDecoration: 'none',
              boxShadow: '0 8px 28px -12px rgba(255,45,149,0.38)',
            }}
          >
            {ctaText}
          </a>

          {resumeUrl ? (
            <a
              href={resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '44px',
                padding: '0 24px',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '16px',
                background: 'transparent',
                color: 'var(--fg)',
                border: '1px solid var(--border-strong)',
                textDecoration: 'none',
              }}
            >
              Download résumé
            </a>
          ) : null}
        </div>
        </div>
      </div>

      {/* Scroll cue at the bottom (subtle bob; static under reduced-motion). The
          left offset matches the shell's responsive gutter (`clamp(1.5rem,5vw,4rem)`)
          so the cue aligns with the shelled content instead of pinning to x=0. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 'clamp(1.5rem, 5vw, 4rem)',
          bottom: '32px',
          zIndex: 1,
          color: 'var(--muted-fg)',
          animation: 'tmpl-hero-bob 2s ease-in-out infinite',
        }}
      >
        {/* Inline chevron (no client JS); lucide ChevronDown shape. */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}
