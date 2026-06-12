/**
 * ONBOARDING_SEED — the byte-exact bootstrap seed strings (ONB-03 / D-03).
 *
 * The SINGLE source of truth for the placeholder content that
 * `initialize_portfolio()` seeds for a brand-new account. Lifted VERBATIM from
 * the migrations that own the seed body:
 *   - supabase/migrations/006_enrich_bootstrap_placeholder.sql:68-120
 *   - supabase/migrations/008_seed_editorial_template.sql:201-253
 * The two migrations carry IDENTICAL seed bodies (008 only re-points the default
 * template slug — the placeholder JSONB is byte-for-byte the 006 enrichment).
 *
 * WHY THIS MODULE EXISTS (the false-positive trap, RESEARCH Risk 3): the resume
 * predicate (`deriveOnboardingStep`) must read a seeded-but-untouched portfolio as
 * INCOMPLETE so a returning user lands on their real last-incomplete step. Several
 * seeded fields are non-empty (`about.bio`, the two project titles), so a naive
 * "non-empty" check false-positives. The predicate AND its test therefore compare
 * against these EXACT seed constants — never a hardcoded literal in two places.
 *
 * NOTE on the SQL → JS transcription: the migration source escapes an apostrophe
 * as `''` inside the single-quoted SQL literal (e.g. `I''m` → the stored string is
 * `I'm`) and uses a literal em-dash (`—`, U+2014). The constants below hold the
 * RESOLVED runtime strings (single apostrophe, real em-dash) exactly as they are
 * stored in `sections.content` JSONB and returned by the owner read.
 *
 * `contact.email_public` is DELIBERATELY NOT seeded (absent/empty) — so its
 * "untouched" signal is simply "empty", the cleanest of the six (see Contact in
 * `deriveOnboardingStep`). There is therefore no contact constant here.
 *
 * Dependency-light by design: pure frozen constants, no imports.
 */

export const ONBOARDING_SEED = Object.freeze({
  /**
   * The neutral edit-me placeholder marker seeded into `hero.heading`
   * (`Hi, I'm [Your Name]`). Matched CASE-INSENSITIVELY by the Hero predicate —
   * a hero still containing this token reads as untouched (incomplete). This
   * mirrors the `isPublishReady` PITFALL-6 discipline in `completeness.ts`.
   */
  HERO_NAME_TOKEN: '[Your Name]',

  /**
   * The full seeded generic `about.bio` string (006/008, byte-for-byte). The bio
   * is seeded NON-EMPTY, so the About predicate compares against this exact value
   * — equality with it means "still the seed" (incomplete), inequality means the
   * user edited their bio (done).
   */
  ABOUT_BIO:
    "I'm a professional who turns ideas into real, working results. Over the years I've learned that the details matter — clear communication, thoughtful execution, and following through on what I promise. This is the space to introduce yourself: share who you are, the kind of work you do, the problems you love to solve, and what makes working with you worthwhile. Keep it warm and specific — a couple of honest sentences beat a page of buzzwords.",

  /**
   * The two seeded `projects.items[].title` values. The seed always ships these
   * two items, so "items.length > 0" false-positives — the Projects predicate is
   * done only when at least one item title is NOT one of these.
   */
  PROJECT_TITLES: Object.freeze(['Your First Project', 'A Second Project']),
} as const);

export type OnboardingSeed = typeof ONBOARDING_SEED;
