/**
 * The `editorial` / "Newsprint" template ROOT (TMPL-01 / D-P7-10; 07-UI-SPEC Surface
 * A). Mirrors `minimal/index.tsx` structurally; deviates ONLY in the scoped theme
 * (`.tmpl-editorial`, LIGHT-default), the fonts (Fraunces + Space Grotesk + JetBrains
 * Mono), and the per-section visual layout. The prop contract, the FOUC-script
 * security, the LCP/reduced-motion contract, and the section data flow are copied
 * UNCHANGED.
 *
 * A SERVER COMPONENT (NO `'use client'`): the entire template tree is server-rendered,
 * so it ships ZERO template JS. The ONLY client JS in the whole template is the two
 * scoped islands — `ThemeToggle` + `ScrollReveal` (the A.8 / TMPL-04 client-budget).
 * The template is reached lazily through the registry (`dynamic(() =>
 * import('./editorial'))`) and the error boundary (template-renderer).
 *
 * Composition:
 *   - `import './theme.css'`   → the scoped `.tmpl-editorial` LIGHT+DARK token system
 *   - `fraunces/spaceGrotesk/jetbrainsMono` → the font CSS variables (next/font)
 *   - `themeInitScript()`      → the pre-paint FOUC-guard STRING (injected below)
 *   - `ThemeToggle`/`ScrollReveal` → the two reduced-motion-safe scoped client islands
 *
 * Layer isolation (D-17 / SHARED-5): this root reuses NO platform-chrome token and NO
 * chrome font AND NO `minimal` token/island — only the scoped `.tmpl-editorial` theme +
 * the editorial fonts + the editorial islands.
 *
 * SECURITY (T-07-05 / XSS): the ONLY `dangerouslySetInnerHTML` is the FOUC script, and
 * the ONLY value it interpolates is `settings.theme_mode` — a server-controlled
 * `'light' | 'dark'` enum which `themeInitScript()` further COERCES to that exact enum.
 * NO free-form / user-controlled content is ever injected. React escapes everything
 * else by default. (Identical XSS-safe coerced-enum pattern as minimal — reused
 * verbatim.)
 *
 * NULLABILITY: `settings.theme_mode` and `settings.visitor_theme_toggle` are both
 * `| null` on the view Row (every public-view column is nullable), so each is
 * null-guarded.
 */
import './theme.css';

import { fraunces, jetbrainsMono, spaceGrotesk } from './fonts';
import { ScrollReveal, ThemeToggle, themeInitScript } from '../_kit';
import { About } from './sections/about';
import { Contact } from './sections/contact';
import { Experience } from './sections/experience';
import { Footer } from './sections/footer';
import { Hero } from './sections/hero';
import { Projects } from './sections/projects';
import { Skills } from './sections/skills';
import { Testimonials } from './sections/testimonials';
import { personLdScriptHtml } from '@/lib/seo/person-jsonld';
import type { PortfolioData, PublicSection } from '../types';

/**
 * Resolve the single visible section of a given `type` from the pre-sorted
 * `data.sections`. The view Row's `type` is `string | null`, so the match is a plain
 * equality; returns `undefined` when the portfolio has no section of that type (the
 * section component then renders `null`). Copied verbatim from minimal.
 */
function sectionOfType(sections: PublicSection[], type: string): PublicSection | undefined {
  return sections.find((s) => s.type === type);
}

