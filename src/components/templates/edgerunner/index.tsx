/**
 * The `edgerunner` template ROOT (PIPE-09 — the rich/viz-lane Three.js founder dogfood).
 * The translated result of `lovable-exports/synthwave-founder/` (a dark synthwave
 * developer design with a WebGL centerpiece), mapped onto the Portsmith template engine
 * (D-02 faithful ingest — translate-not-redesign). Mirrors `minimal`/`aurora` index.tsx
 * STRUCTURALLY; deviates ONLY in the scoped theme (`.tmpl-edgerunner`, DARK-ONLY), the
 * fonts (Orbitron + Space Grotesk + VT323), the 7-section set, and — the single
 * structural deviation — NO `ThemeToggle` (D-06).
 *
 * A SERVER COMPONENT (NO `'use client'`): the entire template tree is server-rendered.
 * The ONLY client JS is the kit `ScrollReveal` island, the `<HoloShape>` WebGL island
 * (mounted inside the Hero), and the reduced-motion-gated `<EdgerunnerEffects>` island
 * (PowerOnFlash + CursorTrail). The export's SPA chrome (Navbar / Footer-nav / cmdk
 * CommandPalette / ScrollProgress / AmbientOverlays), framer-motion, TanStack-Start
 * server entry + file routing + Nitro, the MDX blog chain, react-icons, and the data/
 * admin layer are ALL stripped (see INGEST-MANIFEST.md). Reached lazily via the registry
 * (`dynamic(() => import('./edgerunner'))`).
 *
 * SECTION ORDER (the export's `Index.tsx` single scroll, minus the dropped Services +
 * Blog): hero, about, metrics, experience, projects, skills, contact. Each is one
 * `<ScrollReveal as="section" data-section-type="<type>">`; Hero gets `priority` (the
 * LCP element — ZERO entrance motion). `sectionOfType` resolves the single visible row
 * from the pre-sorted `data.sections`; a missing type → the section renders `null`.
 *
 * DARK-ONLY (D-06): `data-template-theme="dark"` is HARDCODED (NOT `settings.theme_mode`
 * — the emissive WebGL/neon look depends on a dark canvas); `themeInitScript('dark')` is
 * injected for the FOUC guard; the kit `ThemeToggle` is DELIBERATELY NOT imported or
 * mounted (the single structural deviation from minimal/aurora). The kit toggle stays
 * intact for the other templates — this is edgerunner's per-template choice.
 *
 * D-11 (RESEARCH §2): this RSC root MUST import NONE of `three`/`@react-three/*` and MUST
 * NOT call `dynamic({ssr:false})`. The WebGL lives one level down behind the Hero's
 * `<HoloShape>` → `./Scene` `{ssr:false}` boundary. The plan-02 RSC-root grep test
 * (`tests/unit/templates/edgerunner-rsc-root.test.ts`) enforces this automatically.
 *
 * SECURITY (T-13-04-XSS): the ONLY two `dangerouslySetInnerHTML` producers are the FOUC
 * `themeInitScript` (interpolating only the coerced `'dark'` enum) and the server-
 * rendered Person JSON-LD (`personLdScriptHtml`, which ESCAPES the HTML/JS breakout
 * characters). Both are on the `gate:security` allowlist; the export's danger-html +
 * inline-handler must-strips are gone with the stripped files.
 */
import './theme.css';

import { orbitron, spaceGrotesk, vt323 } from './fonts';
import { ScrollReveal, themeInitScript } from '../_kit';
import { EdgerunnerEffects } from './effects';
import { About } from './sections/about';
import { Contact } from './sections/contact';
import { Experience } from './sections/experience';
import { Footer } from './sections/footer';
import { Hero } from './sections/hero';
import { Metrics } from './sections/metrics';
import { Navbar } from './sections/navbar';
import { Projects } from './sections/projects';
import { Skills } from './sections/skills';
import { personLdScriptHtml } from '@/lib/seo/person-jsonld';
import type { PortfolioData, PublicSection } from '../types';

/** The standard edgerunner nav items (the 7 sections minus metrics, matching the export). */
const NAV_ITEMS = [
  { id: 'hero', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Stack' },
  { id: 'contact', label: 'Contact' },
];

/**
 * Resolve the single visible section of a given `type` from the pre-sorted
 * `data.sections`. The view Row's `type` is `string | null`, so the match is a plain
 * equality; returns `undefined` when the portfolio has no section of that type (the
 * section then renders `null`). Copied verbatim from minimal/aurora.
 */
function sectionOfType(sections: PublicSection[], type: string): PublicSection | undefined {
  return sections.find((s) => s.type === type);
}

export default function EdgerunnerTemplate({ data }: { data: PortfolioData }) {
  const { profile, sections } = data;

  // DARK-ONLY (D-06): hardcoded — NOT a `settings.theme_mode` read. The emissive WebGL
  // look depends on a dark canvas, so edgerunner ships a single mode + no toggle.
  const fontVars = `${orbitron.variable} ${spaceGrotesk.variable} ${vt323.variable}`;

  // SEO-01: the data-driven Person JSON-LD, rendered server-side via the XSS-safe
  // `<script>` serializer (escapes `<`/`>`/`&` + U+2028/U+2029), NOT raw JSON.stringify.
  // `?? ''` null-guards the nullable username view column.
  const personLdHtml = personLdScriptHtml(data, profile.username ?? '');

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
        Component; it self-gates internally (the mount is NOT reduced-motion-conditional at
        the RSC level). Zero animation-lib install (CSS/rAF only); cmdk dropped (D-07).
      */}
      <EdgerunnerEffects />

      {/*
        Sticky neon pill Navbar (Task-14 chrome). A 'use client' island (scroll-spy
        IntersectionObserver + mobile toggle); nav links are SSR-rendered in the
        initial HTML so they are accessible without JS. logoText derives from the
        display_name (or falls back to the username handle, then a generic label).
        The section items are the static edgerunner set — no runtime DB read.
      */}
      <Navbar
        items={NAV_ITEMS}
        logoText={profile.display_name ?? profile.username ?? 'Portfolio'}
      />

      {/* The 7 supported sections IN THE EXPORT'S SOURCE ORDER (Services + Blog dropped).
          ScrollReveal is wired here as template chrome so the per-section fade-up belongs
          to index.tsx; the section components own only their content/hide-if-empty logic.
          The Hero is the LCP element → `priority` (a STATIC, fully-visible wrapper, ZERO
          entrance motion) and mounts the additive <HoloShape> WebGL centerpiece; the 6
          below-the-fold sections keep the JS fade-up + the reduced-motion / no-JS visible
          fallback. */}
      <ScrollReveal as="section" priority data-section-type="hero">
        <Hero section={sectionOfType(sections, 'hero')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="about">
        <About section={sectionOfType(sections, 'about')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="metrics">
        <Metrics section={sectionOfType(sections, 'metrics')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="experience">
        <Experience section={sectionOfType(sections, 'experience')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="projects">
        <Projects section={sectionOfType(sections, 'projects')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="skills">
        <Skills section={sectionOfType(sections, 'skills')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="contact">
        <Contact section={sectionOfType(sections, 'contact')} />
      </ScrollReveal>

      <Footer data={data} />

      {/* No theme-toggle island mounted (D-06) — the single structural deviation from
          minimal/aurora; the kit toggle is never imported on the dark-only edgerunner. */}
    </div>
  );
}
