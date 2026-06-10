'use server';

/**
 * savePostAction / deletePostAction — the Zod-gated blog-post write path (SC-1,
 * D-01 / D-03 / D-04 / D-18). The first-class-row analog of the canonical
 * `saveSectionAction` SHARED-A sequence, applied to `blog_posts` rows instead of
 * schemaless section JSONB.
 *
 * Every write follows the invariant SHARED-A gate (a failure at step N never
 * reaches step N+1):
 *
 *   1. getVerifiedClaims()    — verified JWT identity (AUTH-05). NEVER the
 *      spoofable cookie-session getter. A null claim ⇒ { ok:false, NOT_SIGNED_IN }.
 *   2. hard `sub` guard       — WR-05: a verified claim MUST carry a subject;
 *      a missing `sub` is a hard auth failure, NEVER coerced to '' (that would
 *      turn the ownership read into a silent 0-row no-op masking the violation).
 *   3. postContentSchema      — THE gate (FND-04). The barrel `@/lib/validations`
 *      re-parse `.parse()`s (throws) on bad content; the client parse is UX only,
 *      this re-parse is the real boundary (T-13.2-09). A ZodError maps to per-field
 *      errors via the verbatim `gateErrorToResult`.
 *   4. authenticated createClient() RLS write — never service-role (T-13.2-08).
 *      The `blog_posts` `*.own_all` policy + `.eq('id', postId)` scope the write to
 *      the caller; a cross-tenant target silently affects 0 rows, detected via
 *      `.select('id')` (an empty result is a generic failure, enumeration-safe).
 *      On CREATE: enforce the D-03 ~50-posts/portfolio cap with a count check
 *      BEFORE the insert (T-13.2-11). `published` is NEVER written here — only
 *      `publishPostAction` touches the lifecycle flag (D-02 / D-20 draft-by-default,
 *      T-13.2-12). Explicit-column allowlist (never `...parsed`).
 *   5. THREE literal revalidates (D-18): `/{u}/blog`, `/{u}/blog/{slug}`, `/{u}`,
 *      NO second arg on any (RESEARCH Pitfall 1 / CLAUDE.md correction). On a slug
 *      RENAME of an existing post, ALSO revalidate the OLD `/blog/{oldSlug}` (it now
 *      404s — D-04). The homepage `/{u}` teaser auto-derives the latest posts (D-16).
 *   6. Return { ok: true }.
 *
 * The DELETE branch (`deletePostAction`) deletes the row under RLS, then frees the
 * post's own-storage body images via a SERVER-recomputed diff (`post-media-diff`,
 * WR-03) calling `deleteStorageObject(url, sub)` AFTER the delete confirms (WR-02
 * ordering) — so a failed delete never strands a live reference, and a missing /
 * cross-tenant target (0 rows) drops nothing.
 *
 * Source: the SHARED-A sequence from `save-section-action.ts:126-214` (the
 * `gateErrorToResult` loop is copied verbatim); the post schema from
 * `@/lib/validations` (`postContentSchema`); the media diff from `post-media-diff.ts`;
 * the own-folder-guarded delete from `@/lib/media/delete-object`;
 * revalidatePath signature [VERIFIED: Next 16.2.6].
 */
import { revalidatePath } from 'next/cache';

import { serverDroppedPostImageUrls } from '@/lib/cms/post-media-diff';
import { deleteStorageObject } from '@/lib/media/delete-object';
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { postContentSchema } from '@/lib/validations';

/** Per-field validation messages, keyed by the post content field name. */
export type SavePostFieldErrors = Record<string, string>;

/**
 * The save outcome — the same discriminated union shape `saveSectionAction`
 * returns (SHARED-A), so every editor island handles results identically.
 */
export type SavePostResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: SavePostFieldErrors };

/**
 * The post save input. `postId` present ⇒ UPDATE an existing row; absent ⇒
 * CREATE a new row for `portfolioId`. `content` is the unvalidated post body
 * (re-parsed server-side). `username` drives the three-path revalidate (the
 * verified identity, NEVER the request host — PUB-03).
 */
