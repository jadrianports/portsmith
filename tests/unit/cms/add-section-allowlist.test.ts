/**
 * 13.1-01 (Wave 0, Nyquist) — Pitfall 6: the addable-section allowlist EXCLUDES
 * `blog_preview` + any unregistered type, and INCLUDES the 12 form-having types.
 *
 * GREENED BY: the Wave-1 provisioning plan (the addable allowlist the picker filters
 * against + the defensive backstop inside the add path). RED now — the module + its
 * pure export do not yet exist, so the import fails to resolve (the impl-driven RED).
 *
 * ── WHY A SEPARATE PLAIN MODULE (a CLAUDE.md-driven contract) ─────────────────────
 * The plan names the allowlist a "pure const" living with the add path. But
 * `add-section-action.ts` is a `'use server'` module, and CLAUDE.md is explicit:
 * "`'use server'` modules export only async functions (Next 16 Turbopack rejects sync
 * exports — why `isRecoverySession` is a separate plain module)." A non-async
 * `ADDABLE_SECTION_TYPES` const therefore CANNOT live in the action module — it MUST
 * sit in a plain sibling (`addable-section-types.ts`), exactly the `isRecoverySession`
 * precedent. The add action imports it for its defensive backstop; the picker imports
 * it to build the addable list. This test pins the const there.
 *
 * THE GAP (RESEARCH Pitfall 6): `blog_preview` IS Zod-registered
 * (`sections.ts:384`), so `validateSectionContent` would ACCEPT it — the soft-enum
 * gate does NOT know about the picker's "form-having" subset. The picker filter +
 * this explicit allowlist are the ONLY guards keeping a form-less `blog_preview` row
 * out (deferred to 13.2). A crafted `addSectionAction('blog_preview')` must be
 * refused by this allowlist BEFORE the DB.
 *
 * Pure (no I/O, no DOM) — the `node` project.
 */
import { describe, expect, it } from 'vitest';

// The not-yet-existing pure allowlist const. RED until the Wave-1 plan ships it in the
// plain sibling module (the `isRecoverySession` separate-module precedent).
import { ADDABLE_SECTION_TYPES } from '@/lib/cms/addable-section-types';

// The 12 form-having types = the 13 registered soft-enum types MINUS blog_preview.
const FORM_HAVING_TYPES = [
  'hero',
  'about',
  'projects',
  'testimonials',
  'experience',
  'contact',
  'skills',
  'education',
  'metrics',
  'services',
  'moodboard',
  'certifications',
] as const;

describe('Pitfall 6 — ADDABLE_SECTION_TYPES (the picker/backstop allowlist)', () => {
  it('EXCLUDES blog_preview (no form until 13.2 — the only blog_preview guard)', () => {
    expect(ADDABLE_SECTION_TYPES).not.toContain('blog_preview');
  });

  it('EXCLUDES unregistered / unknown types (defensive against a crafted call)', () => {
    expect(ADDABLE_SECTION_TYPES).not.toContain('not_a_real_type');
    expect(ADDABLE_SECTION_TYPES).not.toContain('');
    expect(ADDABLE_SECTION_TYPES).not.toContain('admin');
  });

  it('INCLUDES every one of the 12 form-having types', () => {
    for (const type of FORM_HAVING_TYPES) {
      expect(ADDABLE_SECTION_TYPES).toContain(type);
    }
  });

  it('is EXACTLY the 12 form-having types (no extras, no blog_preview)', () => {
    expect([...ADDABLE_SECTION_TYPES].sort()).toEqual([...FORM_HAVING_TYPES].sort());
    expect(ADDABLE_SECTION_TYPES).toHaveLength(12);
  });
});
