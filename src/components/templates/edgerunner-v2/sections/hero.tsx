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
import { SocialIcon } from './ui/social-icon';
import { safeHref } from '@/lib/safe-url';
import { present } from './shared';
import type { SectionProps } from './types';
import type { HeroContent } from '@/lib/validations';

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