export interface SavePostInput {
  postId?: string;
  portfolioId: string;
  content: unknown;
  username: string;
}

/** The delete input — by id, scoped to the owner under RLS. */
export interface DeletePostInput {
  postId: string;
  username: string;
}

/** D-03: the ~50-posts-per-portfolio cap, enforced on CREATE (T-13.2-11). */
const MAX_POSTS_PER_PORTFOLIO = 50;

const NOT_SIGNED_IN = 'Not signed in.';
const SAVE_FAILED = 'Something went wrong saving your post. Please try again.';
const INVALID_POST = 'This post can’t be saved.';
const TOO_MANY_POSTS = 'You’ve reached the maximum number of posts.';
const DELETE_FAILED = 'Something went wrong deleting your post. Please try again.';

/**
 * Map a thrown gate error to a failure result. A ZodError carries per-field
 * issues (mirrors `gateErrorToResult` in save-section-action — first issue per
 * path key); any other throw is a generic error.
 */
function gateErrorToResult(e: unknown): Extract<SavePostResult, { ok: false }> {
  const issues = (e as { issues?: unknown }).issues;
  if (Array.isArray(issues)) {
    const fieldErrors: SavePostFieldErrors = {};
    for (const issue of issues as { path?: unknown[]; message?: string }[]) {
      const key = issue.path?.[0];
      if (typeof key === 'string' && !(key in fieldErrors)) {
        fieldErrors[key] = issue.message ?? 'Invalid value';
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, fieldErrors };
    }
  }
  return { ok: false, error: INVALID_POST };
}

/**
 * The three D-18 literal revalidates for a post + the homepage teaser. LITERAL
 * paths, NO second arg on any (RESEARCH Pitfall 1). `oldSlug` (when the slug was
 * renamed on an existing post) revalidates the now-404ing old post path (D-04).
 */
function revalidatePostPaths(username: string, slug: string, oldSlug?: string): void {
  revalidatePath('/' + username + '/blog');
  revalidatePath('/' + username + '/blog/' + slug);
  revalidatePath('/' + username);
  if (oldSlug && oldSlug !== slug) {
    revalidatePath('/' + username + '/blog/' + oldSlug);
  }
}

/**
 * Create or update a blog post. Create vs update is determined by the presence
 * of `input.postId`. `published` is NEVER written here (D-02 / D-20). Returns the
 * row id on success.
 */
export async function savePostAction(input: SavePostInput): Promise<SavePostResult> {
  // 1) Verified identity (AUTH-05 — never getSession).
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // 2) WR-05 hard `sub` guard — never coerce to ''.
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 3) Zod re-parse — THE gate (FND-04). .parse() THROWS; the write is unreachable
  //    when this throws. `published` (if present in the input) is intentionally NOT
  //    propagated to the write (step 4) — draft-by-default (D-02 / D-20).
  let parsed: ReturnType<typeof postContentSchema.parse>;
  try {
    parsed = postContentSchema.parse(input.content);
  } catch (e) {
    return gateErrorToResult(e);
  }

  // 4) Authenticated write under RLS (never service-role). Explicit-column
  //    allowlist — never `...parsed`. `published`/`published_at` are OMITTED so a
  //    content save can never flip the lifecycle flag (T-13.2-12).
  const supabase = await createClient();
  const writeColumns = {
    title: parsed.title,
    slug: parsed.slug,
    body_md: parsed.body_md,
    excerpt: parsed.excerpt ?? null,
    display_date: parsed.display_date ?? null,
    tags: parsed.tags ?? null,
  };

  if (!input.postId) {
    // CREATE. D-03: enforce the ~50-posts/portfolio cap BEFORE the insert
    // (T-13.2-11). The count read is RLS-scoped to the owner's own posts via the
    // `blog_posts.own_all` policy, so a cross-tenant `portfolioId` reads 0 (and the
    // insert below would in turn hit 0-row RLS rejection on a foreign portfolio).
    const { count, error: countError } = await supabase
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', input.portfolioId);
    if (countError) return { ok: false, error: SAVE_FAILED };
    if ((count ?? 0) >= MAX_POSTS_PER_PORTFOLIO) {
      return { ok: false, error: TOO_MANY_POSTS };
    }

    const { data: inserted, error } = await supabase
      .from('blog_posts')
      .insert({ portfolio_id: input.portfolioId, ...writeColumns })
      .select('id')
      .single();
    if (error || !inserted) return { ok: false, error: SAVE_FAILED };

    revalidatePostPaths(input.username, parsed.slug);
    return { ok: true, id: inserted.id };
  }

  // UPDATE. Read the prior slug FIRST (RLS-scoped to the owner) so a slug rename
  // can revalidate the OLD post path too (D-04). A missing/cross-tenant row reads
  // no prior slug (and the UPDATE below hits 0 rows → generic failure).
  const { data: priorRow } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('id', input.postId)
    .single();
  const oldSlug = (priorRow as { slug?: string } | null)?.slug;

  const { data: updatedRows, error } = await supabase
    .from('blog_posts')
    .update(writeColumns)
    .eq('id', input.postId)
    .select('id');
  if (error) return { ok: false, error: SAVE_FAILED };
  // WR-03 / T-13.2-08: a 0-row write is NOT a successful save (cross-tenant target
  // hit the RLS USING clause, or the row is missing). Enumeration-safe generic.
  if (!updatedRows || updatedRows.length === 0) {
    return { ok: false, error: SAVE_FAILED };
  }

  // 5) THREE literal revalidates + the old-slug path on a rename (D-18 / D-04).
  revalidatePostPaths(input.username, parsed.slug, oldSlug);

  // 6) Success.
  return { ok: true, id: input.postId };
}

