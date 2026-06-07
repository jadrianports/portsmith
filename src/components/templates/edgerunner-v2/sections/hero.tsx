'use client';
/**
 * Hero section — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/components/sections/Hero.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout/sizing/typography Tailwind classes COPIED VERBATIM from export JSX.
 *   2. Color/background/border Tailwind utilities converted to inline style={{ ... }}
 *      with exact scoped var(--token):
 *        text-neon-cyan/90  → style={{color:'color-mix(in oklab, var(--neon-cyan) 90%, transparent)'}}
 *        bg-neon-cyan       → style={{background:'var(--neon-cyan)'}}
 *        text-foreground/80 → style={{color:'color-mix(in oklab, var(--fg) 80%, transparent)'}}
 *        text-foreground/85 → style={{color:'color-mix(in oklab, var(--fg) 85%, transparent)'}}
 *        border-neon-pink/30 → style={{borderColor:'color-mix(in oklab, var(--neon-pink) 30%, transparent)'}}
 *        border-neon-cyan/30 → style={{borderColor:'color-mix(in oklab, var(--neon-cyan) 30%, transparent)'}}
 *        border-neon-purple/30 → style={{borderColor:'color-mix(in oklab, var(--neon-purple) 30%, transparent)'}}
 *        bg-background/40   → style={{background:'color-mix(in srgb, var(--bg) 40%, transparent)'}}
 *        text-neon-pink     → style={{color:'var(--neon-pink)'}}
 *        text-neon-cyan     → style={{color:'var(--neon-cyan)'}}
 *        text-neon-purple   → style={{color:'var(--neon-purple)'}}
 *        hover:border-neon-pink / hover:text-neon-pink / hover:shadow-neon-pink → .tmpl-social-icon-btn (theme.css)
 *   3. Custom CSS classes (text-glow-pink, font-mono-retro, font-display, animate-flicker,
 *      bg-gradient-neon, holo-panel, shadow-neon-pink) KEPT AS-IS (scoped in theme.css).
 *   4. framer-motion → motion/react. ALL motion values (initial/animate/transition) VERBATIM.
 *   5. DATA BINDING: profile.* → PortfolioData props:
 *        profile.name → content.heading (hero section content)
 *        profile.title → roleLine (first part of content.subheading split on ' · ')
 *        profile.tagline → tagline (second part of content.subheading, or full subheading)
 *        profile.email → email prop (data.settings.email_public)
 *        socials → socials prop (from settings social URLs, pre-validated by safeHref)
 *        profile.cvUrl → content.resume_url (safeHref validated)
 *   6. Contact pills: email pill kept; phone/location pills OMITTED (no data for them —
 *      they only render when email is present, keeping the row structure).
 *   7. CTAs: "Download CV" + "View Projects" — EXACT labels from export (not "Work with me")
 *   8. TerminalCard: EXACT titlebar text `~/portfolio — zsh`, built from real data.
 *   9. 'use client' required for motion/react animations.
 */
import { motion } from 'motion/react';
import { Mail, Download, ArrowDown } from 'lucide-react';
import { CityScene } from './city-scene';
import { TerminalCard } from './terminal-card';
import { Magnetic } from './ui/magnetic';
import { NeonLink } from './ui/neon-button';
import { safeHref } from '@/lib/safe-url';
import { present } from './shared';
import type { SectionProps } from './types';
import type { HeroContent } from '@/lib/validations';
import { Globe } from 'lucide-react';

/** Hero content — resume_url is on HeroContent */
type HeroSectionContent = HeroContent & { resume_url?: string | null };

/** A social link with label + href (pre-validated by safeHref in index.tsx) */
export interface HeroSocialLink {
  label: string;
  href: string;
}

export interface HeroExtraProps {
  email?: string | null;
  socials?: HeroSocialLink[];
  /** Terminal lines, built in index.tsx (which has the skills data for the stack list). */
  terminalLines?: Array<{ p: string; c: string; out: string }>;
}

