/**
 * Hero section (D-P7-10 section 1) — the Newsprint broadsheet masthead (07-UI-SPEC
 * A.7 §1; "Newsprint" editorial/Swiss). Mirrors `minimal/sections/hero.tsx`'s FROZEN
 * `SectionProps` contract + `present()` + content cast + null-guard + hide-if-empty +
 * `safeHref` (CR-01) EXACTLY; the visual body is the editorial layout. `index.tsx`
 * already wraps this in `<ScrollReveal as="section" priority>`, so this renders the
 * hero's INNER content (no `<section>` of its own).
 *
 * DATA SOURCES (null-guarded — every `public_*` view column + JSONB content is
 * `| null`). Identical to minimal (the seed writes `profile.display_name` into
 * `hero.heading`; `resume_url` rides the hero content for the "Download résumé"
 * button, D-14):
 *   - `content.heading`     → the oversized Fraunces NAME, in INK (no gradient).
 *   - `content.subheading`  → the role line / tagline, Body in `--muted-fg`.
 *   - `content.cta_text`    → defaults to "Get in touch" (A.7 §1).
 *   - `content.cta_url`     → the Contact anchor (empty ⇒ in-page `#contact`).
 *   - `content.resume_url`  → the "Download résumé" ghost button, render-if-present.
 *
 * LAYOUT (A.7 §1): a tall (`min-height: 88vh`) masthead — mono kicker `01 — PROFILE`
 * above an INK rule, the oversized Fraunces name in INK with a single vermilion
 * full-stop flourish, the role line as Body in `--muted-fg`, a "Get in touch"
 * vermilion CTA (white/`--bg` label per A.6) → #contact, an optional ink ghost
 * "Download résumé", a static vermilion "available" SQUARE (no pulse — Swiss), and a
 * static `ArrowDown` scroll cue. The NAME is the LCP element → ZERO entrance motion
 * (A.5). No backdrop atmosphere — the paper IS the background (A.5).
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 * The CTA fill is the vermilion `--accent` with a `var(--bg)` (white-in-light /
 * ink-in-dark) label — the A.6 "verify the CTA pairing" rule (white-on-accent 5.20:1
 * in light; dark-bg-on-accent 6.48:1 in dark — AA in both).
 */
import type { SectionProps } from './types';
import type { HeroContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';

/**
 * The hero content as it flows through the section contract: `HeroContent` (validated
 * at seed time) plus an OPTIONAL `resume_url` the seed may surface from
 * `profile.resume_url` for the "Download résumé" button (D-14). Optional ⇒ the button
 * simply hides when absent.
 */
type HeroSectionContent = HeroContent & { resume_url?: string | null };

/** A string field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Mono kicker label (the broadsheet "department" tag) — uppercase JetBrains Mono. */
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

export function Hero({ section }: SectionProps) {
  // Cast the validated JSONB content; null-guard the row + every field.
  const content = (section?.content ?? null) as HeroSectionContent | null;
  if (!content) return null;

  // The Fraunces NAME — the seed writes profile.display_name into heading.
  const displayName = present(content.heading) ? content.heading : null;
  if (!displayName) return null; // hide-if-empty: nothing to anchor the hero on

  const tagline = present(content.subheading) ? content.subheading : null;
  // CTA copy defaults to the editorial "Get in touch" (A.7 §1); honor a seeded override.
  const ctaText = present(content.cta_text) ? content.cta_text : 'Get in touch';
  // Empty/absent cta_url ⇒ the in-page Contact anchor. CR-01: the seeded URL passes
  // through `safeHref` (which permits the `#contact` anchor); a dangerous/unparseable
  // scheme falls back to the safe in-page anchor rather than rendering a live link.
  const ctaHref = safeHref(content.cta_url) ?? '#contact';
  // The "Download résumé" button is gated on a present résumé URL — render-if-present
  // (D-14). CR-01: dropped entirely unless it is a safe http(s) href.
  const resumeUrl = safeHref(content.resume_url) ?? null;

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingBlock: '64px',
      }}
    >
      {/* Masthead content — shelled (centered 76rem column + the Swiss gutter). No
          backdrop atmosphere (the paper IS the background). The text sits LEFT. */}
      <div
        className="tmpl-shell"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Mono kicker `01 — PROFILE` above an INK rule (the broadsheet department
            label + the signature Swiss hairline). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={kickerStyle}>01 — Profile</p>
          <div
            aria-hidden="true"
            style={{ height: '1px', width: '100%', background: 'var(--fg)' }}
          />
        </div>

        {/* The oversized Fraunces NAME — in INK (no gradient), with a single vermilion
            full-stop flourish (one mark, not the whole name — A.4 reserved-for). */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 'clamp(2.75rem, 8vw, 5.5rem)',
            lineHeight: 1.0,
            letterSpacing: '-0.02em',
            color: 'var(--fg)',
            margin: 0,
            maxWidth: '18ch',
          }}
        >
          {displayName}
          <span aria-hidden="true" style={{ color: 'var(--accent)' }}>
            .
          </span>
        </h1>

        {/* Role line / tagline — Body in --muted-fg (the lead voice), capped measure. */}
        {tagline ? (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: 1.5,
              color: 'var(--muted-fg)',
              margin: 0,
              maxWidth: '48ch',
            }}
          >
            {tagline}
          </p>
        ) : null}

        {/* "Available for work" indicator — a small static vermilion SQUARE + a mono
            label (no pulse — Swiss restraint, A.5). */}
        <p
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            ...kickerStyle,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              background: 'var(--accent)',
            }}
          />
          Available for work
        </p>

        {/* CTAs — primary "Get in touch" (vermilion fill, var(--bg) label) + the
            secondary "Download résumé" ink ghost button (render-only-if-present). */}
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
            }}
          >
            {ctaText}
          </a>

          {resumeUrl ? (
            <a
              href={resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tmpl-project-link"
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

      {/* Static scroll cue at the bottom (lucide ArrowDown shape, inline — no client
          JS; static, no bob — Swiss restraint A.5). Left offset matches the shell's
          responsive gutter so the cue aligns with the shelled content. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 'clamp(1.5rem, 6vw, 5rem)',
          bottom: '32px',
          color: 'var(--muted-fg)',
        }}
      >
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
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
