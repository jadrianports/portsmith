/**
 * The `edgerunner` template ROOT — the faithful synthwave single-scroll composition.
 * Translated from `lovable-exports/synthwave-founder/` (dark synthwave developer design),
 * mapped onto the Portsmith template engine (D-02 faithful ingest — translate-not-redesign).
 * Mirrors `minimal`/`aurora` index.tsx STRUCTURALLY; deviates ONLY in the scoped theme
 * (`.tmpl-edgerunner`, DARK-ONLY), the fonts (Orbitron + Space Grotesk + VT323), the
 * 7-section set, the NeonDividers between major sections, and — the single structural
 * deviation — NO `ThemeToggle` (D-06).
 *
 * A SERVER COMPONENT (NO `'use client'`): the entire template tree is server-rendered.
 * The ONLY client JS is the kit `ScrollReveal` island, the `<CityScene>` WebGL island
 * (mounted INSIDE the Hero — NOT here), `<EdgerunnerEffects>` (PowerOnFlash + CursorTrail),
 * `<Navbar>` (scroll-spy IntersectionObserver + mobile toggle), and `<NeonDivider>` (motion
 * scale-in). Reached lazily via the registry (`dynamic(() => import('./edgerunner'))`).
 *
 * SECTION ORDER (the export's `Index.tsx` single scroll, minus the dropped Blog):
 * hero → NeonDivider(◇) → about → metrics → NeonDivider(◆) → experience →
 * NeonDivider(✦) → projects → NeonDivider(◇) → skills → NeonDivider(◆) →
 * services → NeonDivider(✦) → contact.
 * Metrics follows About with NO divider between them (they read as one block in the export).
 * Each section is a `<ScrollReveal as="section" data-section-type="<type>">` with a
 * nested `<div id="<type>">` so nav anchor links resolve (ScrollReveal does not forward
 * an `id` prop — the inner div is the designated anchor target). Hero gets `priority`
 * (LCP element — ZERO entrance motion).
 *
 * DARK-ONLY (D-06): `data-template-theme="dark"` is HARDCODED (NOT `settings.theme_mode`
 * — the emissive neon look depends on a dark canvas); `themeInitScript('dark')` is injected
 * for the FOUC guard; the kit `ThemeToggle` is DELIBERATELY NOT imported or mounted.
 *
 * SECURITY (T-13-04-XSS): the ONLY two `dangerouslySetInnerHTML` producers are the FOUC
 * `themeInitScript` (interpolating only the coerced `'dark'` enum) and the server-rendered
 * Person JSON-LD (`personLdScriptHtml`, which ESCAPES the HTML/JS breakout characters).
 * Both are on the `gate:security` allowlist; NO free-form / user-controlled HTML is injected.
 *
 * NAV ITEMS: computed from the sections actually present in the portfolio (so the nav only
 * links to existing sections). Hero and Metrics are excluded from the nav — hero is the
 * page top (logo already links there), metrics reads as part of the about block.
 */
import './theme.css';

import { orbitron, spaceGrotesk, vt323 } from './fonts';
import { ScrollReveal, themeInitScript } from '../_kit';
import { EdgerunnerEffects } from './effects';
import { About } from './sections/about';
import { Contact } from './sections/contact';
import { Experience } from './sections/experience';
import { Footer } from './sections/footer';
import { Hero, type HeroSocialLink } from './sections/hero';
import { Metrics } from './sections/metrics';
import { Navbar } from './sections/navbar';
import { Projects } from './sections/projects';
import { Services } from './sections/services';
import { Skills } from './sections/skills';
import { NeonDivider } from './sections/ui/neon-divider';
import { safeHref } from '@/lib/safe-url';
import { personLdScriptHtml } from '@/lib/seo/person-jsonld';
import type { PortfolioData, PublicSection } from '../types';

/**
 * Resolve the single visible section of a given `type` from the pre-sorted
 * `data.sections`. The view Row's `type` is `string | null`, so the match is a plain
 * equality; returns `undefined` when the portfolio has no section of that type (the
 * section then renders `null`). Copied verbatim from minimal/aurora.
 */
function sectionOfType(sections: PublicSection[], type: string): PublicSection | undefined {
  return sections.find((s) => s.type === type);
}

/**
 * Label map for nav-item generation. Hero and Metrics are excluded:
 * hero → the logo badge already links to #hero; metrics → reads as part of about.
 */
const NAV_LABEL_MAP: Record<string, string> = {
  about: 'About',
  experience: 'Experience',
  projects: 'Projects',
  skills: 'Stack',
  services: 'Services',
  contact: 'Contact',
};

