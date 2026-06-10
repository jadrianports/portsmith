/**
 * post-media-diff — the SERVER-side delete-set diff for a blog post's body
 * images (WR-03 / D-10, post-delete media cleanup). The single source of truth
 * for which Storage objects a post delete/replace should free: the server
 * recomputes it by diffing the PRIOR persisted `body_md` against the NEXT
 * `body_md`. The client never supplies a delete list (no `deleteUrls` field to
 * forge — WR-03 closed).
 *
 * This is the post-body PORT of `section-media-diff.ts`
 * (`serverDroppedItemImageUrls`, :116-124). The set-diff shape is identical; the
 * ONLY difference is the input domain: section images live in a typed
 * `content.items[].image` array, whereas a post's images are embedded in the
 * Markdown `![alt](url)` syntax of `body_md`. So instead of walking `items[]`
 * this helper extracts own-storage image URLs from the Markdown source via the
 * shared `ownStorageImageUrlsInMarkdown` predicate (the same own-storage gate
 * the render-time `urlTransform` drop uses — they can never disagree about what
 * "our storage" is).
 *
 * PURE by construction: no Supabase, no `next`, no I/O. It takes two Markdown
 * strings and returns the dropped own-storage URLs — trivially unit-testable and
 * safe to call inside the post action between the RLS delete and the
 * `deleteStorageObject` loop. On a DELETE the caller passes `''` as `nextBodyMd`
 * (the post is gone → every prior own-storage image is dropped).
 *
 * WR-01 leak warning (mirrored from section-media-diff): this diff frees images
 * the SURVIVING content no longer references. It does NOT (and must not) attempt
 * to track the upload-then-abandon-before-save orphan shape — that orphan never
 * reaches a persisted `body_md`, so it cannot appear in `priorBodyMd` here.
 *
 * Source: the before/after set-diff from `section-media-diff.ts:116-124`; the
 * own-storage Markdown extractor from `@/lib/markdown/own-storage-images`
 * (`ownStorageImageUrlsInMarkdown`, the 13.2-03 helper); the call-site ordering
 * from `save-section-action.ts:190-193` (delete-after-confirm, WR-02).
 */
import { ownStorageImageUrlsInMarkdown } from '@/lib/markdown/own-storage-images';

/**
 * The PRIOR own-storage body images that the NEXT Markdown body no longer
 * references — the genuinely-dropped objects. An image removed from the body, an
 * image replaced (new own-storage URL ≠ old), or the entire post deleted (next
 * is `''` → all prior images dropped) all surface here; an unchanged image drops
 * nothing. These are the ONLY URLs the action passes to
 * `deleteStorageObject(url, sub)` (with the server-verified `sub`), so a failed
 * save/delete never strands a live reference (WR-02) and the client cannot
 * influence the set (WR-03). Same before/after set-diff as
 * `serverDroppedItemImageUrls`.
 *
 * @param priorBodyMd  The post's previously persisted Markdown source.
 * @param nextBodyMd   The post's next Markdown source (`''` on a full delete).
 */
export function serverDroppedPostImageUrls(
  priorBodyMd: string,
  nextBodyMd: string,
): string[] {
  const before = new Set(ownStorageImageUrlsInMarkdown(priorBodyMd));
  const after = new Set(ownStorageImageUrlsInMarkdown(nextBodyMd));
  return [...before].filter((url) => !after.has(url));
}
