/**
 * deriveOnboardingStep — the placeholder-aware RESUME predicate (ONB-03 / ONB-05 /
 * D-03). Given the owner read the editor has ALREADY loaded, it returns the wizard's
 * "last-incomplete step" — where a returning user is dropped on "welcome back."
 *
 * PURE (the load-bearing constraint): a function over the already-fetched
 * `profile + sections + published` — there is NO new table, NO extra query, NO
 * Supabase client, NO RPC, NO stored cursor. The resume step is DERIVED from real
 * portfolio state every time, so it can never drift from the user's actual content.
 * It reuses the SAME `find`/`nonEmptyString` idiom as `completeness.ts` (re-declared
 * locally to keep this module dependency-light and pure).
 *
 * THE FALSE-POSITIVE TRAP (RESEARCH Risk 3 — why this is not a naive "non-empty"
 * scan): a freshly-bootstrapped portfolio is seeded NON-EMPTY (migration 006/008).
 * `display_name` is the username (set at signup → always non-empty), `about.bio` is a
 * generic intro, and two placeholder projects always exist. A naive predicate would
 * read all of these as "done" and drop a returning user on Publish with a page full
 * of placeholders. So each step's "done" predicate compares against the byte-exact
 * `ONBOARDING_SEED` constants (the SINGLE source) and uses the `isPublishReady`
 * `[your name]` token discipline — a seeded-but-untouched step reads as NOT done.
 *
 * NOT A HARD GATE (D-08 / D-16): this derives the LANDING step only. Every wizard
 * step is skippable and publishing is NEVER blocked. Because `onboarded_at` stays
 * null until publish (D-04), the derivation only ever runs for not-yet-published
 * users — so the Publish step being "not done" is the normal in-flight state, and a
 * user who skipped a step simply has that step read as not-done.
 *
 * Source: the per-step predicate table in 18-RESEARCH.md § Risk 3; the
 * `find`/`nonEmptyString` + `[your name]` token discipline in `completeness.ts`; the
 * owner-read shape from `get-portfolio-owner.ts` (`OwnerPortfolioData`).
 */

import { ONBOARDING_SEED } from '@/lib/cms/onboarding-seed';

/**
 * The six wizard steps, as STABLE string identifiers (the wizard shell in 18-04
 * consumes the returned key). The 1-based ordinal mapping (RESEARCH Risk 3, D-05):
 *   1 → 'template'  2 → 'hero'  3 → 'about'  4 → 'projects'  5 → 'contact'  6 → 'publish'
 * `deriveOnboardingStep` returns the FIRST step whose "done" predicate is false, or
 * `'publish'` when every prior step is done (Publish is the terminal step).
 */
export type OnboardingStep =
  | 'handle'
  | 'template'
  | 'hero'
  | 'about'
  | 'projects'
  | 'contact'
  | 'publish';

/** The canonical step order — the predicate walks this and returns the first not-done. */
const STEP_ORDER: readonly OnboardingStep[] = [
  'handle',
  'template',
  'hero',
  'about',
  'projects',
  'contact',
  'publish',
] as const;

/**
 * The already-loaded shape this derives from — the consumed subset of
 * `OwnerPortfolioData` (`get-portfolio-owner.ts`): the owner's `display_name` +
 * `avatar_url`, their `sections[]`, and the live `published` flag. No template slug
 * is needed (the Template step is "done" once a portfolio exists — see below).
 */
export interface OnboardingStepInput {
  displayName?: string | null;
  avatarUrl?: string | null;
  /** The live publish flag — the terminal Publish step's done predicate. */
  published?: boolean | null;
  sections: { type: string; content: unknown }[];
}

/**
 * Find a section's content by type. Cast to a loose record so we can read the
 * schema-named fields without dragging the full content union in here (this module
 * must stay dependency-light and pure). Mirrors `completeness.ts:find` verbatim.
 */
function find(
  sections: { type: string; content: unknown }[],
  t: string,
): Record<string, unknown> | undefined {
  return sections.find((s) => s.type === t)?.content as
    | Record<string, unknown>
    | undefined;
}

