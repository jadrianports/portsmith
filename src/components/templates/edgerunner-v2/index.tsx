/**
 * The `edgerunner-v2` template ROOT — bar-for-bar synthwave transcription.
 *
 * Mirrors `edgerunner/index.tsx` structurally with these differences:
 *   - Metrics FOLDED into About (the About component receives `stats` prop
 *     computed from the metrics section items — no separate Metrics section rendered).
 *   - Section components use motion/react Tailwind classes directly (not inline CSS).
 *   - NeonDivider, SectionHeading, GlowCard, TiltCard are all bar-for-bar from export.
 *   - No Navbar or EdgerunnerEffects (not in the export's composition — lean).
 *   - SECTION ORDER (export's homepage order):
 *       Hero → ◇ → About (+ stats folded) → ◆ → Experience → ✦ →
 *       Projects → ◇ → Skills → ◇ → Services → ◆ → Contact → Footer
 *
 * SERVER COMPONENT (NO `'use client'`).
 * DARK-ONLY: `data-template-theme="dark"` hardcoded (D-06).
 * SECURITY: only `themeInitScript` + `personLdScriptHtml` use dangerouslySetInnerHTML.
 *
 * PUBLIC ISR INVARIANT (D-22): no cookies()/headers()/host-read on this path.
 */
import './theme.css';

import { orbitron, spaceGrotesk, vt323 } from './fonts';
import { ScrollReveal, themeInitScript } from '../_kit';
import { About, type StatItem } from './sections/about';
import { BlogTeaser } from './sections/blog-teaser';
import { Contact } from './sections/contact';
import { Experience } from './sections/experience';
import { Footer } from './sections/footer';
import { Hero, type HeroSocialLink } from './sections/hero';
import { Navbar, type NavItem } from './sections/navbar';
import { Projects } from './sections/projects';
import { Services } from './sections/services';
import { Skills } from './sections/skills';
import { NeonDivider } from './sections/ui/neon-divider';
import { safeHref } from '@/lib/safe-url';
import { personLdScriptHtml } from '@/lib/seo/person-jsonld';
import type { PortfolioData, PublicSection } from '../types';
import type { MetricsContent } from '@/lib/validations';

function sectionOfType(sections: PublicSection[], type: string): PublicSection | undefined {
  return sections.find((s) => s.type === type);
}

