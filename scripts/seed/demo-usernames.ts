/**
 * scripts/seed/demo-usernames.ts — the SINGLE shared source of the four
 * fixed demo-portfolio usernames (Plan 23-01, D-15).
 *
 * WHY ONE MODULE (the load-bearing coupling): the per-template published demo
 * showcases double as the Lighthouse-CI target URLs (LAUNCH-02 / plan 23-04) AND
 * the production public smoke-test fixtures (LAUNCH-08 / plan 23-04) AND the
 * landing-page proof examples. All of those consumers import THIS constant, so a
 * username change is exactly ONE edit here — never a scattered string the LHCI
 * config, the smoke spec, and a seed could drift apart on.
 *
 * THE FOUR LIVE TEMPLATES (CONTEXT D-15 / specifics): minimal, editorial,
 * edgerunner-v2, aurora. Each maps to one fixed, published, fully-rendering demo
 * portfolio at the username below:
 *   - `minimal`       → a fresh dev persona seeded by `seed-minimal-demo.ts`.
 *   - `editorial`     → a fresh dev persona seeded by `seed-editorial-demo.ts`.
 *   - `edgerunner-v2` → the FOUNDER's own portfolio (`jadrianports`), already
 *                       seeded by `seed-founder-portfolio.ts`. Fixed/literal.
 *   - `aurora`        → the existing marketer demo (`aurora-demo`), already seeded
 *                       by `seed-aurora-demo.ts` (Plan 22-02). Fixed/literal.
 *
 * Every value is a VALID username (`^[a-z][a-z0-9-]*$`, 3–30 chars, not reserved —
 * `@/lib/validations/username`), so the seed's `profileSchema.parse` accepts it and
 * the public `/[username]` route resolves it. The two NEW dev personas are distinct
 * fictional handles chosen per D-15 ("distinct fictional persona per template").
 *
 * Per D-15 default the demo portfolios are INDEXABLE (no noindex) — they are
 * legitimate example portfolios.
 */

/**
 * The four fixed demo usernames, keyed by the live template slug. Imported by the
 * LHCI config (plan 23-04), the prod public smoke spec (plan 23-04), the demo seeds,
 * and the landing examples. `as const` makes each value a precise string literal so a
 * typo in a consumer's slug key fails `tsc`.
 */
export const DEMO_USERNAMES = {
  /** minimal-template demo persona — seeded by `seed-minimal-demo.ts`. */
  minimal: 'devon-park',
  /** editorial-template demo persona — seeded by `seed-editorial-demo.ts`. */
  editorial: 'lena-voss',
  /** the founder's own portfolio — seeded by `seed-founder-portfolio.ts`. */
  'edgerunner-v2': 'jadrianports',
  /** the existing marketer demo — seeded by `seed-aurora-demo.ts` (Plan 22-02). */
  aurora: 'aurora-demo',
} as const;

/** The template-slug keys of {@link DEMO_USERNAMES}. */
export type DemoTemplateSlug = keyof typeof DEMO_USERNAMES;

/** The four demo usernames as a flat readonly array (LHCI URL list / smoke loop). */
export const DEMO_USERNAME_LIST = Object.values(DEMO_USERNAMES) as readonly string[];