/** True only for a present, non-blank string. Mirrors `completeness.ts:nonEmptyString`. */
function nonEmptyString(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

// ── Per-step "is this step done?" predicates (RESEARCH Risk 3 table) ──────────────

/**
 * (0) Handle → ALWAYS done (28-04 / D-06). The handle ALWAYS exists post-trigger
 * (`handle_new_user` assigns a collision-safe one at create — never null). The "Your
 * URL" step is a confirm/nudge, NEVER a resume gate: a returning user must never be
 * yo-yo'd back to it just because they accepted the assigned handle. Mirrors
 * `templateDone()` — always-true so it is never the derived resume target.
 */
function handleDone(): boolean {
  return true;
}

/**
 * (1) Template → ALWAYS done once a portfolio exists. Bootstrap always seeds a
 * template (D-13 pre-selects it), so a portfolio that reached this predicate already
 * has one. Template is therefore never the resume target.
 */
function templateDone(): boolean {
  return true;
}

/**
 * (2) Hero → the heading no longer holds the `[Your Name]` token (case-insensitive,
 * via `ONBOARDING_SEED.HERO_NAME_TOKEN`) AND `display_name` is non-empty. This is the
 * `isPublishReady` PITFALL-6 discipline: `display_name` is seeded to the username so
 * it CANNOT be the signal — the placeholder lives in `hero.heading`.
 *
 * AVATAR IS A SOFT NUDGE, NOT A RESUME GATE (Open-Q2 resolved, RESEARCH Risk 3): the
 * avatar is deliberately EXCLUDED from this predicate — a user who skips their photo
 * must not be yo-yo'd back to Hero on every return. (The avatar stays in the advisory
 * completeness nudge — `deriveCompleteness` — just not in the resume gate.)
 */
function heroDone(input: OnboardingStepInput): boolean {
  const hero = find(input.sections, 'hero');
  const heading = typeof hero?.heading === 'string' ? hero.heading : '';
  const token = ONBOARDING_SEED.HERO_NAME_TOKEN.toLowerCase();
  const headingEdited = !heading.toLowerCase().includes(token);
  return headingEdited && nonEmptyString(input.displayName);
}

/**
 * (3) About → `about.bio` is non-empty AND not byte-equal to the seeded generic bio.
 * The bio is seeded NON-EMPTY, so "non-empty alone" false-positives — equality with
 * `ONBOARDING_SEED.ABOUT_BIO` means "still the seed" (not done).
 */
function aboutDone(input: OnboardingStepInput): boolean {
  const about = find(input.sections, 'about');
  const bio = about?.bio;
  return nonEmptyString(bio) && bio !== ONBOARDING_SEED.ABOUT_BIO;
}

/**
 * (4) Projects → at least one project item whose `title` is NOT one of the two seed
 * titles. The seed always ships the two placeholder items, so "items.length > 0"
 * false-positives — an item title outside `ONBOARDING_SEED.PROJECT_TITLES` is the
 * "user touched projects" signal.
 */
function projectsDone(input: OnboardingStepInput): boolean {
  const projects = find(input.sections, 'projects');
  const items = projects?.items;
  if (!Array.isArray(items)) return false;
  const seedTitles = new Set<string>(ONBOARDING_SEED.PROJECT_TITLES);
  return items.some((item) => {
    const title = (item as Record<string, unknown>)?.title;
    return typeof title === 'string' && !seedTitles.has(title);
  });
}

/**
 * (5) Contact → `contact.email_public` is non-empty. `email_public` is NEVER seeded
 * (absent/empty on a fresh portfolio), so non-empty is an unambiguous "user touched
 * contact" signal — the cleanest predicate of the six.
 */
function contactDone(input: OnboardingStepInput): boolean {
  const contact = find(input.sections, 'contact');
  return nonEmptyString(contact?.email_public);
}

/** (6) Publish → `published === true` (terminal — the canonical finish). */
function publishDone(input: OnboardingStepInput): boolean {
  return input.published === true;
}

/** The per-step done map, in step order. */
const STEP_DONE: Record<OnboardingStep, (input: OnboardingStepInput) => boolean> = {
  handle: handleDone,
  template: templateDone,
  hero: heroDone,
  about: aboutDone,
  projects: projectsDone,
  contact: contactDone,
  publish: publishDone,
};

/**
 * Derive the wizard's resume step from the already-loaded owner read.
 *
 * A published portfolio is TERMINAL: `published === true` short-circuits straight to
 * `'publish'` regardless of the earlier per-step state. Publishing is the canonical
 * finish (D-04 stamps `onboarded_at` at publish), so a published user is "done" with
 * the wizard — they must never be dropped back on Hero/About just because some seeded
 * placeholder content was never edited. (In practice the redirect gate means this
 * derivation only runs for not-yet-published users, so this short-circuit is the
 * belt-and-suspenders terminal case.)
 *
 * Otherwise it returns the FIRST step whose "done" predicate is false, or `'publish'`
 * when every prior step is done (Publish is the terminal step).
 *
 * PURE — no I/O, no DB, no Supabase/RPC. The LANDING step only (NOT a hard gate, D-08).
 */
export function deriveOnboardingStep(input: OnboardingStepInput): OnboardingStep {
  // Terminal short-circuit: a published portfolio is finished (step-6 done predicate).
  if (publishDone(input)) return 'publish';

  for (const step of STEP_ORDER) {
    if (!STEP_DONE[step](input)) return step;
  }
  // Every step is done → terminal Publish (the loop's all-done fall-through).
  return 'publish';
}