export default function EdgerunnerTemplate({ data }: { data: PortfolioData }) {
  const { profile, sections } = data;

  const fontVars = `${orbitron.variable} ${spaceGrotesk.variable} ${vt323.variable}`;

  // SEO-01: the data-driven Person JSON-LD, rendered server-side via the XSS-safe
  // `<script>` serializer (escapes `<`/`>`/`&` + U+2028/U+2029), NOT raw JSON.stringify.
  // `?? ''` null-guards the nullable username view column.
  const personLdHtml = personLdScriptHtml(data, profile.username ?? '');

  // Compute nav items from the sections actually present in the portfolio.
  // Only include types in NAV_LABEL_MAP (excludes hero and metrics).
  const navItems = Object.entries(NAV_LABEL_MAP)
    .filter(([type]) => sections.some((s) => s.type === type))
    .map(([id, label]) => ({ id, label }));

  const logoText = profile.display_name ?? profile.username ?? 'Portfolio';

  // Build the hero socials array from settings social URLs.
  // Only include URLs that pass safeHref (http/https only — no javascript: etc).
  // Order matches the reference: GitHub → LinkedIn → X/Twitter → Dribbble → Website.
  const heroSocials: HeroSocialLink[] = (
    [
      { label: 'GitHub',   href: safeHref(data.settings.github_url)   },
      { label: 'LinkedIn', href: safeHref(data.settings.linkedin_url) },
      { label: 'X',        href: safeHref(data.settings.twitter_url)  },
      { label: 'Dribbble', href: safeHref(data.settings.dribbble_url) },
      { label: 'Website',  href: safeHref(data.settings.website_url)  },
    ] as Array<{ label: string; href: string | undefined }>
  )
    .filter((s): s is HeroSocialLink => typeof s.href === 'string');

  // Public email from settings — separate from contact section (which is write-protected).
  const heroEmail = data.settings.email_public ?? null;

  return (
    <div className={`tmpl-edgerunner ${fontVars}`} data-template-root data-template-theme="dark">
      {/*
        Pre-paint FOUC guard (T-13-04-XSS): runs BEFORE first paint and sets
        `data-template-theme` synchronously. Hardcoded `'dark'` (D-06) — the injected
        value is the coerced theme enum only (XSS-safe — the sanctioned `themeInitScript`).
      */}
      <script dangerouslySetInnerHTML={{ __html: themeInitScript('dark') }} />

      {/*
        SEO-01: the per-portfolio Person JSON-LD, server-rendered. SECURITY (T-13-04-XSS):
        the interpolated value is serialized by the sanctioned `personLdScriptHtml`, which
        ESCAPES the HTML/JS breakout characters — user-controlled free-text can never break
        out of the element. The FOUC + JSON-LD scripts are the ONLY two HTML producers here.
      */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: personLdHtml }} />

      {/*
        The reduced-motion + pointer-coarse gated synthwave a11y effects (D-07): a one-shot
        CRT PowerOnFlash + the CursorTrail. A 'use client' island rendered by this Server
        Component; it self-gates internally. Zero animation-lib install (CSS/rAF only).
      */}
      <EdgerunnerEffects />

      {/*
        Sticky neon pill Navbar — a 'use client' island (scroll-spy IntersectionObserver +
        mobile toggle). Nav items are dynamically computed from present sections so the nav
        only links to sections that actually exist in this portfolio. The logo badge links
        to #hero. logoText derives from display_name → username handle → generic fallback.
      */}
      <Navbar items={navItems} logoText={logoText} />

      {/*
        The 8 supported sections IN THE EXPORT'S SOURCE ORDER (Blog dropped).
        ScrollReveal is wired here as template chrome — each section emits `data-section-type`
        for the conformance gate. ANCHOR IDS: ScrollReveal does not forward an `id` prop, so
        each `<ScrollReveal>` wraps its section content in a `<div id="<type>">` — the inner
        div is the designated anchor target that the Navbar's IntersectionObserver and
        `<a href="#<type>">` links resolve to.

        Section order with NeonDividers:
          hero → ◇ → about → metrics (no divider — reads as one block) →
          ◆ → experience → ✦ → projects → ◇ → skills → ◆ → services → ✦ → contact
      */}
      <main>
        {/* ── Hero (LCP — priority: static wrapper, zero entrance motion) ─────── */}
        <ScrollReveal as="section" priority data-section-type="hero">
          <div id="hero">
            <Hero
                section={sectionOfType(sections, 'hero')}
                email={heroEmail}
                socials={heroSocials}
              />
          </div>
        </ScrollReveal>

        <NeonDivider glyph="◇" />

        {/* ── About ─────────────────────────────────────────────────────────────── */}
        <ScrollReveal as="section" data-section-type="about">
          <div id="about">
            <About section={sectionOfType(sections, 'about')} />
          </div>
        </ScrollReveal>

        {/* ── Metrics (no divider — reads as one block with About) ──────────────── */}
        <ScrollReveal as="section" data-section-type="metrics">
          <div id="metrics">
            <Metrics section={sectionOfType(sections, 'metrics')} />
          </div>
        </ScrollReveal>

        <NeonDivider glyph="◆" />

        {/* ── Experience ───────────────────────────────────────────────────────── */}
        <ScrollReveal as="section" data-section-type="experience">
          <div id="experience">
            <Experience section={sectionOfType(sections, 'experience')} />
          </div>
        </ScrollReveal>

        <NeonDivider glyph="✦" />

        {/* ── Projects ─────────────────────────────────────────────────────────── */}
        <ScrollReveal as="section" data-section-type="projects">
          <div id="projects">
            <Projects section={sectionOfType(sections, 'projects')} />
          </div>
        </ScrollReveal>

        <NeonDivider glyph="◇" />

        {/* ── Skills / Stack ───────────────────────────────────────────────────── */}
        <ScrollReveal as="section" data-section-type="skills">
          <div id="skills">
            <Skills section={sectionOfType(sections, 'skills')} />
          </div>
        </ScrollReveal>

        <NeonDivider glyph="◆" />

        {/* ── Services / Offerings ─────────────────────────────────────────────── */}
        <ScrollReveal as="section" data-section-type="services">
          <div id="services">
            <Services section={sectionOfType(sections, 'services')} />
          </div>
        </ScrollReveal>

        <NeonDivider glyph="✦" />

        {/* ── Contact ──────────────────────────────────────────────────────────── */}
        <ScrollReveal as="section" data-section-type="contact">
          <div id="contact">
            <Contact section={sectionOfType(sections, 'contact')} />
          </div>
        </ScrollReveal>
      </main>

      <Footer data={data} />

      {/* No ThemeToggle island mounted (D-06) — the single structural deviation from
          minimal/aurora; the kit toggle is never imported on the dark-only edgerunner. */}
    </div>
  );
}
