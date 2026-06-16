/**
 * `allNullPortfolioData(slug, variant?)` — the canonical ALL-NULL `PortfolioData` fixture
 * (Phase-10 Plan 02, PIPE-05 null-guard corpus, the `null` variant of the `__fixture`
 * route). Every public-view COLUMN is `null`; the STRUCTURAL fields are present.
 *
 * WHY (RESEARCH Pitfall 4): PIPE-05's all-null case proves every field read is
 * null-guarded. `PortfolioData` is NOT uniformly nullable — `sections` is `PublicSection[]`
 * (an array), `recentPosts` is `never[]`, `templateSlug` is `string`, `templateSpec` is
 * `TemplateSpec`. Only the COLUMNS inside `profile`/`settings`/`sections[n]` are `| null`.
 * An all-`null` blob (`{ profile: null, ... }`) would crash the template at
 * `data.profile.username` BEFORE testing field-level null-guarding, and would not even
 * type-check. So this fixture sets every COLUMN null while keeping the structural fields.
 *
 * TWO SUB-VARIANTS (the strongest null-guard coverage):
 *   - `'empty'`        — `sections: []`. Proves the template renders with NO sections at
 *                        all (every `sectionOfType(...)` returns `undefined`).
 *   - `'null-content'` — each supported section type present as a row with `content: null`
 *                        and every other column null. Proves per-field null-guarding INSIDE
 *                        a rendered section body (the section is mounted, its content is null).
 *
 * DRIFT-CHECK (mirrors `token-conformance.test.ts`'s doc-vs-reality philosophy): the
 * exported `ALL_NULL_PROFILE_KEYS` / `ALL_NULL_SETTINGS_KEYS` / `ALL_NULL_SECTION_KEYS`
 * pin the fixture's column key sets. `assertAllNullKeySetsMatch(...)` compares them to a
 * caller-supplied set of the generated `Database['public']['Views']` Row column names — a
 * Plan-10-03/04 test feeds the generated keys, so a `supabase gen types` column addition
 * fails that assertion and forces this fixture updated.
 *
 * W8 GRAPH-SAFETY: imports ONLY `@/...` specifiers (types, `resolveSpec`). No `tests/`
 * import — safe in the Next compilation graph the `__fixture` route compiles into.
 */
import { resolveSpec } from '@/components/templates/registry';
import type { PortfolioData, PublicProfile, PublicSection, PublicSettings } from '@/components/templates/types';

export type AllNullVariant = 'empty' | 'null-content';

/** A stable synthetic portfolio id (the fixture never hits a DB). */
const ALL_NULL_PORTFOLIO_ID = '00000000-0000-4000-9000-0000000000a1';

/**
 * The `public_profiles` view Row column names (drift-checked against
 * `Database['public']['Views']['public_profiles']['Row']`).
 */
export const ALL_NULL_PROFILE_KEYS = [
  'avatar_url',
  'display_name',
  'headline',
  'id',
  'published',
  'resume_url',
  'username',
] as const;

/**
 * The `public_portfolio_settings` view Row column names (drift-checked against
 * `Database['public']['Views']['public_portfolio_settings']['Row']`).
 */
export const ALL_NULL_SETTINGS_KEYS = [
  'color_preset',
  'dribbble_url',
  'email_public',
  'favicon_url',
  'font_preset',
  'github_url',
  'linkedin_url',
  'location',
  'meta_description',
  'og_image_url',
  'page_title',
  'phone',
  'portfolio_id',
  'socials',
  'theme_mode',
  'twitter_url',
  'visitor_theme_toggle',
  'website_url',
] as const;

/**
 * The `public_sections` view Row column names (drift-checked against
 * `Database['public']['Views']['public_sections']['Row']`).
 */
export const ALL_NULL_SECTION_KEYS = [
  'content',
  'id',
  'portfolio_id',
  'sort_order',
  'type',
  'visible',
] as const;

/** Every `public_profiles` column set to `null`. */
function allNullProfile(): PublicProfile {
  return {
    avatar_url: null,
    display_name: null,
    headline: null,
    id: null,
    published: null,
    resume_url: null,
    username: null,
  };
}

/** Every `public_portfolio_settings` column set to `null`. */
function allNullSettings(): PublicSettings {
  return {
    color_preset: null,
    dribbble_url: null,
    email_public: null,
    favicon_url: null,
    font_preset: null,
    github_url: null,
    linkedin_url: null,
    location: null,
    meta_description: null,
    og_image_url: null,
    page_title: null,
    phone: null,
    portfolio_id: null,
    socials: null,
    theme_mode: null,
    twitter_url: null,
    visitor_theme_toggle: null,
    website_url: null,
  };
}

/**
 * For the `'null-content'` variant: one `PublicSection` row per spec-declared `supported`
 * section TYPE, each with `content: null` and every other column null EXCEPT `type` (the
 * type label is what mounts the section body so the null-content render exercises it) and
 * a `sort_order` for ordering. This proves per-field null-guarding inside a mounted section.
 */
function nullContentSections(slug: string): PublicSection[] {
  const spec = resolveSpec(slug);
  const supportedTypes = Object.entries(spec.sections)
    .filter(([, entry]) => entry?.supported === true)
    .map(([type]) => type);

  return supportedTypes.map((type, index) => ({
    content: null,
    id: null,
    portfolio_id: ALL_NULL_PORTFOLIO_ID,
    sort_order: index,
    type,
    visible: true,
  }));
}

/**
 * Build the all-null `PortfolioData` for a template `slug`. Defaults to the `'empty'`
 * variant (no sections); pass `'null-content'` for the mounted-but-null-content variant.
 */
export function allNullPortfolioData(slug: string, variant: AllNullVariant = 'empty'): PortfolioData {
  return {
    profile: allNullProfile(),
    settings: allNullSettings(),
    sections: variant === 'null-content' ? nullContentSections(slug) : [],
    portfolioId: null,
    recentPosts: [],
    templateSlug: slug,
    templateSpec: resolveSpec(slug),
  };
}

/**
 * Drift-check helper (RESEARCH Pitfall 4 lean): assert the fixture's pinned column key
 * sets exactly match a caller-supplied set of generated-view column names. A Plan-10-03/04
 * test calls this with the keys taken from a sample `Database['public']['Views']` Row, so a
 * `supabase gen types` column addition (or removal) fails the assertion and forces this
 * fixture updated. Returns `{ ok: true }` or `{ ok: false; missing; extra }`.
 */
export function assertAllNullKeySetsMatch(
  pinned: readonly string[],
  generated: readonly string[],
): { ok: true } | { ok: false; missing: string[]; extra: string[] } {
  const pinnedSet = new Set(pinned);
  const generatedSet = new Set(generated);
  const missing = [...generatedSet].filter((k) => !pinnedSet.has(k));
  const extra = [...pinnedSet].filter((k) => !generatedSet.has(k));
  if (missing.length === 0 && extra.length === 0) return { ok: true };
  return { ok: false, missing, extra };
}