export default function EdgerunnerV2Template({ data }: { data: PortfolioData }) {
  const { profile, sections } = data;

  const fontVars = `${orbitron.variable} ${spaceGrotesk.variable} ${vt323.variable}`;

  // Person JSON-LD — server-rendered, XSS-safe
  const personLdHtml = personLdScriptHtml(data, profile.username ?? '');

  // ── Hero props ────────────────────────────────────────────────────────────
  const heroSection = sectionOfType(sections, 'hero');
  const heroEmail = data.settings.email_public ?? null;

  const heroSocials: HeroSocialLink[] = (
    [
      { label: 'GitHub',   href: safeHref(data.settings.github_url)   },
      { label: 'LinkedIn', href: safeHref(data.settings.linkedin_url) },
      { label: 'X',        href: safeHref(data.settings.twitter_url)  },
      { label: 'Dribbble', href: safeHref(data.settings.dribbble_url) },
      { label: 'Website',  href: safeHref(data.settings.website_url)  },
    ] as Array<{ label: string; href: string | undefined }>
  ).filter((s): s is HeroSocialLink => typeof s.href === 'string');

  // Terminal lines — built here (has access to skills data)
  const handle = (profile.display_name ?? profile.username ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.');
  const role = (profile.headline ?? '').trim().toLowerCase();
  const skillsContent = sectionOfType(sections, 'skills')?.content as
    | { groups?: Array<{ items?: Array<{ name?: string | null }> | null } | null> | null }
    | null
    | undefined;
  const techList = (skillsContent?.groups ?? [])
    .flatMap((g) => g?.items ?? [])
    .map((it) => (it?.name ?? '').trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5)
    .join(' · ');
  const terminalLines: Array<{ p: string; c: string; out: string }> = [
    { p: '$', c: 'whoami', out: [handle, role].filter(Boolean).join(' — ') || (handle || 'guest') },
    { p: '$', c: 'cat stack.json', out: techList || 'react · typescript · node · postgres' },
    { p: '$', c: 'uptime', out: '99.99%  ·  latency 42ms  ·  deploys 1,284' },
    { p: '$', c: 'status', out: 'available for select engagements ▌' },
  ];

  // ── About props ───────────────────────────────────────────────────────────
  // Initials from display_name
  const initials: string | null = (() => {
    const name = (profile.display_name ?? '').trim();
    if (!name) return null;
    const words = name.split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  })();

  // Metrics folded into About stats grid
  const metricsSection = sectionOfType(sections, 'metrics');
  const metricsContent = (metricsSection?.content ?? null) as MetricsContent | null;
  const metricsStats: StatItem[] = Array.isArray(metricsContent?.items)
    ? metricsContent!.items
        .filter((it) => it?.value && it?.label)
        .map((it) => ({ value: it.value, label: it.label }))
    : [];

  // ── Contact props ─────────────────────────────────────────────────────────
  const emailPublic = data.settings.email_public ?? null;

  // ── Navbar props ──────────────────────────────────────────────────────────
  // Home is always first; then one item per present section type (in page order).
  // skills section → id='stack', label='Stack' (matches the export's section id).
  const navItems: NavItem[] = [
    { id: 'hero', label: 'Home' },
    ...(sectionOfType(sections, 'about')      ? [{ id: 'about',      label: 'About'      }] : []),
    ...(sectionOfType(sections, 'experience') ? [{ id: 'experience', label: 'Experience' }] : []),
    ...(sectionOfType(sections, 'projects')   ? [{ id: 'projects',   label: 'Projects'   }] : []),
    ...(sectionOfType(sections, 'skills')     ? [{ id: 'stack',      label: 'Stack'      }] : []),
    ...(sectionOfType(sections, 'services')     ? [{ id: 'services',   label: 'Services'   }] : []),
    ...(sectionOfType(sections, 'blog_preview') ? [{ id: 'blog',       label: 'Blog'       }] : []),
    ...(sectionOfType(sections, 'contact')      ? [{ id: 'contact',    label: 'Contact'    }] : []),
  ];

  // logoText: last word of display_name uppercased (stem only — Navbar appends ".dev")
  // badge: first letter of each word joined by '_', e.g. "Kai Nakamura" → "K_N"
  // e.g. "Kai Nakamura" → logoText="NAKAMURA", badge="K_N"
  const displayName = (profile.display_name ?? profile.username ?? '').trim();
  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const logoText = nameParts.length > 0
    ? nameParts[nameParts.length - 1].toUpperCase()
    : 'PORTFOLIO';
  const logoBadge = nameParts.length >= 2
    ? nameParts.map((w) => w[0].toUpperCase()).join('_')
    : logoText.slice(0, 2);

  return (
    <div className={`tmpl-edgerunner-v2 ${fontVars}`} data-template-root data-template-theme="dark">
      {/* FOUC guard — hardcoded 'dark' (D-06) */}
      <script dangerouslySetInnerHTML={{ __html: themeInitScript('dark') }} />

      {/* Person JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: personLdHtml }} />

      {/* Sticky pill navbar — first child, above ambient bg + main */}
      <Navbar items={navItems} logoText={logoText} badge={logoBadge} />

      {/* Page-wide ambient background */}
      <div aria-hidden="true" className="tmpl-ambient-bg" style={{ pointerEvents: 'none' }} />

      <main>
        {/* ── Hero (LCP — priority, zero entrance motion) ──────────────────── */}
        <ScrollReveal as="section" priority data-section-type="hero">
          <div id="hero">
            <Hero
              section={heroSection}
              email={heroEmail}
              socials={heroSocials}
              terminalLines={terminalLines}
            />
          </div>
        </ScrollReveal>

        <NeonDivider glyph="◇" />

        {/* ── About + stats (metrics folded in) ────────────────────────────── */}
        <ScrollReveal as="section" data-section-type="about">
          <div id="about">
            <About
              section={sectionOfType(sections, 'about')}
              initials={initials}
              stats={metricsStats}
            />
          </div>
        </ScrollReveal>

        <NeonDivider glyph="◆" />

        {/* ── Experience ───────────────────────────────────────────────────── */}
        <ScrollReveal as="section" data-section-type="experience">
          <div id="experience">
            <Experience section={sectionOfType(sections, 'experience')} />
          </div>
        </ScrollReveal>

        <NeonDivider glyph="✦" />

        {/* ── Projects ─────────────────────────────────────────────────────── */}
        <ScrollReveal as="section" data-section-type="projects">
          <div id="projects">
            <Projects section={sectionOfType(sections, 'projects')} />
          </div>
        </ScrollReveal>

        <NeonDivider glyph="◇" />

        {/* ── Skills / Stack (id="stack" matches the export's section id) ────── */}
        <ScrollReveal as="section" data-section-type="skills">
          <div id="stack">
            <Skills section={sectionOfType(sections, 'skills')} />
          </div>
        </ScrollReveal>

        <NeonDivider glyph="◇" />

        {/* ── Services ─────────────────────────────────────────────────────── */}
        <ScrollReveal as="section" data-section-type="services">
          <div id="services">
            <Services section={sectionOfType(sections, 'services')} />
          </div>
        </ScrollReveal>

        <NeonDivider glyph="◇" />

        {/* ── Blog teaser / Transmissions ──────────────────────────────────── */}
        <ScrollReveal as="section" data-section-type="blog_preview">
          <div id="blog">
            <BlogTeaser
              section={sectionOfType(sections, 'blog_preview')}
              username={profile.username}
            />
          </div>
        </ScrollReveal>

        <NeonDivider glyph="◆" />

        {/* ── Contact ──────────────────────────────────────────────────────── */}
        <ScrollReveal as="section" data-section-type="contact">
          <div id="contact">
            <Contact
              section={sectionOfType(sections, 'contact')}
              emailPublic={emailPublic}
            />
          </div>
        </ScrollReveal>
      </main>

      <Footer data={data} />
    </div>
  );
}
