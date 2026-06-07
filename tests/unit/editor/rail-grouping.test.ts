/**
 * 13.1-01 (Wave 0, Nyquist) — D-06: the two-group rail derivation groups EVERY present
 * row by template support — INCLUDING empty + hidden unsupported rows (Pitfall 4).
 *
 * GREENED BY: the Wave-1 D-06 plan (`src/lib/templates/rail-grouping.ts` — the pure
 * derivation `section-list-row.tsx` / `editor-shell.tsx` consume to split the rail into
 * "On your page" vs "Other content"). RED now — the module does not yet exist, so the
 * import fails to resolve (the impl-driven RED, NOT a syntax error).
 *
 * THE LOAD-BEARING CAVEAT (RESEARCH Pitfall 4): the rail MUST NOT reuse
 * `unsupportedFilledSections` / `filledVisibleSectionTypes` verbatim — those filter to
 * FILLED + VISIBLE (built for the template-SWITCH "what would I lose" warning), so they
 * would DROP a freshly-added, still-blank, hidden `services` row from the rail. The rail
 * must show EVERY present section regardless of fill/visibility, grouped purely by
 * `spec.sections[type]?.supported`. The eye-toggle (`visible`) stays a SEPARATE badge
 * axis ("Hidden" vs "Not shown on <template>"), never a grouping input.
 *
 * Pure (no I/O, no DOM) — the `node` project, the completeness/mismatch purity precedent.
 */
import { describe, expect, it } from 'vitest';

import type { TemplateSpec } from '@/components/templates/minimal/spec';

// The not-yet-existing pure rail-grouping derivation. RED until the Wave-1 D-06 plan.
import { groupSectionsForRail } from '@/lib/templates/rail-grouping';

/** A minimal-shaped spec: hero/about/projects/contact supported; services/moodboard NOT. */
const minimalLikeSpec: TemplateSpec = {
  sections: {
    hero: { supported: true, fields: ['heading'] },
    about: { supported: true, fields: ['bio'] },
    projects: { supported: true, fields: ['items'] },
    contact: { supported: true, fields: ['heading'] },
    // unsupported on this template (present-but-not-rendered):
    services: { supported: false, fields: [] },
    // moodboard is OMITTED entirely — the predicate treats a missing entry as unsupported.
  },
  color_presets: ['default'],
  font_presets: ['default'],
};

type Row = { type: string; content: unknown; visible: boolean };

/** Map rows to their `type` with an explicit param type (the module's return is
 *  `any` until the Wave-1 plan ships it, so annotate to keep tsc noise to the
 *  single sanctioned missing-module error rather than cascading implicit-any). */
const types = (rows: Row[]): string[] => rows.map((r: Row) => r.type);

describe('D-06 — groupSectionsForRail (group ALL present rows by support, Pitfall 4)', () => {
  it('a freshly-added BLANK + HIDDEN + UNSUPPORTED `services` row lands in "Other content" (not dropped)', () => {
    const rows: Row[] = [
      { type: 'hero', content: { heading: 'Hi' }, visible: true },
      // The Pitfall-4 row: empty content, hidden, unsupported on the active template.
      { type: 'services', content: { heading: 'Services', items: [] }, visible: false },
    ];

    const { onYourPage, otherContent } = groupSectionsForRail(rows, minimalLikeSpec);

    // The blank/hidden/unsupported row is GROUPED under other-content — NEVER dropped
    // (the filled-visible filter would have removed it; the rail must not).
    expect(types(otherContent)).toContain('services');
    expect(types(onYourPage)).not.toContain('services');
    // The supported hero stays on the page.
    expect(types(onYourPage)).toContain('hero');
  });

  it('a type OMITTED from the spec (no entry) is treated as unsupported → other-content', () => {
    const rows: Row[] = [
      { type: 'about', content: { bio: 'x' }, visible: true },
      { type: 'moodboard', content: { heading: 'M', items: [] }, visible: false },
    ];
    const { onYourPage, otherContent } = groupSectionsForRail(rows, minimalLikeSpec);
    expect(types(otherContent)).toContain('moodboard'); // omitted entry = unsupported
    expect(types(onYourPage)).toContain('about');
  });

  it('a SUPPORTED-but-HIDDEN row stays under "On your page" (visibility is a SEPARATE axis)', () => {
    // The eye-toggle is NOT a grouping input: a supported row that the user hid stays
    // on the page (marked "Hidden" by the UI), never demoted to other-content.
    const rows: Row[] = [
      { type: 'projects', content: { items: [] }, visible: false }, // supported but hidden
    ];
    const { onYourPage, otherContent } = groupSectionsForRail(rows, minimalLikeSpec);
    expect(types(onYourPage)).toContain('projects');
    expect(types(otherContent)).not.toContain('projects');
  });

  it('preserves the input order within each group (the shared sort_order still drives the page)', () => {
    const rows: Row[] = [
      { type: 'hero', content: {}, visible: true },
      { type: 'services', content: {}, visible: false },
      { type: 'about', content: {}, visible: true },
      { type: 'moodboard', content: {}, visible: false },
    ];
    const { onYourPage, otherContent } = groupSectionsForRail(rows, minimalLikeSpec);
    // Supported rows keep their relative order; unsupported rows keep theirs.
    expect(types(onYourPage)).toEqual(['hero', 'about']);
    expect(types(otherContent)).toEqual(['services', 'moodboard']);
  });
});
