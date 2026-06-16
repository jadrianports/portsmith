/**
 * `goldenPortfolioData(slug)` — the FULLY-POPULATED `PortfolioData` fixture (Phase-10
 * Plan 02, PIPE-05 conformance corpus, the `full` variant of the `__fixture` route).
 *
 * Wraps the canonical {@link goldenFixture} section CONTENT (the dev-flavored Lovable
 * scaffold placeholder — `src/lib/fixtures/lovable-scaffold-golden.ts`, src-side per W8)
 * into a real `PortfolioData`: a populated `profile` + `settings` + the 7 dev sections
 * (`PublicSection` rows in the canonical D-05 order) + `recentPosts: []` + the resolved
 * `templateSlug` / `templateSpec`. This is what the conformance / a11y / parity /
 * thumbnail render gates render for the populated case.
 *
 * W8 GRAPH-SAFETY: imports ONLY `@/...` specifiers (types, `resolveSpec`, the src-side
 * golden content). It pulls NO `tests/` source, so it is safe in the Next compilation
 * graph the `__fixture` route compiles into (T-10-02-GRAPHLEAK).
 *
 * NULLABILITY DISCIPLINE (RESEARCH Pitfall 4): `PortfolioData` is NOT uniformly nullable
 * — the STRUCTURAL fields (`sections`/`recentPosts`/`templateSlug`/`templateSpec`) are
 * non-null; only the COLUMNS inside `profile`/`settings`/`sections[n]` are `| null`. The
 * populated fixture sets real (non-null) values for the fields a template renders so the
 * a11y / parity render has genuine content to evaluate.
 */
import { resolveSpec } from '@/components/templates/registry';
import type { PortfolioData, PublicProfile, PublicSection, PublicSettings } from '@/components/templates/types';

import { goldenFixture } from '@/lib/fixtures/lovable-scaffold-golden';

/**
 * The canonical render ORDER of the golden section types — the 7 dev sections (D-05)
 * PLUS the 5 marketer-vertical types (11-04 Step C1: education/metrics/services/
 * moodboard/certifications). The golden `PortfolioData.sections` array is emitted in this
 * order with ascending `sort_order`.
 *
 * ORDER (the `aurora` template's section order — the source `marketing-girl/Index.tsx`,
 * minus the dropped Blog): a supporting template renders the sections it declares
 * supported; `minimal`/`editorial` OMIT the 5 marketer types from their specs (a Partial
 * spec record ⇒ treated as unsupported) AND render only their own 7 hardcoded
 * `<ScrollReveal>` sections by `sectionOfType` — so the extra marketer rows in this array
 * are simply IGNORED by those two roots (their golden parity baselines stay
 * byte-identical). The new keys exist so `aurora` (which supports all 12) renders its full
 * section set over the `/__fixture/aurora` route (the conformance / a11y / parity gates).
 */
const GOLDEN_SECTION_ORDER = [
  'hero',
  'about',
  'education',
  'experience',
  'metrics',
  'projects',
  'services',
  'skills',
  'testimonials',
  'moodboard',
  'certifications',
  'contact',
] as const satisfies ReadonlyArray<keyof typeof goldenFixture>;

/** A stable synthetic portfolio id (the fixture never hits a DB; this is for FK-shaped rows). */
const GOLDEN_PORTFOLIO_ID = '00000000-0000-4000-9000-0000000000f1';

/**
 * The populated public profile (every rendered field non-null so the a11y/parity render
 * has real content — `username`/`display_name`/`headline` drive the hero + JSON-LD).
 */
function goldenProfile(): PublicProfile {
  return {
    avatar_url: 'https://supabase.portsmith.example/storage/v1/object/public/portfolio-assets/riley-chen-avatar.webp',
    display_name: 'Riley Chen',
    headline: 'Full-stack engineer building fast, accessible web products.',
    id: '00000000-0000-4000-9000-0000000000f0',
    published: true,
    resume_url: 'https://supabase.portsmith.example/storage/v1/object/public/portfolio-assets/riley-chen-resume.pdf',
    username: 'riley-chen',
  };
}

/** The populated public portfolio settings (dark default + visitor toggle on). */
function goldenSettings(): PublicSettings {
  return {
    color_preset: 'default',
    email_public: 'hello@rileychen.example',
    favicon_url: null,
    font_preset: 'default',
    location: 'San Francisco, CA',
    meta_description: 'Riley Chen — full-stack engineer portfolio.',
    og_image_url: null,
    page_title: 'Riley Chen — Portfolio',
    phone: '+1 (555) 010-0042',
    portfolio_id: GOLDEN_PORTFOLIO_ID,
    // P25 (SET-05): socials is the single source. Enriched toward the full 11-platform
    // set so the parity/a11y render exercises the 6 NEW brand icons (instagram/youtube/
    // tiktok/behance/facebook/threads) plus the folded-in ones + the website->Globe
    // fallback — closes the RESEARCH Wave-0 icon-coverage gap.
    socials: [
      { platform: 'github', url: 'https://github.com/rileychen' },
      { platform: 'linkedin', url: 'https://www.linkedin.com/in/rileychen' },
      { platform: 'x', url: 'https://x.com/rileychen' },
      { platform: 'instagram', url: 'https://instagram.com/rileychen' },
      { platform: 'youtube', url: 'https://youtube.com/@rileychen' },
      { platform: 'tiktok', url: 'https://tiktok.com/@rileychen' },
      { platform: 'dribbble', url: 'https://dribbble.com/rileychen' },
      { platform: 'behance', url: 'https://behance.net/rileychen' },
      { platform: 'facebook', url: 'https://facebook.com/rileychen' },
      { platform: 'threads', url: 'https://threads.net/@rileychen' },
      { platform: 'website', url: 'https://rileychen.example' },
    ] as unknown as PublicSettings['socials'],
    theme_mode: 'dark',
    visitor_theme_toggle: true,
  };
}

/**
 * The 7 golden sections as `PublicSection` rows in the canonical D-05 order. Each
 * `content` is the matching {@link goldenFixture} entry (cast through `unknown` to the
 * view's `Json` column — the content is schema-validated separately by
 * `scaffold-fixture.test.ts`, so here it is opaque render input).
 */
function goldenSections(): PublicSection[] {
  return GOLDEN_SECTION_ORDER.map((type, index) => ({
    content: goldenFixture[type] as unknown as PublicSection['content'],
    id: `00000000-0000-4000-9000-00000000010${index}`,
    portfolio_id: GOLDEN_PORTFOLIO_ID,
    sort_order: index,
    type,
    visible: true,
  }));
}

/**
 * Build the fully-populated `PortfolioData` for a template `slug`. `templateSpec` is the
 * SAME `resolveSpec(slug)` the public/owner reads use (the field-gating source of truth).
 */
export function goldenPortfolioData(slug: string): PortfolioData {
  return {
    profile: goldenProfile(),
    settings: goldenSettings(),
    sections: goldenSections(),
    portfolioId: null,
    recentPosts: [],
    templateSlug: slug,
    templateSpec: resolveSpec(slug),
  };
}
