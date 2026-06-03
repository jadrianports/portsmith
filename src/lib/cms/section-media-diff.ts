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
 * SCOPE (RESEARCH §WR-03 scope clarification): item images ONLY —
 * `projects.image` and `testimonials.avatar`. Section-level image fields
 * (`hero.background_image`, `about.avatar`) are NOT part of the WR-03 `deleteUrls`
 * surface and are NOT owned by `saveProfileAction` either; server-recomputing
 * those orphans is an ADDITIVE extension of this helper (add the fields to
 * `IMAGE_FIELDS`), NOT part of this closure.
 *
 * Source: the field map + before/after set-diff from the prior client
 * `item-card.tsx` (184-217); the read-prior → diff-after shape from
 * `save-profile-action.ts`; the per-type image fields from
 * `@/lib/validations/sections.ts` (`projectItemSchema.image`,
 * `testimonialItemSchema.avatar`; `experienceItemSchema` has no image field).
 */

/**
 * The image-bearing item fields per section type (the WR-03 surface). Projects
 * carry `image`; testimonials carry `avatar`; experience has none. An unregistered
 * type resolves to no fields, so it can never contribute a dropped URL (a non-item
 * or section-level type is a safe no-op here).
 */
const IMAGE_FIELDS: Record<string, readonly string[]> = {
  projects: ['image'],
  testimonials: ['avatar'],
  experience: [],
};

/**
 * Collect the non-empty image/avatar URLs referenced by a section content's
 * `items[]` for the given type. Null-safe: a null / non-object content, a missing
 * or non-array `items`, a non-object item, or a blank/whitespace url value all
 * contribute nothing (no throw). Mirrors the client `imageUrlsOf` exactly, but
 * reads `.items` off the `content` shape instead of taking an `EditorItem[]`.
 */
function imageUrlsOf(type: string, content: unknown): Set<string> {
  const items = (content as { items?: unknown } | null)?.items;
  const fields = IMAGE_FIELDS[type] ?? [];
  const urls = new Set<string>();
  if (!Array.isArray(items) || fields.length === 0) return urls;
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    for (const f of fields) {
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
