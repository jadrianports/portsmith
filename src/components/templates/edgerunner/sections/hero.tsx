/**
 * Hero section (edgerunner section 1) — faithful 2-column synthwave hero
 * (translated from `synthwave-founder/src/components/sections/Hero.tsx`).
 *
 * LAYOUT: a full-bleed positioned root with:
 *   - `<CityScene />` as the absolute backdrop (zIndex:0)
 *   - a foreground `.tmpl-shell` container (zIndex:1) with a 2-column grid:
 *       LEFT  — "System online" label → flickering Orbitron name → role →
 *                "Available for work" status dot → NeonLink CTAs
 *       RIGHT  — `<TerminalCard lines={...} />` (hidden below lg, same as export)
 *
 * DATA SOURCES (null-guarded — every `public_*` view column + JSONB content is `| null`):
 *   - `content.heading`    → the big neon-gradient NAME (hide-if-empty anchor)
 *   - `content.subheading` → the role / tagline (muted body, present-guarded)
 *   - `content.cta_text`   → CTA label (defaults "Get in touch")
 *   - `content.cta_url`    → Contact anchor (empty → in-page `#contact`)
 *   - `content.resume_url` → "Download CV" ghost NeonLink (render-if-present)
 *
 * TRANSLATION NOTES:
 *   R1  framer-motion entrance animations removed (R5: ZERO entrance motion on LCP).
 *       The name's neon flicker (`.tmpl-hero-name`) is decorative CSS — OK.
 *   R3  All colors/fonts/radii via scoped `var(--token)` from theme.css — no hex.
 *   R5  LCP/priority section → no entrance motion; content paints immediately.
 *   R6  Server Component — CityScene is a Server Component; TerminalCard is a
 *       client island imported here without 'use client' on this file.
 *   R7  safeHref on every URL; no dangerouslySetInnerHTML, no inline on* strings.
 *
 * The export's contact pills (email/phone/location) and social row are NOT reproduced
 * — `public_profiles` does not expose that data (it belongs to the Contact section).
 */
import type { SectionProps } from './types';
import type { HeroContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { present } from './shared';
import { CityScene } from './city-scene';
import { TerminalCard } from './terminal-card';
import { NeonLink } from './ui/neon-button';

/** Hero content — `resume_url` is already on `HeroContent` (heroContentSchema). */
type HeroSectionContent = HeroContent & { resume_url?: string | null };

export function Hero({ section }: SectionProps) {
  const content = (section?.content ?? null) as HeroSectionContent | null;
  if (!content) return null;

  // hide-if-empty: the display name is the non-negotiable hero anchor.
  const displayName = present(content.heading) ? content.heading : null;
  if (!displayName) return null;

  const tagline = present(content.subheading) ? content.subheading : null;
  const ctaText = present(content.cta_text) ? content.cta_text : 'Get in touch';
  const ctaHref = safeHref(content.cta_url) ?? '#contact';
  const resumeUrl = safeHref(content.resume_url) ?? null;

  // Terminal lines — built from the real content values.
  // Only include lines whose values are present; filter(Boolean) removes nulls.
  const terminalLines = [
    '> whoami',
    displayName,
    tagline ? '> role --current' : null,
    tagline ?? null,
    '> status',
    '● available for work',
    '> uptime --mode=creative',
    '100% committed',
  ].filter(Boolean) as string[];

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '92vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* ── Backdrop: CityScene (absolute, zIndex:0) ── */}
      {/* CityScene is a Server Component; it self-positions as position:absolute inset:0. */}
      <CityScene />

      {/* ── Foreground content (position:relative, zIndex:1) ── */}
      <div
        className="tmpl-shell"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          paddingBlock: 'clamp(64px, 10vh, 96px)',
        }}
      >
        {/*
         * 2-column grid — mirrors the export's `lg:grid-cols-[1.4fr_1fr]`.
         * On mobile: single column (terminal card hidden via display:none / lg:flex).
         * On lg+: side-by-side with items aligned to center.
         * Pure Tailwind classes for the grid so responsive overrides work without
         * inline-style specificity conflicts.
         */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-center">
          {/* ══ LEFT COLUMN ══════════════════════════════════════════════ */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            {/* "System online" mono label — static chrome, faithful to the export. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                fontWeight: 400,
                textTransform: 'uppercase',
                letterSpacing: '0.4em',
                color: 'var(--neon-cyan)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  height: '1px',
                  width: '48px',
                  background: 'var(--neon-cyan)',
                  flexShrink: 0,
                }}
              />
              <span>System online</span>
            </div>

            {/* The big neon-gradient NAME (Orbitron, background-clip text).
                `.tmpl-hero-name` owns the `tmpl-edgerunner-flicker` animation
                (defined in theme.css, reduced-motion-zeroed by the blanket reset).
                NO entrance motion (R5 — this is the LCP element). */}
            <h1
              className="tmpl-hero-name"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(3rem, 7vw, 5rem)',
                lineHeight: 0.95,
                letterSpacing: '-0.01em',
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

            {/* Role / tagline — muted body copy (present-guarded). */}
            {tagline ? (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize: '18px',
                  lineHeight: 1.55,
                  color: 'var(--muted-fg)',
                  margin: 0,
                  maxWidth: '50ch',
                }}
              >
                {tagline}
              </p>
            ) : null}

            {/* "Available for work" status line — neon-pink pulsing dot + mono label.
                The dot animation is `tmpl-edgerunner-neon-pulse` (theme.css, reduced-motion-zeroed).
                This is decorative static copy — not data-driven (no public profile status field). */}
            <p
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                fontWeight: 400,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
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
                  background: 'var(--neon-pink)',
                  boxShadow: '0 0 8px var(--neon-pink)',
                  animation: 'tmpl-edgerunner-neon-pulse 2.4s ease-in-out infinite',
                  flexShrink: 0,
                }}
              />
              Available for work
            </p>

            {/* CTAs — faithful to the export (Magnetic stripped; NeonLink server component).
                Primary:   ctaText → ctaHref     (neon gradient fill)
                Secondary: "View Projects" → #projects  (outline)
                Ghost:     "Download CV" → resumeUrl    (render-if-present, external) */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '16px',
                marginTop: '8px',
              }}
            >
              <NeonLink href={ctaHref} variant="primary">
                {ctaText}
              </NeonLink>

              <NeonLink href="#projects" variant="outline">
                View Projects
              </NeonLink>

              {resumeUrl ? (
                <NeonLink href={resumeUrl} variant="ghost" external>
                  Download CV
                </NeonLink>
              ) : null}
            </div>
          </div>

          {/* ══ RIGHT COLUMN — TerminalCard HUD ══════════════════════════
              Faithful to the export's `hidden lg:flex lg:justify-end`.
              TerminalCard is a 'use client' island; this file stays a Server Component.
              NOTE: `hidden` (display:none) + `lg:flex` are Tailwind utilities that match
              the chrome Tailwind scan. Using className-only (no inline display) so the
              Tailwind responsive variant can override without specificity conflict. */}
          <div className="hidden lg:flex lg:justify-end">
            <TerminalCard lines={terminalLines} />
          </div>
        </div>
      </div>

      {/* Scroll cue — a subtle downward chevron (static under reduced-motion). */}
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
