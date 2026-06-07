/**
 * The `edgerunner-v2` template ROOT — bar-for-bar synthwave transcription.
 *
 * Structurally mirrors `edgerunner/index.tsx`:
 *   - SERVER COMPONENT (NO `'use client'`)
 *   - DARK-ONLY: `data-template-theme="dark"` hardcoded (D-06)
 *   - `themeInitScript('dark')` FOUC guard
 *   - Person JSON-LD server-rendered
 *   - `tmpl-edgerunner-v2` root class
 *   - fontVars from fonts.ts (Orbitron + Space Grotesk + VT323)
 *   - Page-wide ambient background blob
 *   - ONLY Hero rendered (spec.ts: only hero supported:true — verify before expanding)
 *
 * SECURITY (T-13-04-XSS): the only two dangerouslySetInnerHTML producers are
 * `themeInitScript` (coerced 'dark' enum only) and `personLdScriptHtml` (escapes
 * HTML/JS breakout chars). Both on the gate:security allowlist.
 */
import './theme.css';

import { orbitron, spaceGrotesk, vt323 } from './fonts';
import { ScrollReveal, themeInitScript } from '../_kit';
import { Hero, type HeroSocialLink } from './sections/hero';
import { safeHref } from '@/lib/safe-url';
import { personLdScriptHtml } from '@/lib/seo/person-jsonld';
import type { PortfolioData } from '../types';

export default function EdgerunnerV2Template({ data }: { data: PortfolioData }) {
  const { profile, sections } = data;

  const fontVars = `${orbitron.variable} ${spaceGrotesk.variable} ${vt323.variable}`;

  // Person JSON-LD — server-rendered, XSS-safe
  const personLdHtml = personLdScriptHtml(data, profile.username ?? '');

  // Find the hero section
  const heroSection = sections.find((s) => s.type === 'hero');

  // Build hero socials — same order as edgerunner
  const heroSocials: HeroSocialLink[] = (
    [
      { label: 'GitHub',   href: safeHref(data.settings.github_url)   },
      { label: 'LinkedIn', href: safeHref(data.settings.linkedin_url) },
      { label: 'X',        href: safeHref(data.settings.twitter_url)  },
      { label: 'Dribbble', href: safeHref(data.settings.dribbble_url) },
      { label: 'Website',  href: safeHref(data.settings.website_url)  },
    ] as Array<{ label: string; href: string | undefined }>
  ).filter((s): s is HeroSocialLink => typeof s.href === 'string');

  const heroEmail = data.settings.email_public ?? null;

  return (
    <div className={`tmpl-edgerunner-v2 ${fontVars}`} data-template-root data-template-theme="dark">
      {/* FOUC guard — hardcoded 'dark' (D-06) */}
      <script dangerouslySetInnerHTML={{ __html: themeInitScript('dark') }} />

      {/* Person JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: personLdHtml }} />

      {/* Page-wide ambient background — three large neon radial blobs */}
      <div
        aria-hidden="true"
        className="tmpl-ambient-bg"
        style={{ pointerEvents: 'none' }}
      />

      <main>
        {/* ── Hero (LCP — priority: static wrapper, zero entrance motion from ScrollReveal) ── */}
        <ScrollReveal as="section" priority data-section-type="hero">
          <div id="hero">
            <Hero
              section={heroSection}
              email={heroEmail}
              socials={heroSocials}
            />
          </div>
        </ScrollReveal>
      </main>
    </div>
  );
}
