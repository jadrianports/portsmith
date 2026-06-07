/**
 * Hero section (edgerunner section 1) — faithful 2-column synthwave hero
 * (translated from `synthwave-founder/src/components/sections/Hero.tsx`).
 *
 * LAYOUT: a full-bleed positioned root with:
 *   - `<CityScene />` as the absolute backdrop (zIndex:0)
 *   - a foreground `.tmpl-shell` container (zIndex:1) with a 2-column grid:
 *       LEFT  — "System online" label → flickering Orbitron NAME (pink) →
 *                GRADIENT role line (cyan→pink) → muted tagline →
 *                contact pill (email) + social icon row →
 *                "Available for work" status dot → NeonLink CTAs
 *       RIGHT  — `<TerminalCard lines={...} />` (hidden below lg, same as export)
 *
 * DATA SOURCES (null-guarded — every `public_*` view column + JSONB content is `| null`):
 *   - `content.heading`    → the big pink flickering NAME (hide-if-empty anchor)
 *   - `content.subheading` → split on " · ": part[0] = gradient role line (Orbitron),
 *                            part[1] = muted tagline; if no "·", full text is the tagline.
 *   - `content.cta_text`   → CTA label (defaults "Get in touch")
 *   - `content.cta_url`    → Contact anchor (empty → in-page `#contact`)
 *   - `content.resume_url` → "Download CV" ghost NeonLink (render-if-present)
 *   - `email`              → optional prop from index.tsx (data.settings.email_public)
 *   - `socials`            → optional prop from index.tsx (github/linkedin/twitter/etc.)
 *
 * TRANSLATION NOTES:
 *   R1  framer-motion entrance animations removed (R5: ZERO entrance motion on LCP).
 *       The name's neon flicker (`.tmpl-hero-name`) is decorative CSS — OK.
 *   R3  All colors/fonts/radii via scoped `var(--token)` from theme.css — no hex.
 *   R5  LCP/priority section → no entrance motion; content paints immediately.
 *   R6  Server Component — CityScene is a Server Component; TerminalCard is a
 *       client island imported here without 'use client' on this file.
 *       Lucide icon imports are fine in Server Components (they're just SVGs).
 *   R7  safeHref on every URL; no dangerouslySetInnerHTML, no inline on* strings.
 */
