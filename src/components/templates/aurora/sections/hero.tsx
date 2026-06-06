/**
 * Hero section (aurora section 1) — the rosy gradient masthead (translated from
 * `lovable-exports/marketing-girl/src/components/Hero.tsx`). Mirrors the FROZEN
 * `SectionProps` contract + `present()` + content cast + null-guard + hide-if-empty +
 * `safeHref` (CR-01) EXACTLY; the visual body is the aurora layout. `index.tsx` already
 * wraps this in `<ScrollReveal as="section" priority>`, so this renders the hero's INNER
 * content (no `<section>` of its own).
 *
 * TRANSLATION NOTES (Task 2):
 *   - The source hero used framer-motion entrance animations, a rotating-skills
 *     interval (useState/useEffect), a hardcoded `profile-hero.jpg` asset import, and a
 *     hardcoded phone/email/location block. ALL stripped: this is a pure Server
 *     Component (no client JS, no `'use client'`); the entrance is the kit ScrollReveal
 *     `priority` static branch (the NAME is the LCP element → ZERO entrance motion); the
 *     image is the null-guarded `profile.avatar_url` (a Storage-origin read, never the
 *     bundled asset); the contact details are NOT hardcoded (they live in the Contact
 *     section / settings).
 *   - The source's signature gradient-clip name ("gradient-text") is preserved via the
 *     `.tmpl-hero-name` CSS class (a solid `--fg` fallback is set inline so the name is
 *     never invisible). The soft glow bloom is the CSS-only `.tmpl-hero-glow` backdrop.
 *
 * DATA SOURCES (null-guarded — every `public_*` view column + JSONB content is `| null`):
 *   - `content.heading`     → the gradient-clip NAME (the seed writes profile.display_name).
 *   - `content.subheading`  → the role line / tagline, Body in `--muted-fg`.
 *   - `content.cta_text`    → defaults to "Let's work together".
 *   - `content.cta_url`     → the Contact anchor (empty ⇒ in-page `#contact`).
 *   - `content.resume_url`  → the "Download CV" ghost button, render-if-present.
 *   - `content.background_image` → an optional Storage-origin portrait, render-if-present.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { HeroContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { isHttpImageSrc } from '@/lib/safe-image';
import { kickerStyle, present } from './shared';

/**
 * The hero content as it flows through the section contract: `HeroContent` (validated at
 * seed time) plus an OPTIONAL `resume_url` the seed may surface from
 * `profile.resume_url` for the "Download CV" button (D-14). Optional ⇒ the button hides
 * when absent.
 */
type HeroSectionContent = HeroContent & { resume_url?: string | null };

export function Hero({ section }: SectionProps) {
  // Cast the validated JSONB content; null-guard the row + every field.
  const content = (section?.content ?? null) as HeroSectionContent | null;
  if (!content) return null;

  // The gradient-clip NAME — the seed writes profile.display_name into heading.
  const displayName = present(content.heading) ? content.heading : null;
  if (!displayName) return null; // hide-if-empty: nothing to anchor the hero on

  const tagline = present(content.subheading) ? content.subheading : null;
  // CTA copy defaults to the marketer-flavored "Let's work together"; honor a seeded override.
  const ctaText = present(content.cta_text) ? content.cta_text : "Let's work together";
  // Empty/absent cta_url ⇒ the in-page Contact anchor. CR-01: the seeded URL passes
  // through `safeHref` (which permits the `#contact` anchor); a dangerous/unparseable
  // scheme falls back to the safe in-page anchor rather than rendering a live link.
  const ctaHref = safeHref(content.cta_url) ?? '#contact';
  // The "Download CV" button is gated on a present résumé URL — render-if-present (D-14).
  const resumeUrl = safeHref(content.resume_url) ?? null;
  // Optional portrait — render only if a SAFE Storage-origin http(s) URL is present.
  const portraitUrl = isHttpImageSrc(content.background_image) ? content.background_image : null;

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingBlock: '80px',
        overflow: 'hidden',
      }}
    >
      {/* The soft glow bloom backdrop (the source's signature atmosphere, CSS-only —
          a static glow, reduced-motion exempt; sits behind content via z-index). */}
      <div aria-hidden="true" className="tmpl-hero-glow" />

      {/* Masthead content — shelled (centered column + responsive gutter). A two-column
          spread on desktop (copy LEFT, portrait RIGHT), stacked on mobile. */}
      <div
        className="tmpl-shell"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '48px',
        }}
      >
        <div
          style={{
            flex: '1 1 340px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Mono greeting kicker. */}
          <p style={kickerStyle}>Hello, I&rsquo;m</p>

          {/* The oversized gradient-clip NAME (the source's signature). The solid
              `--fg` color is the inline fallback the `.tmpl-hero-name` clip overrides. */}
          <h1
            className="tmpl-hero-name"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 'clamp(2.75rem, 8vw, 5.5rem)',
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
              color: 'var(--fg)',
              margin: 0,
              maxWidth: '16ch',
            }}
          >
            {displayName}
          </h1>

          {/* Role line / tagline — Body in --muted-fg, capped measure. */}
          {tagline ? (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: '19px',
                lineHeight: 1.55,
                color: 'var(--muted-fg)',
                margin: 0,
                maxWidth: '46ch',
              }}
            >
              {tagline}
            </p>
          ) : null}

          {/* "Available" indicator — a soft rose dot + a mono label. */}
          <p style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', ...kickerStyle }}>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--accent)',
              }}
            />
            Available for work
          </p>

          {/* CTAs — primary "Let's work together" (rose pill, var(--bg) label) + the
              secondary "Download CV" ghost pill (render-only-if-present). */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px' }}>
            <a
              href={ctaHref}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '48px',
                padding: '0 28px',
                borderRadius: 'var(--radius-full)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '16px',
                background: 'var(--accent)',
                color: 'var(--bg)',
                textDecoration: 'none',
                boxShadow: 'var(--tmpl-modal-cta-shadow)',
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
                  minHeight: '48px',
                  padding: '0 28px',
                  borderRadius: 'var(--radius-full)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '16px',
                  background: 'transparent',
                  color: 'var(--fg)',
                  border: '1px solid var(--border-strong)',
                  textDecoration: 'none',
                }}
              >
                Download CV
              </a>
            ) : null}
          </div>
        </div>

        {/* Portrait — a soft rounded frame with a thin rose border (the source's circular
            profile image, re-expressed as a Storage-origin null-guarded read). Renders
            only when a SAFE Storage-origin image is present (with the alt from
            profile.display_name context — the heading is the accessible subject). */}
        {portraitUrl ? (
          <div
            style={{
              flex: '0 0 auto',
              width: 'min(360px, 80vw)',
              height: 'min(360px, 80vw)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              border: '4px solid var(--border-strong)',
              boxShadow: '0 24px 60px -28px rgba(214, 51, 108, 0.4)',
            }}
          >
            <Image
              src={portraitUrl}
              alt={`Portrait of ${displayName}`}
              width={360}
              height={360}
              priority
              unoptimized
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