/**
 * Delete a blog post and free its own-storage body images (WR-03). The delete is
 * RLS-scoped to the owner; the media cleanup recomputes the dropped own-storage
 * URLs from the deleted post's `body_md` and runs AFTER the delete confirms
 * (WR-02). A cross-tenant / missing target affects 0 rows → drops nothing.
 */
export async function deletePostAction(
  input: DeletePostInput,
): Promise<SavePostResult> {
  // 1) Verified identity.
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // 2) WR-05 hard `sub` guard.
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  const supabase = await createClient();

  // 3a) Read the post's body + slug BEFORE the delete (RLS-scoped). The
  //     server-trusted prior state the media diff needs — the client never
  //     supplies it. A missing/cross-tenant row reads nothing → no delete, no drop.
  const { data: priorRow } = await supabase
    .from('blog_posts')
    .select('slug, body_md')
    .eq('id', input.postId)
    .single();

  // 3b) DELETE under RLS. The `blog_posts.own_all` policy + `.eq('id', postId)`
  //     scope it to the owner; a cross-tenant target silently affects 0 rows
  //     (detected via `.select('id')` → generic failure, enumeration-safe).
  const { data: deletedRows, error } = await supabase
    .from('blog_posts')
    .delete()
    .eq('id', input.postId)
    .select('id');
  if (error) return { ok: false, error: DELETE_FAILED };
  if (!deletedRows || deletedRows.length === 0) {
    return { ok: false, error: DELETE_FAILED };
  }

  // 3c) WR-03 SERVER-RECOMPUTED orphan-delete — AFTER the delete confirms (WR-02).
  //     The post is gone → next body is '' → every prior own-storage image is
  //     dropped. `sub` is the server-verified subject (never client-supplied);
  //     deleteStorageObject re-asserts the own-folder guard + origin-lock (D-10),
  //     so a crafted cross-tenant URL is a safe no-op.
  const priorBody = (priorRow as { body_md?: string } | null)?.body_md ?? '';
  const dropped = serverDroppedPostImageUrls(priorBody, '');
  for (const url of dropped) {
    await deleteStorageObject(url, sub);
  }

  // 4) Three literal revalidates — the deleted post path now 404s (D-04 / D-18).
  const slug = (priorRow as { slug?: string } | null)?.slug ?? '';
  revalidatePostPaths(input.username, slug);

  return { ok: true, id: input.postId };
}
