'use server';

/**
 * publishPostAction — the SEPARATE publish/unpublish lifecycle action (D-02 /
 * D-20 draft-by-default, T-13.2-12). This is the ONLY path that ever writes the
 * `published` flag; the content save path (`savePostAction`) deliberately never
 * touches it, so an auto-save can never push a draft live.
 *
 * It mirrors the SHARED-A gate — verified identity → hard `sub` guard → RLS write
 * (never service-role) → three literal revalidates → { ok:true } — but the write
 * is a NARROW lifecycle UPDATE of ONLY `published` + `published_at`:
 *   - publishing  (published=true)  → set `published_at = now()`.
 *   - unpublishing (published=false) → leave `published_at` as-is (the row keeps
 *     its first-published timestamp; the public view's published-only filter +
 *     the `published=false` flag remove it from public reads).
 *
 * There is no Zod content re-parse here — the only inputs are a boolean flag and
 * the routing ids; the post body was already gated by `postContentSchema` on its
 * content save. The RLS `*.own_all` policy + `.eq('id', postId)` scope the UPDATE
 * to the caller; a cross-tenant target silently affects 0 rows (detected via
 * `.select('id')` → generic failure, enumeration-safe, T-13.2-08).
 *
 * Source: the SHARED-A auth/sub guard + 0-row detection + three-path revalidate
 * from `save-post-action.ts`; the lifecycle-flag-only write posture from the
 * D-02 / D-20 draft-by-default decision; revalidatePath [VERIFIED: Next 16.2.6].
 */
import { revalidatePath } from 'next/cache';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

/** The publish outcome — the SHARED-A discriminated union. */
export type PublishPostResult = { ok: true } | { ok: false; error?: string };

/**
 * The publish input. `published` is the desired lifecycle state; `username` +
 * `slug` drive the three literal revalidates (D-18).
 */
export interface PublishPostInput {
  postId: string;
  username: string;
  slug: string;
  published: boolean;
}

const NOT_SIGNED_IN = 'Not signed in.';
const PUBLISH_FAILED = 'Something went wrong updating your post. Please try again.';

/**
 * Flip a post's `published` lifecycle flag (publish or unpublish). The ONLY path
 * that writes `published` (D-02 / D-20).
 */
export async function publishPostAction(
  input: PublishPostInput,
): Promise<PublishPostResult> {
  // 1) Verified identity (AUTH-05 — never getSession).
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // 2) WR-05 hard `sub` guard — never coerce to ''.
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 3) Narrow lifecycle UPDATE under RLS (never service-role). Explicit columns:
  //    ONLY `published` (+ `published_at` when publishing). No content columns are
  //    touched here, and no content action touches these — the flag is isolated to
  //    this action (T-13.2-12). On publish, stamp `published_at`; on unpublish,
  //    leave the existing timestamp.
  const supabase = await createClient();
  const lifecycle = input.published
    ? { published: true, published_at: new Date().toISOString() }
    : { published: false };

  const { data: updatedRows, error } = await supabase
    .from('blog_posts')
    .update(lifecycle)
    .eq('id', input.postId)
    .select('id');
  if (error) return { ok: false, error: PUBLISH_FAILED };
  // 0-row write = cross-tenant target hit the RLS USING clause, or the row is
  // missing. Enumeration-safe generic failure (T-13.2-08).
  if (!updatedRows || updatedRows.length === 0) {
    return { ok: false, error: PUBLISH_FAILED };
  }

  // 4) THREE literal revalidates (D-18) — no second arg on any (Pitfall 1).
  revalidatePath('/' + input.username + '/blog');
  revalidatePath('/' + input.username + '/blog/' + input.slug);
  revalidatePath('/' + input.username);

  return { ok: true };
}
