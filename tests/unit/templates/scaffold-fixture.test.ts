/**
 * PIPE-10 / D-12 — the golden fixture is a REAL fixture, not prose (Wave-0 VALIDATION).
 *
 * `docs/lovable-prompt-scaffold.md` ships dev-flavored placeholder content that the
 * Phase-10 conformance + visual-parity gates render against. That content lives in
 * machine-checkable form in `tests/fixtures/lovable-scaffold-golden.ts`. This test is
 * the PROOF that the content passes the live Zod gate (`validateSectionContent`
 * against `sectionContentSchemas`) for every dev section type — so the scaffold's
 * placeholder content is provably conformant, not merely well-written.
 *
 * Pattern mirrors `tests/unit/validations.test.ts` (Test Source C): import the gate
 * from the `@/lib/validations` barrel, run it over inline/fixture content, assert
 * success — plain describe/it, no `vi.mock`, no Supabase.
 *
 * The negative control proves the gate is REAL (not a no-op): a `javascript:` URL in
 * an otherwise-valid section MUST be rejected by the same `httpUrlOrEmptyOptional`
 * stored-XSS gate the fixture's URLs flow through.
 */
import { describe, expect, it } from 'vitest';

import { validateSectionContent } from '@/lib/validations';

import { goldenFixture, goldenFixtureSections } from '../../fixtures/lovable-scaffold-golden';

describe('Lovable scaffold golden fixture (PIPE-10 / D-12)', () => {
  it('covers the 7 dev section types + the 5 marketer types (12 keys, no blog_preview)', () => {
    expect(Object.keys(goldenFixture).sort()).toEqual(
      [
        // 7 dev types (D-P7-05)
        'about',
        'contact',
        'experience',
        'hero',
        'projects',
        'skills',
        'testimonials',
        // 5 marketer-vertical types (11-04 Step C1) — for the upcoming `aurora` template
        'certifications',
        'education',
        'metrics',
        'moodboard',
        'services',
      ].sort(),
    );
    // blog_preview is in the schema but the CMS never produces it in v1 — it must NOT
    // be in the dev scaffold's golden fixture.
    expect(Object.keys(goldenFixture)).not.toContain('blog_preview');
  });

  it('every section type validates against the live sectionContentSchemas gate', () => {
    for (const [type, content] of goldenFixtureSections) {
      expect(
        () => validateSectionContent(type, content),
        `golden fixture "${type}" must pass validateSectionContent`,
      ).not.toThrow();
    }
  });

  // Spell out each section as its own assertion too, so a failure names the offending
  // type directly (the loop above proves the set; these pin each branch).
  it.each([
    'hero',
    'about',
    'skills',
    'projects',
    'experience',
    'testimonials',
    'contact',
    // 5 marketer-vertical types (11-04 Step C1)
    'education',
    'metrics',
    'services',
    'moodboard',
    'certifications',
  ] as const)('golden fixture "%s" parses cleanly through the gate', (type) => {
    expect(() => validateSectionContent(type, goldenFixture[type])).not.toThrow();
  });

  it('contains no dangerous-scheme URL anywhere in the fixture (grep-equivalent guard)', () => {
    const serialized = JSON.stringify(goldenFixture);
    expect(serialized).not.toMatch(/javascript:/i);
    expect(serialized).not.toMatch(/data:/i);
    expect(serialized).not.toMatch(/vbscript:/i);
  });

  // --- NEGATIVE CONTROL: the gate is real, not a no-op ---
  it('NEGATIVE CONTROL: a javascript: URL in hero.cta_url is REJECTED by the gate', () => {
    const tampered = { ...goldenFixture.hero, cta_url: 'javascript:alert(1)' };
    expect(() => validateSectionContent('hero', tampered)).toThrow();
  });

  it('NEGATIVE CONTROL: a present project image with empty alt is REJECTED (alt refine)', () => {
    const [firstProject, ...rest] = goldenFixture.projects.items;
    const tampered = {
      ...goldenFixture.projects,
      items: [{ ...firstProject, image_alt: '' }, ...rest],
    };
    expect(() => validateSectionContent('projects', tampered)).toThrow();
  });
});
