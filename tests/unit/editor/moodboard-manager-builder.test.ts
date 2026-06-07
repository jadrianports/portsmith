/**
 * 13.1-05 (Wave 2, TDD) — D-12: the bespoke moodboard-manager's PURE content builder.
 * RED first — `buildMoodboardContent` does not yet exist, so the import below fails to
 * resolve (the impl-driven RED, NOT a syntax error).
 *
 * WHY render-free (the storage-meter / skills-form / debounced-save precedent): the
 * vitest `unit` project is the `node` environment (NOT jsdom; the repo ships no
 * @testing-library/react). So the moodboard manager's whole-section rebuild is lifted
 * into a pure `buildMoodboardContent(...)` export asserted here WITHOUT a DOM.
 *
 * THE CONTRACT (D-12, Pitfall 7):
 *   - The builder rebuilds the WHOLE `{ heading, subheading?, items: [...], palette?:
 *     [...] }` content from the editor's working state. Gallery images carry a
 *     PERSISTED `id` (`moodboardImageSchema.id` is required) — that id is KEPT. Palette
 *     swatches carry a CLIENT-ONLY `__id` (the schema persists NO id on a swatch) — that
 *     `__id` is STRIPPED.
 *   - `subheading` is OMITTED when empty (it is `.optional()`); `palette` is OMITTED when
 *     there are no swatches.
 *   - A gallery image round-trips `image` + `image_alt` + `caption`; an empty optional
 *     (caption) is omitted. A swatch round-trips `color` (+ optional `name`).
 *
 * The builder does NOT clamp/validate — it carries what the editor holds; the SERVER
 * re-parse (`validateSectionContent` → `moodboardContentSchema`, incl. the `altTextOk`
 * refine + the palette hex regex) stays the sole gate (the island MUST NOT import the
 * Zod barrel — D-25).
 */
import { describe, expect, it } from 'vitest';

// The not-yet-existing pure builder + its editor-state types. RED until the impl ships.
import {
  buildMoodboardContent,
  type MoodboardEditorImage,
  type MoodboardEditorSwatch,
} from '@/components/editor/moodboard-manager';

function fixtureImages(): MoodboardEditorImage[] {
  return [
    {
      id: 'img-1',
      image: 'https://example.test/a.webp',
      image_alt: 'A blue sky',
      caption: 'Sky study',
    },
    {
      id: 'img-2',
      image: 'https://example.test/b.webp',
      image_alt: 'A red wall',
      // no caption
    },
  ];
}

function fixtureSwatches(): MoodboardEditorSwatch[] {
  return [
    { __id: 's-1', color: '#7C3AED', name: 'Royal' },
    { __id: 's-2', color: '#0EA5E9' }, // no name
  ];
}

describe('D-12 — buildMoodboardContent rebuilds the whole moodboard content', () => {
  it('round-trips heading + subheading + the gallery items + the palette', () => {
    const content = buildMoodboardContent({
      heading: 'My Moodboard',
      subheading: 'A few visual references',
      images: fixtureImages(),
      swatches: fixtureSwatches(),
    });

    expect(content.heading).toBe('My Moodboard');
    expect(content.subheading).toBe('A few visual references');
    expect(content.items).toHaveLength(2);
    expect(content.palette).toHaveLength(2);
  });

  it('KEEPS the persisted gallery image id and round-trips image/alt/caption', () => {
    const content = buildMoodboardContent({
      heading: 'H',
      subheading: '',
      images: fixtureImages(),
      swatches: [],
    });

    expect(content.items[0]).toMatchObject({
      id: 'img-1',
      image: 'https://example.test/a.webp',
      image_alt: 'A blue sky',
      caption: 'Sky study',
    });
    // The second image has no caption → the key is omitted.
    expect(content.items[1]).toEqual({
      id: 'img-2',
      image: 'https://example.test/b.webp',
      image_alt: 'A red wall',
    });
    expect(content.items[1]).not.toHaveProperty('caption');
  });

  it('STRIPS the client-only swatch __id and round-trips color (+ optional name)', () => {
    const content = buildMoodboardContent({
      heading: 'H',
      subheading: '',
      images: [],
      swatches: fixtureSwatches(),
    });

    expect(content.palette).toBeDefined();
    expect(content.palette![0]).toEqual({ color: '#7C3AED', name: 'Royal' });
    expect(content.palette![0]).not.toHaveProperty('__id');
    // The second swatch has no name → the key is omitted.
    expect(content.palette![1]).toEqual({ color: '#0EA5E9' });
    expect(content.palette![1]).not.toHaveProperty('name');
  });

  it('OMITS subheading when empty/blank (it is .optional())', () => {
    const content = buildMoodboardContent({
      heading: 'H',
      subheading: '   ',
      images: [],
      swatches: [],
    });
    expect(content).not.toHaveProperty('subheading');
  });

  it('OMITS palette entirely when there are no swatches (it is .optional())', () => {
    const content = buildMoodboardContent({
      heading: 'H',
      subheading: '',
      images: fixtureImages(),
      swatches: [],
    });
    expect(content).not.toHaveProperty('palette');
    expect(content.items).toHaveLength(2);
  });
});
