/**
 * The `atelier` template ROOT (36-02 — the gallery-forward creative ship). A FAITHFUL 1:1
 * clone of the dark-editorial Lovable export (`lovable-exports/atelier/`), mapped onto the
 * Portsmith template engine. Mirrors `aurora`/`minimal`/`editorial` index.tsx
 * STRUCTURALLY; deviates ONLY in the scoped theme (`.tmpl-atelier`, DARK-only), the fonts
 * (Bebas Neue + Archivo + Space Mono), the section set (8 image-first supported types),
 * and the per-section visual layout.
 *
 * A SERVER COMPONENT (NO `'use client'`): the entire template tree is server-rendered, so
 * it ships ZERO template JS. The ONLY client JS in the whole template is the ONE kit
 * island it mounts — `ScrollReveal` (the TMPL-04 client-budget). The export's SPA chrome
 * (Nav / ScrollProgressBar / CursorTrail / GlobalLoader), framer-motion, react-router, the
 * data/admin layer, and the shadcn `ui/*` primitives are ALL stripped — the reveals become
 * the kit `ScrollReveal` + CSS.
 *
 * DARK-ONLY (D-05): the export ships DARK as the ONLY canvas — no light mode, no toggle in
 * its Nav. So this root mounts NO `ThemeToggle`; `data-template-theme` is pinned to `dark`,
 * and the FOUC `themeInitScript('dark')` simply asserts the dark canvas pre-paint (no
 * localStorage swap path is offered). Atelier ships exactly what the export ships.
 *
 * SECTION ORDER (the export's `Index` order, mapped to supported types): hero, about,
 * gallery, case_study, projects, testimonials, moodboard, contact. Each is one
 * `<ScrollReveal as="section" data-section-type="<type>">`; Hero gets `priority` (it is the
 * LCP element — ZERO entrance motion). `sectionOfType` resolves the single visible row from
 * the pre-sorted `data.sections`; a missing type → the section component renders `null`
 * (the wrapper still mounts, per the conformance contract). The 7 unsupported types are
 * NOT in the JSX (D-10).
 *
 * Layer isolation (CTPL-04 / SHARED-D): this root reuses NO platform-chrome token, NO
 * chrome font (Inter is the chrome face — forbidden), and NO other template's token/island
 * — only the scoped `.tmpl-atelier` theme + the atelier fonts + the shared kit island.
 *
 * SECURITY (T-36-04): the ONLY `dangerouslySetInnerHTML` are the FOUC script (the
 * sanctioned `themeInitScript`, interpolating only the coerced `dark` enum) and the
 * server-rendered Person JSON-LD (the sanctioned `personLdScriptHtml`, which ESCAPES the
 * HTML/JS breakout characters). Both producers are on the `gate:security` allowlist. NO
 * free-form / user-controlled HTML is ever injected.
 */
import './theme.css';

import { archivo, bebasNeue, spaceMono } from './fonts';
import { ScrollReveal, themeInitScript } from '../_kit';
import { About } from './sections/about';
import { CaseStudy } from './sections/case-study';
import { Contact } from './sections/contact';
import { Footer } from './sections/footer';
import { Gallery } from './sections/gallery';
import { Hero } from './sections/hero';
import { Moodboard } from './sections/moodboard';
import { Projects } from './sections/projects';
import { Testimonials } from './sections/testimonials';
import { personLdScriptHtml } from '@/lib/seo/person-jsonld';
import type { PortfolioData, PublicSection } from '../types';

/**
 * Resolve the single visible section of a given `type` from the pre-sorted
 * `data.sections`. Returns `undefined` when the portfolio has no section of that type (the
 * section component then renders `null`). Copied verbatim from aurora/minimal/editorial.
 */
function sectionOfType(sections: PublicSection[], type: string): PublicSection | undefined {
  return sections.find((s) => s.type === type);
}

export default function AtelierTemplate({ data }: { data: PortfolioData }) {
  const { profile, sections } = data;

  // DARK-ONLY (D-05): the export has no light mode. Pin the canvas to dark; no toggle.
  const defaultMode = 'dark' as const;

  const fontVars = `${bebasNeue.variable} ${archivo.variable} ${spaceMono.variable}`;

  // SEO-01: the data-driven Person JSON-LD, rendered server-side via the XSS-safe
  // serializer. `?? ''` null-guards the nullable username view column.
  const personLdHtml = personLdScriptHtml(data, profile.username ?? '');

  return (
    <div className={`tmpl-atelier ${fontVars}`} data-template-root data-template-theme={defaultMode}>
      {/* Pre-paint FOUC guard (sanctioned #1): asserts the dark canvas synchronously before
          first paint. The injected default is the coerced `dark` enum only (XSS-safe). */}
      <script dangerouslySetInnerHTML={{ __html: themeInitScript(defaultMode) }} />

      {/* Person JSON-LD (sanctioned #2): the interpolated value is escaped by
          `personLdScriptHtml`, so user-controlled free-text can never break out. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: personLdHtml }} />

      {/* The export's signature film-grain overlay (fixed, decorative, scoped). */}
      <div aria-hidden="true" className="tmpl-grain" />

      {/* The 8 supported sections IN THE EXPORT ORDER. ScrollReveal is wired here as
          template chrome so the per-section fade-up belongs to index.tsx; the section
          components own only their content/hide-if-empty logic. The Hero is the LCP element
          → `priority` (a STATIC, fully-visible wrapper, ZERO entrance motion). */}
      <ScrollReveal as="section" priority data-section-type="hero">
        <Hero section={sectionOfType(sections, 'hero')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="about">
        <About section={sectionOfType(sections, 'about')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="gallery">
        <Gallery section={sectionOfType(sections, 'gallery')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="case_study">
        <CaseStudy section={sectionOfType(sections, 'case_study')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="projects">
        <Projects section={sectionOfType(sections, 'projects')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="testimonials">
        <Testimonials section={sectionOfType(sections, 'testimonials')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="moodboard">
        <Moodboard section={sectionOfType(sections, 'moodboard')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="contact">
        <Contact
          section={sectionOfType(sections, 'contact')}
          emailPublic={data.settings.email_public}
          location={data.settings.location}
          phone={data.settings.phone}
          socials={data.settings.socials}
        />
      </ScrollReveal>

      <Footer data={data} />
    </div>
  );
}
