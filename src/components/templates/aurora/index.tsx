/**
 * The `aurora` template ROOT (11-04 Wave-C — the marketer dogfood ship). The translated
 * result of `lovable-exports/marketing-girl/` (a rosy, gradient-forward marketer design),
 * mapped onto the Portsmith template engine. Mirrors `minimal`/`editorial` index.tsx
 * STRUCTURALLY; deviates ONLY in the scoped theme (`.tmpl-aurora`, LIGHT-default), the
 * fonts (Poppins + Plus Jakarta Sans + Space Mono), the section set (12 of 13 types — the
 * BROADEST template), and the per-section visual layout.
 *
 * A SERVER COMPONENT (NO `'use client'`): the entire template tree is server-rendered, so
 * it ships ZERO template JS. The ONLY client JS in the whole template is the two kit
 * islands — `ThemeToggle` + `ScrollReveal` (the TMPL-04 client-budget). The source's SPA
 * chrome (Navigation / Footer-nav / ScrollProgressBar / CursorTrail / GlobalLoader),
 * framer-motion, react-router, react-query/react-hook-form, the admin/CMS/data layer, and
 * the Blog section are ALL stripped (Task 2 translation) — the reveals become the kit
 * `ScrollReveal` + CSS. The template is reached lazily through the registry (`dynamic(()
 * => import('./aurora'))`) and the error boundary (template-renderer).
 *
 * SECTION ORDER (the source `Index.tsx`, minus Blog): hero, about, education, experience,
 * metrics, projects, services, skills, testimonials, moodboard, certifications, contact.
 * Each is one `<ScrollReveal as="section" data-section-type="<type>">`; Hero gets
 * `priority` (it is the LCP element — ZERO entrance motion). `sectionOfType` resolves the
 * single visible row from the pre-sorted `data.sections`; a missing type → the section
 * component renders `null` (the wrapper still mounts, per the conformance contract).
 *
 * Layer isolation (D-17 / SHARED-D): this root reuses NO platform-chrome token, NO chrome
 * font (Inter is the chrome face — forbidden), and NO `minimal`/`editorial` token/island —
 * only the scoped `.tmpl-aurora` theme + the aurora fonts + the shared kit islands.
 *
 * SECURITY (T-11-04-XSS): the ONLY `dangerouslySetInnerHTML` is the FOUC script (the
 * sanctioned `themeInitScript`, interpolating only the coerced `light|dark` enum) and the
 * server-rendered Person JSON-LD (the sanctioned `personLdScriptHtml`, which ESCAPES the
 * HTML/JS breakout characters). Both producers are on the `gate:security` allowlist. NO
 * free-form / user-controlled HTML is ever injected; the source's 2 danger-html uses
 * (chart.tsx, BlogPost.tsx — Task 1 must-strips) are gone with the stripped files.
 *
 * NULLABILITY: `settings.theme_mode` / `visitor_theme_toggle` are both `| null` on the
 * view Row (every public-view column is nullable), so each is null-guarded.
 */
import './theme.css';

import { plusJakartaSans, poppins, spaceMono } from './fonts';
import { ScrollReveal, ThemeToggle, themeInitScript } from '../_kit';
import { About } from './sections/about';
import { Certifications } from './sections/certifications';
import { Contact } from './sections/contact';
import { Education } from './sections/education';
import { Experience } from './sections/experience';
import { Footer } from './sections/footer';
import { Hero } from './sections/hero';
import { Metrics } from './sections/metrics';
import { Moodboard } from './sections/moodboard';
import { Projects } from './sections/projects';
import { Services } from './sections/services';
import { Skills } from './sections/skills';
import { Testimonials } from './sections/testimonials';
import { personLdScriptHtml } from '@/lib/seo/person-jsonld';
import type { PortfolioData, PublicSection } from '../types';

