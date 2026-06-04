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
 * The canonical render ORDER of the dev section types (D-05) — the SAME order both
 * template roots wrap their `<ScrollReveal as="section">` sections in. The golden
 * `PortfolioData.sections` array is emitted in this order with ascending `sort_order`.
 */
const GOLDEN_SECTION_ORDER = [
  'hero',
  'about',
  'skills',
  'projects',
  'experience',
  'testimonials',
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
    dribbble_url: null,
    email_public: 'hello@rileychen.example',
    favicon_url: null,
    font_preset: 'default',
    github_url: 'https://github.com/rileychen',
    linkedin_url: 'https://www.linkedin.com/in/rileychen',
    meta_description: 'Riley Chen — full-stack engineer portfolio.',
    og_image_url: null,
    page_title: 'Riley Chen — Portfolio',
    portfolio_id: GOLDEN_PORTFOLIO_ID,
    theme_mode: 'dark',
    twitter_url: null,
    visitor_theme_toggle: true,
    website_url: 'https://rileychen.example',
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
    recentPosts: [],
    templateSlug: slug,
    templateSpec: resolveSpec(slug),
  };
}
