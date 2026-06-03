/**
 * Unit test for `serverDroppedItemImageUrls` (WR-03 / D-09) — the SERVER port of
 * `item-card.tsx`'s client `IMAGE_FIELDS`/`imageUrlsOf`/`droppedImageUrls` diff.
 *
 * Pure, no I/O, no DB, no Supabase/next imports. It proves the diff logic the
 * rewritten `saveSectionAction` relies on to recompute the delete set from prior
 * persisted `content.items` (never the client list):
 *
 *   - REPLACE  : an item image swapped (A → B) → A is dropped.
 *   - UNCHANGED : the same image kept → nothing dropped.
 *   - REMOVE   : an item carrying an image removed → its image dropped.
 *   - CLEAR    : a testimonials `avatar` field cleared → the avatar dropped.
 *   - NO FIELD : `experience` has no image field → never drops anything.
 *   - NULL-SAFE : null / {} / { items: undefined } content → [] (no throw).
 *
 * Scope (RESEARCH §WR-03): item images ONLY — `projects.image`,
 * `testimonials.avatar`. Section-level `hero.background_image` / `about.avatar`
 * are NOT in this surface (an additive option, not part of the WR-03 closure).
 */
import { describe, expect, it } from 'vitest';

import { serverDroppedItemImageUrls } from '@/lib/cms/section-media-diff';

const A = 'https://stack.local/storage/v1/object/public/media/uid/project/a.webp';
const B = 'https://stack.local/storage/v1/object/public/media/uid/project/b.webp';
const AV = 'https://stack.local/storage/v1/object/public/media/uid/testimonial/av.webp';

/** Build a projects-shaped content with the given item image URLs. */
function projectsContent(...images: Array<string | undefined>) {
  return {
    heading: 'Projects',
    items: images.map((image, i) => ({ id: `p${i}`, title: `P${i}`, image })),
  };
}

/** Build a testimonials-shaped content with the given avatar URLs. */
function testimonialsContent(...avatars: Array<string | undefined>) {
  return {
    heading: 'What people say',
    items: avatars.map((avatar, i) => ({ id: `t${i}`, name: `N${i}`, avatar })),
  };
}

describe('serverDroppedItemImageUrls (WR-03 server delete-set diff)', () => {
  it('REPLACE: a swapped project image drops the prior URL', () => {
    const prior = projectsContent(A);
    const next = projectsContent(B);
    expect(serverDroppedItemImageUrls('projects', prior, next)).toEqual([A]);
  });

  it('UNCHANGED: the same project image drops nothing', () => {
    const prior = projectsContent(A);
    const next = projectsContent(A);
    expect(serverDroppedItemImageUrls('projects', prior, next)).toEqual([]);
  });

  it('REMOVE: removing the item carrying image B drops B (A kept)', () => {
    const prior = projectsContent(A, B);
    const next = projectsContent(A);
    expect(serverDroppedItemImageUrls('projects', prior, next)).toEqual([B]);
  });

  it('CLEAR: clearing a testimonial avatar drops the avatar URL', () => {
    const prior = testimonialsContent(AV);
    const next = testimonialsContent(undefined);
    expect(serverDroppedItemImageUrls('testimonials', prior, next)).toEqual([AV]);
  });

  it('NO FIELD: experience has no image field, so nothing is ever dropped', () => {
    const prior = {
      heading: 'Experience',
      items: [{ id: 'e0', company: 'Acme', role: 'Dev', image: A }],
    };
    const next = { heading: 'Experience', items: [] };
    expect(serverDroppedItemImageUrls('experience', prior, next)).toEqual([]);
  });

  it('NULL-SAFE: null / empty / missing-items content yields [] (no throw)', () => {
    expect(serverDroppedItemImageUrls('projects', null, null)).toEqual([]);
    expect(serverDroppedItemImageUrls('projects', {}, {})).toEqual([]);
    expect(
      serverDroppedItemImageUrls('projects', { items: undefined }, { items: undefined }),
    ).toEqual([]);
    // A prior with an image but a null next → the prior image is dropped (no throw).
    expect(serverDroppedItemImageUrls('projects', projectsContent(A), null)).toEqual([A]);
  });

  it('IGNORES blank/whitespace URLs (an empty-string image is not a real object)', () => {
    const prior = projectsContent('   ');
    const next = projectsContent(undefined);
    expect(serverDroppedItemImageUrls('projects', prior, next)).toEqual([]);
  });

  it('UNKNOWN type: an unregistered type has no fields → never drops', () => {
    expect(serverDroppedItemImageUrls('hero', { items: [{ image: A }] }, null)).toEqual([]);
  });
});
