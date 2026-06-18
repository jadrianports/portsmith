/**
 * Shared, zod-free step metadata for the onboarding wizard (18-04 / D-05 / D-09).
 *
 * The single source of truth for the six wizard steps — the canonical order, the
 * stepper labels (UI-SPEC Copywriting § Stepper step labels), and the section type
 * each CONTENT step edits (used by the RSC to compute the spec-gated visible subset,
 * D-09). It is a PLAIN module (no zod, no registry, no server import) so it is safe to
 * import from BOTH the server RSC and the client shell/stepper without dragging zod or
 * `registry.ts` onto any bundle.
 *
 * Step identifiers MATCH `OnboardingStep` in `@/lib/cms/onboarding-step.ts` (the
 * resume predicate's return type), so the derived resume step indexes cleanly here.
 */

/**
 * The wizard steps as stable string identifiers (D-05). `handle` (the D-06 "Your URL"
 * confirm/edit step, 28-04) is the FIRST step — it carries no section type so it is
 * always visible (like template/publish), and it is never a resume gate.
 */
export type OnboardingStep =
  | 'handle'
  | 'template'
  | 'hero'
  | 'about'
  | 'projects'
  | 'contact'
  | 'publish';

/** The canonical step order — Your URL → Template → Hero → About → Projects → Contact → Publish. */
export const ONBOARDING_STEP_ORDER: readonly OnboardingStep[] = [
  'handle',
  'template',
  'hero',
  'about',
  'projects',
  'contact',
  'publish',
] as const;

/** The short stepper labels (UI-SPEC § Stepper step labels — Label tier, must fit the rail). */
export const STEP_LABEL: Record<OnboardingStep, string> = {
  handle: 'Your URL',
  template: 'Template',
  hero: 'Hero',
  about: 'About',
  projects: 'Projects',
  contact: 'Contact',
  publish: 'Publish',
};

/**
 * The section `type` each CONTENT step edits — used by the RSC to compute the
 * spec-gated visible step subset (D-09: a step auto-hides when the chosen template
 * marks that section `supported: false`). Template + Publish carry no section type
 * (`null`) → they are always shown.
 */
export const STEP_SECTION_TYPE: Record<OnboardingStep, string | null> = {
  // 'handle' edits the profile username (not a section) → no section type → always shown.
  handle: null,
  template: null,
  hero: 'hero',
  about: 'about',
  projects: 'projects',
  contact: 'contact',
  publish: null,
};