/**
 * Inline brand SVG icons — used for the social icon row.
 * Matches the export's social icon pattern (react-icons → inline SVG, lucide Globe fallback).
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
  return <Globe size={16} aria-hidden="true" />;
}

export function Hero({ section, email, socials, terminalLines }: SectionProps & HeroExtraProps) {
  const content = (section?.content ?? null) as HeroSectionContent | null;
  if (!content) return null;

  // Display name — the hero anchor; hide-if-empty
  const displayName = present(content.heading) ? content.heading : null;
  if (!displayName) return null;

  // Two-tier title: subheading on ' · ' → [role line (gradient), tagline (muted)]
  // Mirrors the export: profile.title (gradient line) + profile.tagline (muted para)
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

  const resumeUrl = safeHref(content.resume_url) ?? null;
  const emailHref =
    email && present(email) ? safeHref(`mailto:${email}`, { allowMailto: true }) ?? null : null;
  const socialLinks = (socials ?? []).filter((s) => !!s.href);

  // Terminal lines come from index.tsx (it has the skills data for the stack list).
  // Fallback to a minimal whoami line if not provided.
  const termLines =
    terminalLines && terminalLines.length > 0
      ? terminalLines
      : [{ p: '$', c: 'whoami', out: displayName }];

  return (
    <section
      id="hero"
      className="relative flex min-h-screen items-center justify-center overflow-hidden pt-28 pb-24"
    >
      {/* city backdrop with animated beams + sun glow */}
      <CityScene />

      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div>
          {/* "System online" label — VERBATIM from export */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3 font-mono-retro"
            style={{ color: 'color-mix(in oklab, var(--neon-cyan) 90%, transparent)' }}
          >
            <span
              className="h-px w-12"
              style={{ background: 'var(--neon-cyan)' }}
            />
            <span className="uppercase tracking-[0.4em] text-base">System online</span>
          </motion.div>

          {/* Hero headline — VERBATIM classes from export */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="mt-4 font-display text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl"
          >
            {/* NAME — text-glow-pink animate-flicker (scoped CSS classes) */}
            <span className="block text-glow-pink animate-flicker">{displayName}</span>

            {/* ROLE LINE — bg-clip gradient (render-if-present) */}
            {roleLine ? (
              <span
                className="mt-2 block bg-clip-text text-transparent"
                style={{ backgroundImage: 'var(--gradient-neon)' }}
              >
                {roleLine}
              </span>
            ) : null}
          </motion.h1>

          {/* Tagline — VERBATIM classes from export */}
          {tagline ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-6 max-w-xl text-lg sm:text-xl"
              style={{ color: 'color-mix(in oklab, var(--fg) 80%, transparent)' }}
            >
              {tagline}
            </motion.p>
          ) : null}

          {/* Contact pills row — VERBATIM structure from export
              Phone/location pills OMITTED (no data); email pill kept when present. */}
          {emailHref ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="mt-6 flex flex-wrap gap-3 text-sm"
              style={{ color: 'color-mix(in oklab, var(--fg) 85%, transparent)' }}
            >
              <a
                href={emailHref}
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur"
                style={{
                  border: '1px solid color-mix(in oklab, var(--neon-pink) 30%, transparent)',
                  background: 'color-mix(in srgb, var(--bg) 40%, transparent)',
                  color: 'color-mix(in oklab, var(--fg) 85%, transparent)',
                  textDecoration: 'none',
                }}
              >
                <Mail className="h-4 w-4" style={{ color: 'var(--neon-pink)' }} /> {email}
              </a>
            </motion.div>
          ) : null}

          {/* CTAs + socials row — VERBATIM structure from export */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            {resumeUrl ? (
              <Magnetic>
                <NeonLink href={resumeUrl} variant="primary" external>
                  <Download className="h-4 w-4" /> Download CV
                </NeonLink>
              </Magnetic>
            ) : (
              <Magnetic>
                <NeonLink href="#contact" variant="primary">
                  Get in touch
                </NeonLink>
              </Magnetic>
            )}

            <Magnetic>
              <NeonLink href="#projects" variant="outline">
                View Projects <ArrowDown className="h-4 w-4" />
              </NeonLink>
            </Magnetic>

            {/* Social icon row — VERBATIM from export (hover classes → .tmpl-social-icon-btn) */}
            {socialLinks.length > 0 ? (
              <div className="ml-1 flex items-center gap-3">
                {socialLinks.map(({ label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="grid h-10 w-10 place-items-center rounded-full tmpl-social-icon-btn"
                    style={{
                      border: '1px solid color-mix(in oklab, var(--neon-cyan) 30%, transparent)',
                      color: 'color-mix(in oklab, var(--fg) 80%, transparent)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <SocialIcon label={label} />
                  </a>
                ))}
              </div>
            ) : null}
          </motion.div>
        </div>

        {/* Terminal HUD — VERBATIM structure from export (hidden below lg) */}
        <div className="relative hidden lg:flex lg:justify-end">
          <TerminalCard lines={termLines} />
        </div>
      </div>
    </section>
  );
}
