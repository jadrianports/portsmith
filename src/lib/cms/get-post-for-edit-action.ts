'use server';

/**
 * getPostForEditAction (BLOG-01 / D-01) — the thin `'use server'` owner-read the
 * PostEditor calls (via TanStack Query, lazily) when it OPENS an existing post, to
 * hydrate the body the list deliberately omits. It mirrors the SHARED-A read gate
 * (read-only — no write) exactly like `listPostsAction`:
 *
 *   1. getVerifiedClaims() — verified JWT identity (AUTH-05 — never getSession).
 *      A null claim ⇒ null.
 *   2. WR-05 hard `sub` guard — a verified claim MUST carry a `sub`; bail (null) on
 *      a missing one, never coerce to '' (a silent 0-row no-op masking the gap).
 *   3. Delegate to `getOwnerPostById(postId)` — the base-table, RLS-scoped single
 *      read (drafts included). The `blog_posts.own_all` policy makes a cross-tenant
 *      id read 0 rows → null (T-26-04: no body leak; no client-supplied trust).
 *
 * D-22 ISOLATION: this is the owner WRITE-path lane — it MUST NOT import the public
 * post read (`get-posts.ts`), which would risk a cookie-reading client leaking into
 * the cookie-less public ISR blog lane. It reaches only `get-posts-owner.ts`.
 *
 * It performs NO write — a pure read behind the owner gate.
 */
import { getOwnerPostById, type OwnerPostFull } from '@/lib/portfolio/get-posts-owner';
import { getVerifiedClaims } from '@/lib/supabase/server';

/**
 * Fetch the authenticated caller's OWN full editable post (incl. `body_md`) by id.
 * Returns null for an unauthenticated caller, an identity-less claim, or a post id
 * that is not the caller's own (RLS 0-row → no leak).
 */
export async function getPostForEditAction(
  postId: string,
): Promise<OwnerPostFull | null> {
  // 1) Verified identity (AUTH-05 — never getSession).
  const claims = await getVerifiedClaims();
  if (!claims) return null;

  // 2) WR-05 hard `sub` guard — never coerce to ''.
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return null;

  // 3) Delegate to the base-table, RLS-scoped single owner read (drafts included).
  return getOwnerPostById(postId);
}
