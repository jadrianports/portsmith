/**
 * CICD-03 — registry-consistency: the 4-point wiring cross-check + the negative-fixture-
 * absent assertion (Phase-10 Plan 03; D-P10-02a / D-P10-05).
 *
 * CICD-03 is met by ASSERT + VALIDATE the existing minimal wiring — NOT a scaffold
 * generator (D-P10-05). For every accepted slug (`Object.keys(templateRegistry)`) the four
 * registry surfaces must agree:
 *   1. `templateRegistry[slug]` — the lazy `next/dynamic` template component is defined.
 *   2. `specRegistry[slug]`     — the field-gating `TemplateSpec` is defined + well-shaped.
 *   3. `templateMeta[slug]`     — the chrome display copy (via the registry re-export) is
 *                                 defined.
 *   4. `templateSlugSchema`     — the Zod write-gate accepts the slug.
 *   + the UUID↔slug pin round-trips: `slugForTemplateId(uuidForSlug(slug)) === slug`
 *     (the `TEMPLATE_UUIDS` map is module-private, so the round-trip — not a direct map
 *     read — proves the pin exists and is consistent; minimal=…0001 / editorial=…0002).
 *
 * NEGATIVE-FIXTURE ABSENCE (D-P10-02a): the deliberately-broken negative fixture
 * (`tests/fixtures/broken-template/`) must be ABSENT from ALL FOUR surfaces so it can never
 * become user-selectable or publicly renderable — a future accidental registry add of it
 * goes RED HERE. This is the T-10-03-NEGREG mitigation made mechanical.
 *
 * Pure module-key cross-check — NO render, NO build, `unit` project.
 */
import { describe, expect, it } from 'vitest';

import {
  resolveSpec,
  slugForTemplateId,
  specRegistry,
  templateMeta,
  templateRegistry,
  templateSlugSchema,
  uuidForSlug,
} from '@/components/templates/registry';
import type { TemplateSpec } from '@/components/templates/contract';

const REGISTERED_SLUGS = Object.keys(templateRegistry);
const BROKEN_SLUG = 'broken-template';

/** Structural sanity for a `TemplateSpec` (the shape the read/render path field-gates on). */
function isWellShapedSpec(spec: TemplateSpec | undefined): boolean {
  if (!spec || typeof spec !== 'object') return false;
  if (typeof spec.sections !== 'object' || spec.sections === null) return false;
  if (!Array.isArray(spec.color_presets) || !Array.isArray(spec.font_presets)) return false;
  // Every section entry must carry a boolean `supported` + a `fields` array. (Under
  // `noUncheckedIndexedAccess` the record values are `TemplateSectionSpec | undefined`, so
  // guard `s` before reading it — a missing entry is itself a malformed spec.)
  return Object.values(spec.sections).every(
    (s) => s != null && typeof s.supported === 'boolean' && Array.isArray(s.fields),
  );
}

describe('CICD-03 — every accepted slug is consistently wired across the 4 registry surfaces', () => {
  it('has at least one registered slug to cross-check', () => {
    expect(REGISTERED_SLUGS.length, 'templateRegistry is empty — nothing to assert.').toBeGreaterThan(0);
  });

  describe.each(REGISTERED_SLUGS)('slug "%s"', (slug) => {
    it('1) is present in templateRegistry (the lazy template component)', () => {
      expect(
        templateRegistry[slug],
        `slug "${slug}" is missing from templateRegistry — the next/dynamic template component is its surface #1.`,
      ).toBeDefined();
    });

    it('2) is present + well-shaped in specRegistry', () => {
      const spec = specRegistry[slug];
      expect(spec, `slug "${slug}" is missing from specRegistry (surface #2).`).toBeDefined();
      expect(
        isWellShapedSpec(spec),
        `slug "${slug}"'s spec does not satisfy the TemplateSpec shape (sections{supported,fields} + ` +
          'color_presets[] + font_presets[]).',
      ).toBe(true);
      // `resolveSpec` must return THIS slug's spec (not the minimal fallback) for a real slug.
      expect(resolveSpec(slug)).toBe(spec);
    });

    it('3) is present in templateMeta (the chrome display copy, via the registry re-export)', () => {
      const meta = templateMeta[slug];
      expect(meta, `slug "${slug}" is missing from templateMeta (surface #3).`).toBeDefined();
      expect(typeof meta.name, `templateMeta["${slug}"].name must be a string`).toBe('string');
      expect(meta.name.length, `templateMeta["${slug}"].name must be non-empty`).toBeGreaterThan(0);
      expect(
        meta.thumbnailAlt.length,
        `templateMeta["${slug}"].thumbnailAlt must be a non-empty descriptive alt (D-P7-07)`,
      ).toBeGreaterThan(0);
    });

    it('4) is accepted by templateSlugSchema (the Zod write-gate)', () => {
      expect(
        templateSlugSchema.safeParse(slug).success,
        `slug "${slug}" is rejected by templateSlugSchema (surface #4) — the write-gate and the registry disagree.`,
      ).toBe(true);
    });

    it('+ round-trips through the pinned UUID map (slugForTemplateId(uuidForSlug(slug)) === slug)', () => {
      const uuid = uuidForSlug(slug);
      expect(
        slugForTemplateId(uuid),
        `slug "${slug}" does not round-trip through the UUID pin (uuidForSlug → ${uuid} → slugForTemplateId). ` +
          'The static slug↔UUID map (minimal=…0001 / editorial=…0002) is inconsistent.',
      ).toBe(slug);
    });
  });
});

describe('CICD-03 — NEGATIVE-FIXTURE ABSENCE: broken-template is ABSENT from all 4 surfaces (D-P10-02a)', () => {
  it('is ABSENT from templateRegistry', () => {
    expect(
      templateRegistry[BROKEN_SLUG],
      'the negative fixture "broken-template" must NEVER be registered (D-P10-02a) — a registry add of it ' +
        'would make a deliberately-broken template publicly renderable.',
    ).toBeUndefined();
  });

  it('is ABSENT from specRegistry', () => {
    expect(specRegistry[BROKEN_SLUG], '"broken-template" must be absent from specRegistry (D-P10-02a).').toBeUndefined();
  });

  it('is ABSENT from templateMeta', () => {
    expect(templateMeta[BROKEN_SLUG], '"broken-template" must be absent from templateMeta (D-P10-02a).').toBeUndefined();
  });

  it('is REJECTED by templateSlugSchema', () => {
    expect(
      templateSlugSchema.safeParse(BROKEN_SLUG).success,
      'templateSlugSchema must REJECT "broken-template" (D-P10-02a) — the Zod write-gate must never accept it.',
    ).toBe(false);
  });

  it('does NOT resolve from any broken-template UUID (the pin never points at it)', () => {
    // The fixture's own header documents inverted-twin UUIDs; none may resolve to the
    // broken slug. uuidForSlug falls back to minimal's UUID for an unknown slug, and
    // slugForTemplateId falls back to 'minimal' for an unknown UUID — neither yields the
    // broken slug. Assert both safe-degrade paths.
    expect(
      uuidForSlug(BROKEN_SLUG),
      'uuidForSlug("broken-template") must fall back to the minimal UUID, never a broken-specific pin.',
    ).toBe(uuidForSlug('minimal'));
    expect(
      slugForTemplateId('00000000-0000-4000-8000-000000000099'),
      'an unknown UUID must safe-degrade to "minimal", never resolve to "broken-template".',
    ).not.toBe(BROKEN_SLUG);
  });
});