export default function EditorialTemplate({ data }: { data: PortfolioData }) {
  const { profile, settings, sections } = data;

  // DEVIATION from minimal (D-P7-06): editorial defaults LIGHT. minimal reads
  // `theme_mode === 'light' ? 'light' : 'dark'` (defaults dark); the editorial root
  // resolves to 'light' when theme_mode is null/unset — so `defaultMode` defaults
  // LIGHT and is passed into the editorial `themeInitScript` (which itself defaults
  // light). Null-guarded view value (every public-view column is nullable).
  const defaultMode = settings.theme_mode === 'dark' ? 'dark' : 'light';
  const showToggle = settings.visitor_theme_toggle ?? true;

  const fontVars = `${fraunces.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`;

  // SEO-01 (D-08): the data-driven Person JSON-LD, rendered server-side below. The
  // username is sourced from the public profile row (never a request host — PUB-03);
  // `buildPersonLd` derives the `url` via siteUrl(). `?? ''` null-guards the nullable
  // view column. CR-01: `personLdScriptHtml` serializes via the XSS-safe `<script>`
  // serializer (escapes `<`/`>`/`&` + U+2028/U+2029), NOT raw `JSON.stringify`. Reused
  // verbatim from the shared helper — the security property is inherited.
  const personLdHtml = personLdScriptHtml(data, profile.username ?? '');

  return (
    <div className={`tmpl-editorial ${fontVars}`} data-template-root data-template-theme={defaultMode}>
      {/*
        Pre-paint FOUC guard (T-07-05): runs BEFORE first paint and sets
        `data-template-theme` synchronously from localStorage → server default
        (LIGHT for editorial) → prefers-color-scheme, so there is no light<->dark
        flash before the toggle island hydrates. The injected default is the coerced
        `theme_mode` enum only (XSS-safe — reused verbatim from minimal's pattern).
      */}
      <script dangerouslySetInnerHTML={{ __html: themeInitScript(defaultMode) }} />

      {/*
        SEO-01 (D-08): the per-portfolio Person JSON-LD, server-rendered (never a
        client island). SECURITY (T-07-06 / XSS): the interpolated value is the
        JSON-LD object serialized by `personLdScriptHtml`, which is NOT raw
        `JSON.stringify` — it ESCAPES the HTML/JS breakout characters (`<`/`>`/`&` +
        U+2028/U+2029). This matters because `personLd` carries USER-CONTROLLED
        free-text (`name` ← display_name, `jobTitle` ← headline); a value containing
        `</script>` would otherwise break out of the element and inject HTML (stored
        XSS). The escaped output still `JSON.parse`s back to the identical object.
        Reused verbatim from the shared helper — the security property is inherited.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: personLdHtml }}
      />

      {/* The 7 sections IN THE CANONICAL ORDER, rendered 1:1 in sort_order (D-P7-10 —
          styling-only difference from minimal). ScrollReveal is wired here as template
          chrome so the per-section fade-up belongs to index.tsx; the section
          components own only their content/hide-if-empty logic.

          LCP / above-the-fold (A.5 / A.8): the Hero is the page's LCP element and is
          always in view, so it gets `priority` — it renders a STATIC, fully-visible
          wrapper (NOT gated by JS opacity:0 / hydration), so the hero NAME paints at
          FCP. The editorial Hero gets ZERO entrance motion (the name is the LCP
          element — A.5). The 6 below-the-fold sections keep the JS fade-up-on-scroll +
          the reduced-motion / no-JS visible fallback. */}
      <ScrollReveal as="section" priority data-section-type="hero">
        <Hero section={sectionOfType(sections, 'hero')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="about">
        <About section={sectionOfType(sections, 'about')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="skills">
        <Skills section={sectionOfType(sections, 'skills')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="projects">
        <Projects section={sectionOfType(sections, 'projects')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="experience">
        <Experience section={sectionOfType(sections, 'experience')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="testimonials">
        <Testimonials section={sectionOfType(sections, 'testimonials')} />
      </ScrollReveal>
      <ScrollReveal as="section" data-section-type="contact">
        {/* Phase 25 (D-07/D-08): thread the public contact details from `settings`
            (the single source of truth) into the Contact section via the scoped
            `ContactExtraProps` — NOT the killed seed-copied `content.email_public`.
            All three are nullable view columns; the section omits any absent one. */}
        <Contact
          section={sectionOfType(sections, 'contact')}
          emailPublic={settings.email_public}
          location={settings.location}
          phone={settings.phone}
        />
      </ScrollReveal>

      <Footer data={data} />

      {showToggle && <ThemeToggle defaultMode={defaultMode} />}
    </div>
  );
}
