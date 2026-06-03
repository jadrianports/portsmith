// TMPL-02 success criterion 3 (upstream half) — the `filledVisibleSectionTypes`
// derivation that feeds the switch MismatchWarning (07-05 / D-P7-11).
//
// `unsupportedFilledSections` (mismatch.test.ts) answers "which of these does the
// candidate NOT render"; THIS answers "which types does the user actually have
// content for and left visible" — the input to that predicate. The two together are
// criterion 3. Pattern mirrors mismatch.test.ts: plain describe/it, the pure fn,
// inline fixtures, NO vi.mock, NO Supabase.
import { describe, expect, it } from 'vitest';

import { filledVisibleSectionTypes } from '@/lib/templates/filled-sections';

describe('filledVisibleSectionTypes (the mismatch warning input, 07-05)', () => {
  it('keeps a filled + visible heading-based section (hero/contact)', () => {
    expect(
      filledVisibleSectionTypes([
        { type: 'hero', visible: true, content: { heading: 'Jane Dev' } },
        { type: 'contact', visible: true, content: { heading: 'Get in touch' } },
      ]),
    ).toEqual(['hero', 'contact']);
  });

  it('drops a HIDDEN section even when it has content', () => {
    // A hidden section would not render anyway → it is never "filled-visible".
    expect(
      filledVisibleSectionTypes([
        { type: 'testimonials', visible: false, content: { items: [{ quote: 'x' }] } },
      ]),
    ).toEqual([]);
  });

  it('drops a null-visibility row (treated as not visible)', () => {
    expect(
      filledVisibleSectionTypes([{ type: 'hero', visible: null, content: { heading: 'x' } }]),
    ).toEqual([]);
  });

  it('drops an EMPTY visible section (no content to lose)', () => {
    expect(
      filledVisibleSectionTypes([
        { type: 'hero', visible: true, content: { heading: '   ' } }, // whitespace-only
        { type: 'about', visible: true, content: { bio: '' } },
        { type: 'projects', visible: true, content: { items: [] } },
        { type: 'skills', visible: true, content: { groups: [] } },
      ]),
    ).toEqual([]);
  });

  it('keeps item-bearing, about (bio), and skills (groups) when genuinely filled', () => {
    expect(
      filledVisibleSectionTypes([
        { type: 'about', visible: true, content: { bio: 'A real bio.' } },
        { type: 'skills', visible: true, content: { groups: [{ label: 'Lang', items: [] }] } },
        { type: 'projects', visible: true, content: { items: [{ title: 'P' }] } },
      ]),
    ).toEqual(['about', 'skills', 'projects']);
  });

  it('de-duplicates and preserves order; null/typeless rows are skipped', () => {
    expect(
      filledVisibleSectionTypes([
        { type: 'hero', visible: true, content: { heading: 'A' } },
        { type: 'hero', visible: true, content: { heading: 'B' } }, // dup type → once
        { type: null, visible: true, content: { heading: 'X' } }, // typeless → skip
      ]),
    ).toEqual(['hero']);
  });

  it('treats non-object JSONB content (array/scalar/null) as empty', () => {
    expect(
      filledVisibleSectionTypes([
        { type: 'hero', visible: true, content: null },
        { type: 'about', visible: true, content: 'a string' },
        { type: 'projects', visible: true, content: [1, 2, 3] },
      ]),
    ).toEqual([]);
  });
});
