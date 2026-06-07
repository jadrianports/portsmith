/**
 * addable-section-types — the ADDABLE_SECTION_TYPES allowlist (D-02 / Pitfall 6).
 *
 * The 12 FORM-HAVING soft-enum types a user may add via the Add-section picker:
 * the 13 registered types (`sectionContentSchemas`, `@/lib/validations/sections`)
 * MINUS `blog_preview` — which IS Zod-registered (so `validateSectionContent`
 * would accept it) but has NO editor form until Phase 13.2 (the blog engine). The
 * picker filters present types + omits `blog_preview`; this list is the defensive
 * backstop the action enforces BEFORE the DB (Pitfall 6 — the soft-enum gate does
 * NOT know about the "form-having" subset).
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
 * The 12 addable (form-having) section types — the 13 registered soft-enum types
 * minus `blog_preview`. Kept in registry order for a stable picker list. A crafted
 * `addSectionAction('blog_preview')` or `addSectionAction('not_a_real_type')` is
 * refused by this allowlist before any DB access.
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
] as const;

/** A single addable section type (the picker/backstop allowlist member). */
export type AddableSectionType = (typeof ADDABLE_SECTION_TYPES)[number];

/** Type guard: is `type` one of the 12 addable form-having types? */
export function isAddableSectionType(type: string): type is AddableSectionType {
  return (ADDABLE_SECTION_TYPES as readonly string[]).includes(type);
}
