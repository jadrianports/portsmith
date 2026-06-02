/**
 * The `minimal` / founder template ROOT (TMPL-03 / D-20 / D-27; RESEARCH Pattern 4;
 * UI-SPEC "Midnight Outrun"). Written ONCE here in 03-04 so that 03-05/06/07/08
 * NEVER re-edit it — those plans replace only individual `sections/*.tsx` BODIES.
 *
 * A SERVER COMPONENT (NO `'use client'`): the entire template tree is server-
 * rendered, so it ships ZERO template JS. The ONLY client JS in the whole template
 * is the two islands from 03-10 — `ThemeToggle` + `ScrollReveal` (the TMPL-04
 * client-budget). The template is reached lazily through the registry
 * (`dynamic(() => import('./minimal'))`) and the error boundary (template-renderer).
 *
 * Composition (all consumed from 03-10, the earlier visual/theme wave):
 *   - `import './theme.css'`   → the scoped `.tmpl-minimal` dark+light token system
 *   - `clashDisplay/generalSans/jetbrainsMono` → the self-hosted font CSS variables
 *   - `themeInitScript()`      → the pre-paint FOUC-guard STRING (injected below)
 *   - `ThemeToggle`/`ScrollReveal` → the two reduced-motion-safe client islands
 *
 * Layer isolation (D-17 / SHARED-D): this root reuses NO platform-chrome token and
 * NO chrome font — only the scoped `.tmpl-minimal` theme + the template fonts.
 *
 * SECURITY (T-03-11 / XSS): the ONLY `dangerouslySetInnerHTML` is the FOUC script,
 * and the ONLY value it interpolates is `settings.theme_mode` — a server-controlled
 * `'light' | 'dark'` enum which `themeInitScript()` further COERCES to that exact
 * enum. NO free-form / user-controlled content is ever injected. React escapes
 * everything else by default.
 *
 * NULLABILITY: `settings.theme_mode` and `settings.visitor_theme_toggle` are both
 * `| null` on the view Row (every public-view column is nullable), so each is
 * null-guarded (`?? 'dark'` / `?? true`).
 */
import './theme.css';

import { clashDisplay, generalSans, jetbrainsMono, themeInitScript } from './fonts';
import { ScrollReveal } from './scroll-reveal';
import { ThemeToggle } from './theme-toggle';
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
 * `data.sections`. The view Row's `type` is `string | null`, so the match is a
 * plain equality; returns `undefined` when the portfolio has no section of that
 * type (the section stub/impl then renders `null`).
 */
function sectionOfType(sections: PublicSection[], type: string): PublicSection | undefined {
  return sections.find((s) => s.type === type);
}

export default function MinimalTemplate({ data }: { data: PortfolioData }) {
  const { profile, settings, sections } = data;

  // Null-guarded view values (every public-view column is nullable).
  const defaultMode = settings.theme_mode === 'light' ? 'light' : 'dark';
  const showToggle = settings.visitor_theme_toggle ?? true;

  const fontVars = `${clashDisplay.variable} ${generalSans.variable} ${jetbrainsMono.variable}`;

  // SEO-01 (D-08): the data-driven Person JSON-LD, rendered server-side below. The
  // username is sourced from the public profile row (never a request host — PUB-03);
  // `buildPersonLd` derives the `url` via siteUrl(). `?? ''` null-guards the nullable
  // view column — an empty username only yields an origin-root url, never a throw.
  // CR-01: `personLdScriptHtml` serializes via the XSS-safe `<script>` serializer
  // (escapes `<`/`>`/`&` + U+2028/U+2029), NOT raw `JSON.stringify`.
  const personLdHtml = personLdScriptHtml(data, profile.username ?? '');

  return (
    <div
      className={`tmpl-minimal ${fontVars}`}
      data-template-theme={defaultMode}
    >
      {/*
        Pre-paint FOUC guard (T-03-11): runs BEFORE first paint and sets
        `data-template-theme` synchronously from localStorage → server default →
        prefers-color-scheme, so there is no dark<->light flash before the toggle
        island hydrates. The injected default is the coerced `theme_mode` enum only.
      */}
      <script
        dangerouslySetInnerHTML={{ __html: themeInitScript(defaultMode) }}
      />

      {/*
        SEO-01 (D-08): the per-portfolio Person JSON-LD, server-rendered (never a
        client island). SECURITY (T-06-09 / CR-01 / XSS): the interpolated value is
        the JSON-LD object serialized by `personLdScriptHtml`, which is NOT raw
        `JSON.stringify` — it ESCAPES the HTML/JS breakout characters (`<`/`>`/`&` +
        U+2028/U+2029). This matters because `personLd` carries USER-CONTROLLED
        free-text (`name` ← display_name, `jobTitle` ← headline) with no character
        allowlist; a value containing `</script>` would otherwise break out of the
        element and inject HTML (stored XSS). The escaped output still `JSON.parse`s
        back to the identical object, so structured data stays valid.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: personLdHtml }}
      />

      {/* The 7 sections IN THE D-05 ORDER. ScrollReveal (a 03-10 island) is wired
          here as template chrome so the per-section fade-up belongs to index.tsx —
          the section components own only their content/hide-if-empty logic.

          LCP / above-the-fold (03 verification perf fix 2026-06-01): the Hero is the
          page's LCP element and is always in view, so it gets `priority` — it renders
          a STATIC, fully-visible wrapper (NOT gated by JS opacity:0 / hydration), so
          the hero text paints at FCP instead of after the island hydrates + the
          IntersectionObserver fires (~2.9s render-delay = the "entrance animation on
          the LCP element" anti-pattern). Its entrance is the CSS-only, opacity-stable
          `.tmpl-load-reveal` (theme.css, translate-only — never starts at opacity:0).
          The 6 below-the-fold sections keep the JS fade-up-on-scroll + the
          reduced-motion / no-JS visible fallback (d6e4c7a). */}
      <ScrollReveal as="section" priority>
        <Hero section={sectionOfType(sections, 'hero')} />
      </ScrollReveal>
      <ScrollReveal as="section">
        <About section={sectionOfType(sections, 'about')} />
      </ScrollReveal>
      <ScrollReveal as="section">
        <Skills section={sectionOfType(sections, 'skills')} />
      </ScrollReveal>
      <ScrollReveal as="section">
        <Projects section={sectionOfType(sections, 'projects')} />
      </ScrollReveal>
      <ScrollReveal as="section">
        <Experience section={sectionOfType(sections, 'experience')} />
      </ScrollReveal>
      <ScrollReveal as="section">
        <Testimonials section={sectionOfType(sections, 'testimonials')} />
      </ScrollReveal>
      <ScrollReveal as="section">
        <Contact section={sectionOfType(sections, 'contact')} />
      </ScrollReveal>

      <Footer data={data} />

      {showToggle && <ThemeToggle defaultMode={defaultMode} />}
    </div>
  );
}
