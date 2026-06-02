// TMPL-02 success criterion 3 — GREEN (07-01-T2).
//
// The pure, table-free `unsupportedFilledSections` mismatch predicate (D-P7-11).
// This is the CRITERION-3 PROOF: the warning must be shown to actually FIRE for an
// unsupported filled section, not merely return [] in v1. It is GREEN as soon as
// `mismatch.ts` + `editorialSpec` (07-01-T1) exist — no downstream slice needed.
//
// Pattern mirrors tests/unit/cms/completeness.test.ts: plain describe/it, import the
// pure fn, inline fixtures, NO vi.mock, NO Supabase. For the v1 case the REAL
// editorialSpec is imported (it covers all 7 produced types → []); for the v2
// fires-case and the omitted-type case, synthetic specs are constructed inline.
import { describe, expect, it } from 'vitest';

import { unsupportedFilledSections } from '@/lib/templates/mismatch';
import { editorialSpec } from '@/components/templates/editorial/spec';
import type { TemplateSpec } from '@/components/templates/minimal/spec';

// The 7 section types the CMS produces (D-P7-05). Newsprint (editorial) supports all.
const ALL_PRODUCED: string[] = [
  'hero',
  'about',
  'skills',
  'projects',
  'experience',
  'testimonials',
  'contact',
];

// A synthetic v2-shaped spec: identical to editorial EXCEPT testimonials is
// unsupported — the shape a future template (or a v2 marketer template) might have.
const TESTIMONIALS_UNSUPPORTED: TemplateSpec = {
  sections: {
    hero: { supported: true, fields: [] },
    testimonials: { supported: false, fields: [] },
  },
  color_presets: ['default'],
  font_presets: ['default'],
};

// A synthetic spec that OMITS `projects` entirely (no entry at all) — the
// `!entry` branch (omitted counts as unsupported just like supported:false).
const PROJECTS_OMITTED: TemplateSpec = {
  sections: {
    hero: { supported: true, fields: [] },
    // projects: intentionally absent.
  },
  color_presets: ['default'],
  font_presets: ['default'],
};

describe('TMPL-02 criterion 3 — unsupportedFilledSections (warn-but-allow, D-P7-11)', () => {
  it('v1: returns [] when the candidate (editorial) covers all 7 produced types', () => {
    // Newsprint covers every CMS-produced type → switching is lossless → no warning.
    expect(unsupportedFilledSections(ALL_PRODUCED, editorialSpec)).toEqual([]);
  });

  it('v2 fires-case: returns ["testimonials"] for a spec that marks it unsupported', () => {
    // Criterion 3 PROOF — the warning actually fires for an unsupported filled section.
    const result = unsupportedFilledSections(['hero', 'testimonials'], TESTIMONIALS_UNSUPPORTED);
    expect(result).toEqual(['testimonials']);
  });

  it('omitted type counts as unsupported: returns ["projects"] when the spec omits it', () => {
    expect(unsupportedFilledSections(['projects'], PROJECTS_OMITTED)).toEqual(['projects']);
  });

  it('only reports the filled-visible types passed in (never invents a type)', () => {
    // A type the candidate omits but the user does NOT have filled is never reported
    // (the predicate filters the INPUT list, it does not enumerate the spec).
    expect(unsupportedFilledSections(['hero'], PROJECTS_OMITTED)).toEqual([]);
  });
});