/**
 * Resolve the single visible section of a given `type` from the pre-sorted
 * `data.sections`. The view Row's `type` is `string | null`, so the match is a plain
 * equality; returns `undefined` when the portfolio has no section of that type (the
 * section component then renders `null`). Copied verbatim from minimal/editorial.
 */
function sectionOfType(sections: PublicSection[], type: string): PublicSection | undefined {
  return sections.find((s) => s.type === type);
}

export default function AuroraTemplate({ data }: { data: PortfolioData }) {
  const { profile, settings, sections } = data;

  // DEVIATION: aurora defaults LIGHT (the source's default "Rose Day" palette). Reads
  // `theme_mode === 'dark' ? 'dark' : 'light'` (defaults light), like editorial.
  // Null-guarded view value (every public-view column is nullable).
  const defaultMode = settings.theme_mode === 'dark' ? 'dark' : 'light';
  const showToggle = settings.visitor_theme_toggle ?? true;

  const fontVars = `${poppins.variable} ${plusJakartaSans.variable} ${spaceMono.variable}`;

  // SEO-01: the data-driven Person JSON-LD, rendered server-side. CR-01:
  // `personLdScriptHtml` serializes via the XSS-safe `<script>` serializer (escapes
  // `<`/`>`/`&` + U+2028/U+2029), NOT raw `JSON.stringify`. `?? ''` null-guards the
  // nullable username view column.
  const personLdHtml = personLdScriptHtml(data, profile.username ?? '');

  return (
    <div className={`tmpl-aurora ${fontVars}`} data-template-root data-template-theme={defaultMode}>
      {/*
        Pre-paint FOUC guard (T-11-04-XSS): runs BEFORE first paint and sets
        `data-template-theme` synchronously from localStorage → server default (LIGHT for
        aurora) → prefers-color-scheme, so there is no flash before the toggle island
        hydrates. The injected default is the coerced `theme_mode` enum only (XSS-safe —
        the sanctioned `themeInitScript`).
      */}
      <script dangerouslySetInnerHTML={{ __html: themeInitScript(defaultMode) }} />

      {/*
        SEO-01: the per-portfolio Person JSON-LD, server-rendered. SECURITY (T-11-04-XSS):
        the interpolated value is the JSON-LD object serialized by the sanctioned
        `personLdScriptHtml`, which ESCAPES the HTML/JS breakout characters — so
        user-controlled free-text (name ← display_name, jobTitle ← headline) can never
        break out of the element. The escaped output still `JSON.parse`s to the identical object.
      */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: personLdHtml }} />

      {/* The 12 supported sections IN THE SOURCE `Index.tsx` ORDER (minus the dropped
          Blog). ScrollReveal is wired here as template chrome so the per-section fade-up
          belongs to index.tsx; the section components own only their content/hide-if-empty
          logic. The Hero is the LCP element → `priority` (a STATIC, fully-visible wrapper,
          ZERO entrance motion); the 11 below-the-fold sections keep the JS fade-up-on-scroll
          + the reduced-motion / no-JS visible fallback. */}
      <ScrollReveal as="section" priority data-section-type="hero">
        <Hero section={sectionOfType(sections, 'hero')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="about">
        <About section={sectionOfType(sections, 'about')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="education">
        <Education section={sectionOfType(sections, 'education')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="experience">
        <Experience section={sectionOfType(sections, 'experience')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="metrics">
        <Metrics section={sectionOfType(sections, 'metrics')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="projects">
        <Projects section={sectionOfType(sections, 'projects')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="services">
        <Services section={sectionOfType(sections, 'services')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="skills">
        <Skills section={sectionOfType(sections, 'skills')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="testimonials">
        <Testimonials section={sectionOfType(sections, 'testimonials')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="moodboard">
        <Moodboard section={sectionOfType(sections, 'moodboard')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="certifications">
        <Certifications section={sectionOfType(sections, 'certifications')} />
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

      {showToggle && <ThemeToggle defaultMode={defaultMode} />}
    </div>
  );
}
