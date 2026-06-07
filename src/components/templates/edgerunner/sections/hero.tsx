/**
 * Hero section (edgerunner section 1) — the synthwave centerpiece (translated from
 * `synthwave-founder/src/components/sections/Hero.tsx`). The SHARED `SectionProps`
 * signature + the `index.tsx` wiring are UNCHANGED. `index.tsx` already wraps this in
 * `<ScrollReveal as="section" priority>`, so this renders the hero's INNER content.
 *
 * THE WEBGL CENTERPIECE (D-04): the Hero mounts `<HoloShape />` (the plan-03 thin
 * `'use client'` `{ssr:false}` island) as the ADDITIVE WebGL focal object. The CSS
 * synthwave backdrop (sky / retro-sun / perspective grid, all from theme.css tokens) is
 * painted UNDERNEATH and makes the hero complete WITHOUT WebGL — the scene loads after
 * paint and is never a loading gap (progressive enhancement). The RSC root imports only
 * this section (never `three`/R3F/`./Scene`) — D-11.
 *
 * DATA SOURCES (null-guarded — every `public_*` view column + JSONB content is `| null`).
 * Under the frozen `SectionProps` the Hero renders from the hero CONTENT:
 *   - `content.heading`    → the big neon-gradient NAME (the seed writes
 *     `profile.display_name` into the hero heading).
 *   - `content.subheading` → the tagline / role line (Muted-Body).
 *   - `content.cta_text`   → the CTA label (defaults "Work with me").
 *   - `content.cta_url`    → the Contact anchor (empty ⇒ in-page `#contact`).
 *   - `content.resume_url` → the "Download résumé" ghost button, render-if-present.
 *
 * COLOR: no hardcoded hex for UI — UI via `var(--token)`; the only literal colors are
 * inside the documented decorative sky/sun/grid gradients (the atmospheric moment).
 */
import type { SectionProps } from './types';
import type { HeroContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { present } from './shared';

/**
 * The hero content as it flows through the section contract: `HeroContent` plus an
 * OPTIONAL `resume_url` the seed may surface from `profile.resume_url` for the
 * "Download résumé" button (D-14). Optional ⇒ the button simply hides when absent.
 */
type HeroSectionContent = HeroContent & { resume_url?: string | null };

export function Hero({ section }: SectionProps) {
  const content = (section?.content ?? null) as HeroSectionContent | null;
  if (!content) return null;

  const displayName = present(content.heading) ? content.heading : null;
  if (!displayName) return null; // hide-if-empty: nothing to anchor the hero on

  const tagline = present(content.subheading) ? content.subheading : null;
  const ctaText = present(content.cta_text) ? content.cta_text : 'Work with me';
  const ctaHref = safeHref(content.cta_url) ?? '#contact';
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
      {/* Decorative synthwave backdrop — sky glow + retro-sun arc + perspective grid.
          CSS/SVG only, reduced-motion-safe (theme.css zeroes any animation under
          prefers-reduced-motion). aria-hidden: purely atmospheric. This is the D-04
          CSS layer that paints the full aesthetic WITHOUT WebGL. */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        {/* Retro-sky sunset wash behind everything (the export's gradient-sky). */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--sky-gradient)',
            opacity: 0.4,
            maskImage: 'radial-gradient(120% 90% at 50% 30%, #000 0%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(120% 90% at 50% 30%, #000 0%, transparent 75%)',
          }}
        />
        {/* Retro-sun arc — a banded neon-gradient circle (slow spin under no-reduce). */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '34%',
            width: 'min(72vw, 460px)',
            height: 'min(72vw, 460px)',
            transform: 'translate(-50%, -50%)',
            borderRadius: 'var(--radius-full)',
            background: 'var(--neon-gradient)',
            opacity: 0.22,
            maskImage: 'repeating-linear-gradient(to bottom, #000 0 14px, transparent 14px 22px)',
            WebkitMaskImage: 'repeating-linear-gradient(to bottom, #000 0 14px, transparent 14px 22px)',
            animation: 'tmpl-edgerunner-spin 60s linear infinite',
          }}
        />
        {/* Perspective grid-horizon — converging neon hairlines, low opacity. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '38%',
            background:
              'repeating-linear-gradient(to right, var(--neon-cyan) 0 1px, transparent 1px 56px), repeating-linear-gradient(to top, var(--neon-purple) 0 1px, transparent 1px 48px)',
            opacity: 0.1,
            transform: 'perspective(420px) rotateX(62deg)',
            transformOrigin: 'bottom',
            maskImage: 'linear-gradient(to top, #000, transparent)',
            WebkitMaskImage: 'linear-gradient(to top, #000, transparent)',
          }}
        />
      </div>

      {/* Foreground content (above the backdrop). SHELLED: `.tmpl-shell` gives the
          centered column + gutter; the decorative layers stay FULL-BLEED siblings. */}
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
          {/* Mono section label `01 / intro` (neon-cyan CRT label). */}
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '18px',
              fontWeight: 400,
              lineHeight: 1.2,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color: 'var(--neon-cyan)',
              margin: 0,
            }}
          >
            01 / intro
          </p>

          {/* The big neon-gradient NAME (Orbitron, text-clipped + CRT flicker glow).
              `.tmpl-hero-name` owns the flicker animation (reduced-motion-zeroed). */}
          <h1
            className="tmpl-hero-name"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 'clamp(3rem, 7vw, 4.5rem)',
              lineHeight: 1.05,
              letterSpacing: '0.01em',
              textTransform: 'uppercase',
              margin: 0,
              backgroundImage: 'var(--neon-gradient)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}
          >
            {displayName}
          </h1>

          {/* Role line / tagline — Muted-Body. */}
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

          {/* "Available for work" status dot — neon-pink dot, gentle pulse (disabled
              under reduced-motion by theme.css's blanket reset). */}
          <p
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '16px',
              fontWeight: 400,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
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
                animation: 'tmpl-edgerunner-neon-pulse 2.4s ease-in-out infinite',
              }}
            />
            Available for work
          </p>

          {/* CTAs — primary "Work with me" (neon-pink fill, var(--bg) label) + the
              secondary "Download résumé" ghost button (render-only-if-present). */}
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
                boxShadow: '0 8px 28px -12px color-mix(in oklab, var(--neon-pink) 50%, transparent)',
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

      {/* Scroll cue at the bottom (subtle bob; static under reduced-motion). */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 'clamp(1.5rem, 5vw, 4rem)',
          bottom: '32px',
          zIndex: 1,
          color: 'var(--muted-fg)',
          animation: 'tmpl-edgerunner-float 3s ease-in-out infinite',
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
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}
