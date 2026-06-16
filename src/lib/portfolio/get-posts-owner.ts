/**
 * get-posts-owner — the AUTHENTICATED, owner-scoped post LIST read (drafts +
 * published) that backs the CMS blog panel (SC-1 / D-19 / D-22).
 *
 * This is the SEPARATE counterpart to the cookie-LESS public post read
 * (`get-posts.ts`). It INVERTS two things versus the public read, exactly the way
 * `get-portfolio-owner.ts` inverts `get-portfolio.ts`:
 *
 *   1. CLIENT: it uses the AUTHENTICATED cookie/RLS `createClient()` from
 *      `@/lib/supabase/server` (NOT the anon `@supabase/supabase-js` client),
 *      because the owner needs to read their OWN UNPUBLISHED (draft) rows under
 *      the `blog_posts.own_all` RLS policy.
 *   2. TABLES: it reads the BASE `blog_posts` table — NOT the `public_blog_posts`
 *      view, which filters `published=true` and would hide exactly the drafts the
 *      blog panel exists to list and edit.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ISOLATION RULE (D-22 / RESEARCH Pitfall 2 — LOAD-BEARING):                     │
 * │ This module MUST stay separate from `get-posts.ts`. The public post lane must  │
 * │ never transitively import a cookie-reading client (`@/lib/supabase/server`     │
 * │ calls `await cookies()`), which would silently opt the public ISR blog routes  │
 * │ into DYNAMIC rendering for every visitor — killing ISR and the perf budget.    │
 * │ The owner blog panel reaches this module from the (force-dynamic) dashboard    │
 * │ surface only; the anon read stays cookie-less in `get-posts.ts`.               │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * SECURITY (mirrors the owner portfolio read):
 * - getClaims() (verified JWT) — NEVER getSession() (AUTH-05). A null/`sub`-less
 *   claim returns [] (no rows for an unauthenticated/identity-less caller).
 * - The `blog_posts.own_all` RLS policy already scopes the read to the caller's own
 *   rows; the explicit `portfolio_id` filter narrows to the owner's portfolio. A
 *   cross-tenant portfolio id reads 0 rows under RLS (no leak).
 *
 * `import 'server-only'` keeps this (and the cookie/env reads) out of any client
 * bundle.
 */
import 'server-only';

import { createClient } from '@/lib/supabase/server';

/**
 * One owner post as the blog panel lists it — the META columns only (NO `body_md`:
 * the list never needs the full Markdown body, and omitting it keeps the list
 * payload small). `published` distinguishes the draft vs published status dot.
 */
export interface OwnerPostListItem {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  published_at: string | null;
  display_date: string | null;
  updated_at: string;
}

/** The list columns — the meta subset (no body_md). */
const POST_LIST_COLUMNS =
  'id, slug, title, published, published_at, display_date, updated_at';

/**
 * The FULL editable post as the editor opens it (BLOG-01 / D-01) — the meta subset
 * PLUS the heavy `body_md` Markdown body + `excerpt` + `tags`. Deliberately SEPARATE
 * from `POST_LIST_COLUMNS`: per D-01 the list stays body-less (small payload), and
 * the body is fetched lazily, only when the editor actually opens a post.
 */
export interface OwnerPostFull {
  id: string;
  title: string;
  slug: string;
  body_md: string;
  excerpt: string | null;
  display_date: string | null;
  tags: string[] | null;
  published: boolean;
}

/** The single-post EDIT columns — the meta subset PLUS body_md, excerpt, tags. */
const POST_EDIT_COLUMNS =
  'id, title, slug, body_md, excerpt, display_date, tags, published';

/**
 * Every post (draft + published) for the owner's portfolio, most-recently-edited
 * first (by `updated_at`). Reads the BASE `blog_posts` table under RLS so drafts
 * are included (unlike the published-only public view). Returns [] for an
 * unauthenticated caller or a portfolio with no posts; THROWS on a real read error
 * (so the panel renders an error rather than a misleading empty list).
 */
export async function getOwnerPosts(
  portfolioId: string,
): Promise<OwnerPostListItem[]> {
  const db = await createClient();

  // Verified identity (AUTH-05 — getClaims, never getSession). No verified sub →
  // no rows (RLS would also block, but bail early without a DB round-trip).
  const { data: claimsData, error: claimsError } = await db.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) return [];

  const { data, error } = await db
    .from('blog_posts')
    .select(POST_LIST_COLUMNS)
    .eq('portfolio_id', portfolioId)
    .order('updated_at', { ascending: false });
  if (error) {
    throw new Error(`blog_posts (owner) read failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    published: row.published,
    published_at: row.published_at,
    display_date: row.display_date,
    updated_at: row.updated_at,
  }));
}

/**
 * The LAZY single-post owner read (BLOG-01 / D-01) — the full editable post (incl.
 * `body_md`) for ONE post id, fetched only when the editor opens that post. Mirrors
 * `getOwnerPosts`: the AUTHENTICATED cookie/RLS client + a verified-identity guard +
 * the BASE `blog_posts` table (NOT `public_blog_posts` — a draft must be editable).
 *
 * SECURITY (T-26-04 — cross-tenant body leak): the `blog_posts.own_all` RLS policy
 * scopes the read to the caller's own rows, so `.eq('id', postId)` on a FOREIGN id
 * reads 0 rows under RLS → `maybeSingle()` returns null → this returns null (no body
 * leak). A null/`sub`-less claim returns null before any DB round-trip.
 */
export async function getOwnerPostById(
  postId: string,
): Promise<OwnerPostFull | null> {
  const db = await createClient();

  // Verified identity (AUTH-05 — getClaims, never getSession). No verified sub →
  // no row (RLS would also block, but bail early without a DB round-trip).
  const { data: claimsData, error: claimsError } = await db.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) return null;

  const { data, error } = await db
    .from('blog_posts')
    .select(POST_EDIT_COLUMNS)
    .eq('id', postId) // RLS own_all scopes to the owner; a foreign id → 0 rows → null.
    .maybeSingle();
  if (error) {
    throw new Error(`blog_posts (owner, single) read failed: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as OwnerPostFull;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    body_md: row.body_md,
    excerpt: row.excerpt,
    display_date: row.display_date,
    tags: row.tags,
    published: row.published,
  };
}
