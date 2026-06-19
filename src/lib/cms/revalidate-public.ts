/**
 * revalidate-public — the shared "purge a published portfolio's public surface"
 * helper (SHOW-01 / D-05 / RESEARCH Q1). A plain (NON-`'use server'`) module so it
 * exports a SYNC function: the `'use server'` modules import it and call it inline,
 * which keeps each call site DRY and prevents the og-image revalidate from drifting
 * across the four card-affecting actions.
 *
 * WHY a sibling og-image purge is mandatory (RESEARCH Q1, VERIFIED): a literal
 * `revalidatePath('/' + username)` does NOT cascade to the sibling
 * `/[username]/opengraph-image` route segment — Next treats it as a separate
 * prerendered ISR instance (the build emits `/jadrianports` AND
 * `/jadrianports/opengraph-image` as distinct manifest entries, proven by
 * `route-table-ssg.test.ts`'s SHARE-02 block). So a republish/profile-edit that
 * changes the card's name/headline/avatar/accent leaves the carousel + `/explore`
 * preview image STALE for up to the 1h ISR backstop unless the og-image path is
 * revalidated EXPLICITLY. This helper purges BOTH literal paths in one call.
 *
 * Over-revalidating is cheap (an ISR cache miss on the next request); under-
 * revalidating leaves a stale public preview — so the card-affecting actions
 * (`saveProfileAction`, `switchTemplateAction`, `setPublished`,
 * `markOnboardedAndPublish`) all route through here.
 *
 * Both calls are LITERAL paths with NO second arg (CLAUDE.md ISR rule — the
 * `'max'` / `{ expire: 0 }` profile belongs to `revalidateTag`, a DIFFERENT
 * function). This is NOT the dynamic-segment form `revalidatePath('/[username]',
 * 'page')`.
 */
import { revalidatePath } from 'next/cache';

/**
 * Purge BOTH the public portfolio page AND its sibling og-image route segment for
 * `username`, so a card-affecting change (name / headline / avatar / accent /
 * publish flip) updates the page AND the carousel/Explore preview image promptly
 * (D-05 / Q1) instead of waiting on the 1h ISR backstop.
 *
 * @param username The owner's username (the verified identity, never the request
 *   host — PUB-03). Caller must guard against an empty/missing username.
 */
export function revalidatePublicPortfolio(username: string): void {
  // LITERAL paths, NO second arg (CLAUDE.md / RESEARCH Pitfall 1). The og-image
  // segment is a SEPARATE prerendered instance that '/' + username does NOT cascade
  // to (Q1, VERIFIED) — purge it explicitly so the share/preview card refreshes.
  revalidatePath('/' + username);
  revalidatePath('/' + username + '/opengraph-image');
}
