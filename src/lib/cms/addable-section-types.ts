/**
 * addable-section-types — the ADDABLE_SECTION_TYPES allowlist (D-02 / Pitfall 6).
 *
 * The 13 FORM-HAVING soft-enum types a user may add via the Add-section picker — all
 * the registered types (`sectionContentSchemas`, `@/lib/validations/sections`). As of
 * 13.2-06 / D-16 `blog_preview` is INCLUDED: it gained its BlogPreviewForm (heading +
 * shown-count) in the blog engine, so it is now a form-having, addable type like the
 * rest. The picker filters present types; this list is the defensive backstop the
 * action enforces BEFORE the DB (Pitfall 6 — the soft-enum gate does NOT know about
 * the "form-having" subset, so an unregistered/crafted type is still refused here).
 *
 * ── WHY A SEPARATE PLAIN MODULE (a CLAUDE.md hard invariant) ──────────────────
 * This const CANNOT live in `add-section-action.ts`: that module is `'use server'`
 * and CLAUDE.md is explicit — "`'use server'` modules export only async functions
 * (Next 16 Turbopack rejects sync exports — why `isRecoverySession` is a separate
 * plain module)." So the allowlist sits here, exactly the `isRecoverySession`
 * precedent. The action imports it for its defensive backstop; the picker imports
 * it (client island) to build the addable list. PURE — no `'use server'`, no I/O,
 * no `@/lib/validations` barrel (keeps it a plain string list, D-25-safe for the
 * client picker).
 */

/**
 * The 13 addable (form-having) section types — all the registered soft-enum types,
 * including `blog_preview` (13.2-06 / D-16). Kept in registry order for a stable
 * picker list. A crafted `addSectionAction('not_a_real_type')` is refused by this
 * allowlist before any DB access.
 */
export const ADDABLE_SECTION_TYPES = [
  'hero',
  'about',
  'projects',
  'experience',
  'contact',
  'skills',
  'testimonials',
  'education',
  'metrics',
  'services',
  'moodboard',
  'certifications',
  'blog_preview',
] as const;

/** A single addable section type (the picker/backstop allowlist member). */
export type AddableSectionType = (typeof ADDABLE_SECTION_TYPES)[number];

/** Type guard: is `type` one of the addable form-having types? */
export function isAddableSectionType(type: string): type is AddableSectionType {
  return (ADDABLE_SECTION_TYPES as readonly string[]).includes(type);
}
