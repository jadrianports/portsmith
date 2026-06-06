/**
 * 13-06 (PIPE-09 / D-10) — the narrow skills-`level` editor's save contract.
 *
 * The four `<behavior>` assertions for `SkillsForm` (the skills-ONLY level number
 * input bound to the canonical `saveSectionAction` + `validateSectionContent`
 * path). D-10 wants the founder to adjust the `skills.level` field edgerunner
 * introduced (plan 02) IN-APP, without the full per-type-form overhaul (Phase 13.1).
 *
 * WHY render-free (the storage-meter precedent, `tests/unit/media/storage-meter.test.ts`):
 * the vitest `unit` project is the `node` environment (NOT jsdom) and the repo ships
 * no `@testing-library/react`/jsdom. So — exactly as the StorageMeter test lifts the
 * meter's decision math into pure helpers and asserts THOSE without a DOM — the
 * SkillsForm's two testable decisions are exported as pure functions and asserted
 * here:
 *
 *   1. `buildSkillsContent(initialContent, levelById)` — the WHOLE skills content
 *      rebuilt with the edited per-item `level` values (every group/item preserved,
 *      only the matched item's `level` replaced). This is what the form POSTs to
 *      `saveSectionAction({ type:'skills', content })`.
 *   2. `mapSaveResult(result)` — the NON-OPTIMISTIC result mapping (mirrors
 *      SectionForm.doSave): `{ ok:true }` → the 'saved' beat; `{ ok:false,
 *      fieldErrors }` / `{ ok:false, error }` → field/banner mapped back, never a
 *      saved beat. The 101 reject is the SERVER's fieldError (the action re-parses
 *      through `validateSectionContent`, which rejects `level > 100` — already proven
 *      by `tests/unit/validations.test.ts`); this test asserts the form SURFACES that
 *      fieldError rather than swallowing it.
 *
 * The actual `saveSectionAction` is mocked (it reads cookies / has no request scope
 * in the `unit` project — the same constraint `tests/unit/cms/save-section.test.ts`
 * documents). We assert the PAYLOAD the form would send carries the edited level,
 * and that a server `{ ok:false }` (the 101 case) maps to a surfaced fieldError.
 *
 * The level INPUT bounds (min=0 max=100 step=1) are UX-only literals in the
 * component; the authoritative 0–100 gate is the server re-parse — so this test does
 * NOT re-assert the Zod bound here (validations.test.ts owns it), it asserts the form
 * BINDS to that gate and honours its verdict.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// `saveSectionAction` is mocked: in the `node` unit project it has no request scope
// (cookies()/getVerifiedClaims throw) — the same idiom as save-section.test.ts. The
// form's payload + result-mapping are what we assert, not the server round-trip.
const saveSectionAction = vi.fn();
vi.mock('@/lib/cms/save-section-action', () => ({
  saveSectionAction: (...args: unknown[]) => saveSectionAction(...args),
}));

// Import AFTER the mock is registered. These pure helpers are the SkillsForm's
// testable decisions (no DOM / no React render needed) — they do not yet exist
// (RED), the component greens them.
import { buildSkillsContent, mapSaveResult } from '@/components/editor/skills-form';

/** A two-group skills content with the new `level` field on each item. */
const initialContent = {
  heading: 'Skills',
  groups: [
    {
      label: 'Core',
      items: [
        { name: 'React', icon: 'react', tier: 'core', level: 90 },
        { name: 'TypeScript', tier: 'core', level: 85 },
      ],
    },
    {
      label: 'Learning',
      items: [{ name: 'Rust', tier: 'learning', level: 30 }],
    },
  ],
};

describe('SkillsForm — buildSkillsContent (the level → whole-content payload)', () => {
  it('preserves every group/item and prefills from each item level (round-trips with no edits)', () => {
    // No edits → the content is structurally identical (every group/item/level kept).
    const built = buildSkillsContent(initialContent, {}) as typeof initialContent;
    expect(built).toEqual(initialContent);
    // The level is carried, not dropped — the input prefill source.
    expect(built.groups[0].items[0].level).toBe(90);
    expect(built.groups[0].items[1].level).toBe(85);
    expect(built.groups[1].items[0].level).toBe(30);
  });

  it('applies an edited level to the matched item only (the save payload carries the new level)', () => {
    // Edit React 90 → 75; everything else untouched.
    const built = buildSkillsContent(initialContent, { 'g0i0': 75 }) as typeof initialContent;
    expect(built.groups[0].items[0].level).toBe(75); // edited
    expect(built.groups[0].items[1].level).toBe(85); // sibling untouched
    expect(built.groups[1].items[0].level).toBe(30); // other group untouched
    // The heading + structure survive (the WHOLE content is rebuilt, not just the item).
    expect(built.heading).toBe('Skills');
    expect(built.groups).toHaveLength(2);
    expect(built.groups[0].items[0].name).toBe('React'); // name/tier/icon preserved
    expect(built.groups[0].items[0].icon).toBe('react');
    expect(built.groups[0].items[0].tier).toBe('core');
  });

  it('carries an out-of-range edit (101) verbatim so the SERVER gate is the authority, not the client builder', () => {
    // The builder does NOT clamp/validate — it faithfully builds what the user typed;
    // the server re-parse (validateSectionContent) is the gate that rejects 101.
    const built = buildSkillsContent(initialContent, { 'g0i0': 101 }) as typeof initialContent;
    expect(built.groups[0].items[0].level).toBe(101);
  });
});

describe('SkillsForm — mapSaveResult (non-optimistic result mapping, mirrors SectionForm.doSave)', () => {
  it('maps { ok:true } to the saved beat with no errors', () => {
    const mapped = mapSaveResult({ ok: true });
    expect(mapped.saveState).toBe('saved');
    expect(mapped.fieldErrors).toEqual({});
    expect(mapped.banner).toBeNull();
  });

  it('maps a server { ok:false, fieldErrors } (the 101 reject) back to a surfaced fieldError — never a saved beat', () => {
    // The server's validateSectionContent rejects level>100; the action returns a
    // fieldError keyed by the offending path. The form must SURFACE it, not swallow it.
    const mapped = mapSaveResult({ ok: false, fieldErrors: { level: 'Number must be less than or equal to 100' } });
    expect(mapped.saveState).toBe('dirty'); // re-enabled for retry, NOT 'saved'
    expect(mapped.fieldErrors.level).toMatch(/100/);
    expect(mapped.banner).toBeNull();
  });

  it('maps a server { ok:false, error } to the form banner', () => {
    const mapped = mapSaveResult({ ok: false, error: 'This section type can’t be saved.' });
    expect(mapped.saveState).toBe('dirty');
    expect(mapped.banner).toBe('This section type can’t be saved.');
  });
});