import type { SectionProps } from './types';
import type { HeroContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { present } from './shared';
import { CityScene } from './city-scene';
import { TerminalCard } from './terminal-card';
import { NeonLink } from './ui/neon-button';
import { Globe, Mail } from 'lucide-react';

/** Hero content — `resume_url` is already on `HeroContent` (heroContentSchema). */
type HeroSectionContent = HeroContent & { resume_url?: string | null };

/** A social link with label + href (pre-validated by safeHref in index.tsx). */
export interface HeroSocialLink {
  label: string;
  href: string;
}

/** Extra props threaded from index.tsx — additive optionals, do not break conformance. */
export interface HeroExtraProps {
  email?: string | null;
  socials?: HeroSocialLink[];
}

/**
 * Social icon SVG — inline brand SVG paths for GitHub/LinkedIn/X/Dribbble,
 * lucide Globe for Website/fallback. All aria-hidden (parent <a> has aria-label).
 * Using inline SVGs because lucide-react's installed version omits brand icons.
 */
function SocialIcon({ label }: { label: string }) {
  const l = label.toLowerCase();

  if (l === 'github') {
    return (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    );
  }

  if (l === 'linkedin') {
    return (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
  }

  if (l === 'x' || l === 'twitter') {
    return (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L2.25 2.25h6.865l4.264 5.635 5.865-5.635zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
      </svg>
    );
  }

  if (l === 'dribbble') {
    return (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.51 0 10-4.48 10-10S17.51 2 12 2zm6.605 4.61a8.502 8.502 0 011.93 5.314c-.281-.054-3.101-.629-5.943-.271-.065-.141-.12-.293-.184-.445a25.424 25.424 0 00-.564-1.236c3.145-1.28 4.577-3.124 4.761-3.362zM12 3.475c2.17 0 4.154.813 5.662 2.148-.152.216-1.443 1.941-4.48 3.08-1.399-2.57-2.95-4.675-3.189-5A8.687 8.687 0 0112 3.475zm-3.633.803a53.896 53.896 0 013.167 4.935c-3.992 1.063-7.517 1.04-7.896 1.04a8.581 8.581 0 014.729-5.975zM3.453 12.01v-.26c.37.01 4.512.065 8.775-1.215.25.477.477.965.694 1.453-.109.033-.228.065-.336.098-4.404 1.42-6.747 5.303-6.942 5.629a8.522 8.522 0 01-2.19-5.705zM12 20.547a8.482 8.482 0 01-5.239-1.8c.152-.315 1.888-3.656 6.703-5.337.022-.01.033-.01.054-.022a35.32 35.32 0 011.823 6.475 8.4 8.4 0 01-3.341.684zm4.761-1.465c-.086-.52-.542-3.015-1.659-6.084 2.679-.423 5.022.271 5.314.369a8.468 8.468 0 01-3.655 5.715z" />
      </svg>
    );
  }

  // website / fallback — lucide Globe (confirmed exported in this lucide version)
  return <Globe size={16} aria-hidden="true" />;
}

export function Hero({ section, email, socials }: SectionProps & HeroExtraProps) {
  const content = (section?.content ?? null) as HeroSectionContent | null;
  if (!content) return null;

  // hide-if-empty: the display name is the non-negotiable hero anchor.
  const displayName = present(content.heading) ? content.heading : null;
  if (!displayName) return null;

  // Two-tier title split: subheading on " · " → [role line, tagline].
  // If no separator, treat the whole subheading as the muted tagline (no gradient line).
  const rawSubheading = present(content.subheading) ? content.subheading! : null;
  let roleLine: string | null = null;
  let tagline: string | null = null;
  if (rawSubheading) {
    const parts = rawSubheading.split(' · ');
    if (parts.length >= 2) {
      roleLine = parts[0].trim();
      tagline = parts.slice(1).join(' · ').trim();
    } else {
      tagline = rawSubheading.trim();
    }
  }

  const ctaText = present(content.cta_text) ? content.cta_text : 'Get in touch';
  const ctaHref = safeHref(content.cta_url) ?? '#contact';
  const resumeUrl = safeHref(content.resume_url) ?? null;

  // Safe email href (allowMailto required)
  const emailHref =
    email && present(email) ? safeHref(`mailto:${email}`, { allowMailto: true }) ?? null : null;

  // Filtered socials list — only those with valid hrefs
  const socialLinks = (socials ?? []).filter((s) => !!s.href);

  // Terminal lines — built from the real content values.
  // Only include lines whose values are present; filter(Boolean) removes nulls.
  const subheadingForTerminal = roleLine ?? tagline;
  const terminalLines = [
    '> whoami',
    displayName,
    subheadingForTerminal ? '> role --current' : null,
    subheadingForTerminal ?? null,
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
            {/* "// SYSTEM ONLINE" mono label — static chrome, faithful to the export. */}
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
              <span>// System online</span>
            </div>

            {/*
             * Two-tier title block (faithful to the reference):
             *   LINE 1: big pink flickering NAME (Orbitron, tmpl-hero-name CSS flicker)
             *   LINE 2: big cyan→pink GRADIENT role line (Orbitron, bg-clip text)
             * Both are spans inside the h1 so the heading hierarchy is correct.
             * NO entrance motion (R5 — this is the LCP element).
             */}
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
                lineHeight: 0.95,
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              {/* NAME — pink glow flicker (CSS animation from theme.css) */}
              <span
                className="tmpl-hero-name"
                style={{
                  display: 'block',
                  color: 'var(--neon-pink)',
                  textShadow:
                    '0 0 8px var(--neon-pink), 0 0 24px color-mix(in oklab, var(--neon-pink) 50%, transparent)',
                }}
              >
                {displayName}
              </span>

              {/* ROLE LINE — big cyan→pink gradient (render-if-present) */}
              {roleLine ? (
                <span
                  style={{
                    display: 'block',
                    marginTop: '0.15em',
                    backgroundImage: 'var(--neon-gradient)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                  }}
                >
                  {roleLine}
                </span>
              ) : null}
            </h1>

            {/* Muted tagline — smaller body copy below the two-tier title (present-guarded). */}
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

            {/* Contact pill + social icon row (faithful to the reference) —
                email pill (render-if-present) + circular neon social icons.
                Both rows share a wrapping flex row to stay visually grouped. */}
            {(emailHref || socialLinks.length > 0) ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '12px',
                  margin: 0,
                }}
              >
                {/* Email pill — neon-pink border, mono, mailto link */}
                {emailHref ? (
                  <a
                    href={emailHref}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid color-mix(in oklab, var(--neon-pink) 30%, transparent)',
                      background: 'color-mix(in srgb, var(--bg) 40%, transparent)',
                      backdropFilter: 'blur(8px)',
                      padding: '6px 12px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      color: 'var(--fg)',
                      textDecoration: 'none',
                    }}
                  >
                    <Mail size={14} aria-hidden="true" style={{ color: 'var(--neon-pink)', flexShrink: 0 }} />
                    {email}
                  </a>
                ) : null}

                {/* Social icon row — small circular neon-border buttons */}
                {socialLinks.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {socialLinks.map((s) => (
                      <a
                        key={s.label}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.label}
                        style={{
                          display: 'grid',
                          placeItems: 'center',
                          width: '36px',
                          height: '36px',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid color-mix(in oklab, var(--neon-cyan) 30%, transparent)',
                          color: 'var(--muted-fg)',
                          textDecoration: 'none',
                          transition: 'border-color 140ms ease, color 140ms ease, box-shadow 140ms ease',
                        }}
                        className="tmpl-social-icon-btn"
                      >
                        <SocialIcon label={s.label} />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
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
