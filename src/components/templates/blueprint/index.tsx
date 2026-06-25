/**
 * The `blueprint` template ROOT — a FAITHFUL 1:1 clone of the dark "engineering bench" /
 * oscilloscope Lovable export (`lovable-exports/blueprint/`), mapped onto the Portsmith template
 * engine. Mirrors `atelier`/`aurora`/`minimal`/`editorial` index.tsx STRUCTURALLY; deviates ONLY
 * in the scoped theme (`.tmpl-blueprint`, DARK-only), the fonts (Space Grotesk + IBM Plex Sans +
 * JetBrains Mono), the section set (13 supported types), the per-section visual layout, and the
 * faithful sticky nav island.
 *
 * A SERVER COMPONENT (NO `'use client'`): the tree is server-rendered, shipping ZERO template JS
 * except the TWO client islands it mounts — the kit `ScrollReveal` (per-section fade-up) and the
 * faithful `StickyNav` (the export's signature instrument bar, kept per the 1:1 directive). The
 * export's SPA chrome (TanStack router/start, react-query), framer-motion, the data/admin layer,
 * and the shadcn `ui/*` primitives are ALL stripped; the export's per-element motion reveals
 * collapse into `ScrollReveal` + CSS (pixel-identical at rest).
 *
 * DARK-ONLY (operator decision): the export forces dark — no light mode, no toggle. So this root
 * mounts NO `ThemeToggle`; `data-template-theme` is pinned to `dark` and the FOUC
 * `themeInitScript('dark')` asserts the dark canvas pre-paint.
 *
 * SECTION ORDER (the export's `index.tsx` order, mapped to supported types): hero, about, skills,
 * metrics, projects, case_study, experience, education, certifications, services, testimonials,
 * blog_preview, contact. Each is one `<ScrollReveal as="section" data-section-type>`; Hero gets
 * `priority` (LCP — ZERO entrance motion). A single `TraceDivider` sits after the hero (the
 * export's one PCB-trace divider).
 *
 * Layer isolation (CTPL-04 / SHARED-D): reuses NO chrome token, NO chrome font (Inter forbidden),
 * NO other template's token/island — only the scoped `.tmpl-blueprint` theme + blueprint fonts +
 * the shared kit island + the shared `<ContactForm>`/`<ReportDialog>` token-only islands.
 *
 * SECURITY: the ONLY `dangerouslySetInnerHTML` are the FOUC script (`themeInitScript`, coerced
 * `dark` enum) and the Person JSON-LD (`personLdScriptHtml`, HTML/JS-escaped). Both are on the
 * `gate:security` allowlist; NO user-controlled HTML is ever injected.
 */
import './theme.css';

import { ibmPlexSans, jetBrainsMono, spaceGrotesk } from './fonts';
import { ScrollReveal, themeInitScript } from '../_kit';
import { About } from './sections/about';
import { BlogPreview } from './sections/blog-preview';
import { CaseStudy } from './sections/case-study';
import { Certifications } from './sections/certifications';
import { Contact } from './sections/contact';
import { Education } from './sections/education';
import { Experience } from './sections/experience';
import { Footer } from './sections/footer';
import { Hero } from './sections/hero';
import { Metrics } from './sections/metrics';
import { Projects } from './sections/projects';
import { Services } from './sections/services';
import { Skills } from './sections/skills';
import { StickyNav, type NavSection } from './sections/sticky-nav';
import { Testimonials } from './sections/testimonials';
import { TraceDivider } from './sections/shared';
import { personLdScriptHtml } from '@/lib/seo/person-jsonld';
import type { PortfolioData, PublicSection } from '../types';

/** Resolve the single visible section of a `type` from the pre-sorted `data.sections`. */
function sectionOfType(sections: PublicSection[], type: string): PublicSection | undefined {
  return sections.find((s) => s.type === type);
}

