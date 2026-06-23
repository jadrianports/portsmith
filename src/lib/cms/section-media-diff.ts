/**
 * section-media-diff — the SERVER-side delete-set diff for item images (WR-03 /
 * D-09). The single source of truth for which Storage objects a section save
 * should delete: the server recomputes it by diffing the PRIOR persisted
 * `content.items` against the VALIDATED next content. The client can no longer
 * influence which objects are deleted (the `saveSectionAction` `deleteUrls`
 * plumbing is gone — WR-03 closed).
 *
 * This is the server PORT of the (now-removed) client diff that lived in
 * `src/components/editor/item-card.tsx` (`IMAGE_FIELDS` / `imageUrlsOf` /
 * `droppedImageUrls`). The logic is byte-for-byte identical in behavior; the ONLY
 * change is the input shape — it operates on a section's `content` object (reading
 * `.items` off it) rather than the editor's in-memory `EditorItem[]`.
 *
 * PURE by construction: no Supabase, no `next`, no I/O. It takes `unknown` content
 * (the prior row's `content` and the validated `parsed` content) and returns the
 * dropped URLs — so it is trivially unit-testable and safe to call inside the
 * server action between the RLS read and the `deleteStorageObject` loop.
 *
 * SCOPE (13.1-02 D-05 extension): item images AND section-level images. The
 * original WR-03 surface was item-only (`projects.image`, `testimonials.avatar`);
 * for D-05 (section delete frees media) this helper now ALSO covers the
 * SECTION-LEVEL image fields (`about.avatar`, `hero.background_image`) and the
 * `moodboard` item gallery (`items[].image`). The two field families are kept in
 * SEPARATE maps because their content location differs: item fields live under
 * `content.items[]`, section-level fields live directly on `content`. The original
 * on-save item-image WR-03 diff behavior is unchanged (projects/testimonials/
 * experience are item-only and have no section-level entry).
 *
 * Source: the field map + before/after set-diff from the prior client
 * `item-card.tsx` (184-217); the read-prior → diff-after shape from
 * `save-profile-action.ts`; the per-type image fields from
 * `@/lib/validations/sections.ts` (`projectItemSchema.image`,
 * `testimonialItemSchema.avatar`, `moodboardImageSchema.image`;
 * `aboutContentSchema.avatar`, `heroContentSchema.background_image` are
 * section-level; `experienceItemSchema` has no image field).
 */

/**
 * The image-bearing ITEM fields per section type (walked under `content.items[]`).
 * Projects carry `image`; testimonials carry `avatar`; moodboard gallery items
 * carry `image`; experience has none. An unregistered type resolves to no fields,
 * so it can never contribute a dropped URL (a non-item type is a safe no-op here).
 */
const IMAGE_FIELDS: Record<string, readonly string[]> = {
  projects: ['image'],
  testimonials: ['avatar'],
  experience: [],
  // 13.1-02 D-05: moodboard gallery images live in `content.items[].image`
  // (the same item-level shape as projects/testimonials).
  moodboard: ['image'],
  // 35-01 D-09: gallery images live FLAT in `content.items[].url` — the same
  // item-level shape, so the existing walk handles it once registered here.
  gallery: ['url'],
};

/**
 * Image arrays NESTED under each item (35-01 / GAL-03 / D-09): walk
 * `content.items[].<array>[].<url>`. `case_study` is the one genuinely-new shape —
 * its images live in a per-item array (not a scalar item field), so removing one
 * image, a whole item (its nested images), or the whole section must each free the
 * dropped objects. Mirrors the two-map style of `IMAGE_FIELDS` /
 * `SECTION_LEVEL_IMAGE_FIELDS`. A type with no entry contributes nothing here.
 */
const NESTED_ITEM_IMAGE_FIELDS: Record<string, { array: string; url: string }> = {
  case_study: { array: 'images', url: 'url' }, // content.items[].images[].url
};

/**
 * The image-bearing SECTION-LEVEL fields per section type (read directly off
 * `content`, NOT `content.items[]`). `about` carries a top-level `avatar`; `hero`
 * carries a top-level `background_image`. These were the "ADDITIVE extension"
 * noted in the original header — added here for D-05 so deleting an `about` /
 * `hero` section frees its section-level media. A type with no entry contributes
 * nothing at the section level (the item-only types stay item-only).
 */
const SECTION_LEVEL_IMAGE_FIELDS: Record<string, readonly string[]> = {
  about: ['avatar'],
  hero: ['background_image'],
};

/**
 * Collect the non-empty image/avatar URLs referenced by a section's `content` for
 * the given type — BOTH the item-level fields under `content.items[]` (the WR-03
 * surface) AND the section-level fields directly on `content` (the D-05 extension).
 * Null-safe: a null / non-object content, a missing or non-array `items`, a
 * non-object item, or a blank/whitespace url value all contribute nothing (no
 * throw). The original item-image walk is preserved byte-for-byte; the
 * section-level walk is additive and only fires for types in
 * `SECTION_LEVEL_IMAGE_FIELDS`.
 */
function imageUrlsOf(type: string, content: unknown): Set<string> {
  const urls = new Set<string>();

  // Item-level fields (the original WR-03 walk) — `content.items[]`.
  const items = (content as { items?: unknown } | null)?.items;
  const itemFields = IMAGE_FIELDS[type] ?? [];
  if (Array.isArray(items) && itemFields.length > 0) {
    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue;
      const record = item as Record<string, unknown>;
      for (const f of itemFields) {
        const v = record[f];
        if (typeof v === 'string' && v.trim() !== '') urls.add(v);
      }
    }
  }

  // Nested per-item image arrays (35-01 D-09) — `content.items[].images[].url`.
  // Routes case_study single-image / whole-item / whole-section removal through the
  // SAME `urls` Set (and thus the same `serverDroppedItemImageUrls` set-diff).
  const nested = NESTED_ITEM_IMAGE_FIELDS[type];
  if (nested && Array.isArray(items)) {
    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue;
      const arr = (item as Record<string, unknown>)[nested.array];
      if (!Array.isArray(arr)) continue;
      for (const img of arr) {
        if (typeof img !== 'object' || img === null) continue;
        const v = (img as Record<string, unknown>)[nested.url];
        if (typeof v === 'string' && v.trim() !== '') urls.add(v);
      }
    }
  }

  // Section-level fields (the D-05 extension) — read directly off `content`.
  const sectionFields = SECTION_LEVEL_IMAGE_FIELDS[type] ?? [];
  if (sectionFields.length > 0 && typeof content === 'object' && content !== null) {
    const record = content as Record<string, unknown>;
    for (const f of sectionFields) {
      const v = record[f];
      if (typeof v === 'string' && v.trim() !== '') urls.add(v);
    }
  }

  return urls;
}

/**
 * The PRIOR item-image URLs that the NEXT (validated) content no longer
 * references — the genuinely-dropped objects. An item removed with an image, an
 * image replaced (new URL ≠ old), or an image cleared all surface here; a reorder
 * or an unchanged image drops nothing. These are the ONLY URLs the server passes
 * to `deleteStorageObject(url, sub)` (with the server-verified `sub`), so a failed
 * save never strands a live reference (WR-02) and the client cannot influence the
 * set (WR-03). Same before/after set-diff as the client `droppedImageUrls`.
 */
export function serverDroppedItemImageUrls(
  type: string,
  prior: unknown,
  next: unknown,
): string[] {
  const before = imageUrlsOf(type, prior);
  const after = imageUrlsOf(type, next);
  return [...before].filter((url) => !after.has(url));
}