/** The export's nav label/id mapping (`getPresentSections`), hero excluded from the bar. */
const NAV_ITEMS: { type: string; nav: NavSection }[] = [
  { type: 'about', nav: { id: 'about', label: 'About' } },
  { type: 'skills', nav: { id: 'skills', label: 'Skills' } },
  { type: 'metrics', nav: { id: 'metrics', label: 'Metrics' } },
  { type: 'projects', nav: { id: 'projects', label: 'Work' } },
  { type: 'case_study', nav: { id: 'case-study', label: 'Case Study' } },
  { type: 'experience', nav: { id: 'experience', label: 'Experience' } },
  { type: 'education', nav: { id: 'education', label: 'Education' } },
  { type: 'certifications', nav: { id: 'certifications', label: 'Certs' } },
  { type: 'services', nav: { id: 'services', label: 'Services' } },
  { type: 'testimonials', nav: { id: 'testimonials', label: 'Voices' } },
  { type: 'blog_preview', nav: { id: 'blog', label: 'Notes' } },
  { type: 'contact', nav: { id: 'contact', label: 'Contact' } },
];

export default function BlueprintTemplate({ data }: { data: PortfolioData }) {
  const { profile, settings, sections } = data;

  const defaultMode = 'dark' as const;
  const fontVars = `${spaceGrotesk.variable} ${ibmPlexSans.variable} ${jetBrainsMono.variable}`;

  const personLdHtml = personLdScriptHtml(data, profile.username ?? '');

  const navSections = NAV_ITEMS.filter((it) => sectionOfType(sections, it.type)).map((it) => it.nav);
  const brand = (profile.username ?? profile.display_name ?? 'portfolio').trim();

  return (
    <div className={`tmpl-blueprint ${fontVars}`} data-template-root data-template-theme={defaultMode}>
      {/* Pre-paint FOUC guard (sanctioned #1): asserts the dark canvas before first paint. */}
      <script dangerouslySetInnerHTML={{ __html: themeInitScript(defaultMode) }} />
      {/* Person JSON-LD (sanctioned #2): the interpolated value is escaped by the serializer. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: personLdHtml }} />

      <StickyNav sections={navSections} brand={brand} />

      <main>
        <ScrollReveal as="section" priority data-section-type="hero">
          <Hero section={sectionOfType(sections, 'hero')} headline={profile.headline} location={settings.location} />
        </ScrollReveal>

        <TraceDivider />

        <ScrollReveal as="section" data-section-type="about">
          <About section={sectionOfType(sections, 'about')} />
        </ScrollReveal>
        <ScrollReveal as="section" data-section-type="skills">
          <Skills section={sectionOfType(sections, 'skills')} />
        </ScrollReveal>
        <ScrollReveal as="section" data-section-type="metrics">
          <Metrics section={sectionOfType(sections, 'metrics')} />
        </ScrollReveal>
        <ScrollReveal as="section" data-section-type="projects">
          <Projects section={sectionOfType(sections, 'projects')} />
        </ScrollReveal>
        <ScrollReveal as="section" data-section-type="case_study">
          <CaseStudy section={sectionOfType(sections, 'case_study')} />
        </ScrollReveal>
        <ScrollReveal as="section" data-section-type="experience">
          <Experience section={sectionOfType(sections, 'experience')} />
        </ScrollReveal>
        <ScrollReveal as="section" data-section-type="education">
          <Education section={sectionOfType(sections, 'education')} />
        </ScrollReveal>
        <ScrollReveal as="section" data-section-type="certifications">
          <Certifications section={sectionOfType(sections, 'certifications')} />
        </ScrollReveal>
        <ScrollReveal as="section" data-section-type="services">
          <Services section={sectionOfType(sections, 'services')} />
        </ScrollReveal>
        <ScrollReveal as="section" data-section-type="testimonials">
          <Testimonials section={sectionOfType(sections, 'testimonials')} />
        </ScrollReveal>
        <ScrollReveal as="section" data-section-type="blog_preview">
          <BlogPreview
            section={sectionOfType(sections, 'blog_preview')}
            username={profile.username}
            recentPosts={data.recentPosts}
          />
        </ScrollReveal>
        <ScrollReveal as="section" data-section-type="contact">
          <Contact section={sectionOfType(sections, 'contact')} emailPublic={settings.email_public} />
        </ScrollReveal>
      </main>

      <Footer data={data} />
    </div>
  );
}
