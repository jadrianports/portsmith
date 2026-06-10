/**
 * get-posts — the cookie-LESS anon read lane for published blog posts (SC-2 /
 * D-22). The post-read analog of `get-portfolio.ts`: a React `cache()`'d,
 * cookie-LESS anon Supabase read that the public ISR blog routes (13.2-05) and
 * the homepage teaser (D-16) consume.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ WHY COOKIE-LESS (D-22 / RESEARCH Pitfall 2 — LOAD-BEARING):                    │
 * │ The public post read MUST use a plain `createClient` from                      │
 * │ `@supabase/supabase-js`, NOT `src/lib/supabase/server.ts`'s cookie-reading     │
 * │ `createServerClient`. That module calls `await cookies()`, which silently opts │
 * │ the route into DYNAMIC rendering — killing ISR and the perf budget.            │
 * │ `persistSession: false` + the anon key keeps these reads static / ISR-cacheable.│
 * │ This module is kept SEPARATE from `get-portfolio-owner.ts` (the cookie owner   │
 * │ lane) — the two-module D-22 split (`get-portfolio.ts:106` note).               │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * SECURITY (D-22 / three-layer public-column safety):
 * - Reads ONLY the column-restricted `public_blog_posts` `security_invoker` view —
 *   NEVER the base `blog_posts` table (the view enforces published-only +
 *   non-deleted/non-locked portfolio + column safety; this module never re-implements
 *   those filters). The `published` flag is not even selectable here.
 * - Uses the ANON key only — never the service-role key.
 * - `import 'server-only'` keeps it (and the env reads) out of any client bundle.
 *
 * DERIVED `reading_time` (D-06): NOT stored on the row — computed on read from the
 * Markdown `body_md` via `readingTimeFromMarkdown` (the D-08 "single source of
 * truth is the Markdown" spirit; no stored-derived drift).
 *
 * NULLABILITY (database.ts verified): EVERY column on `public_blog_posts` Row is
 * nullable. Consumers null-guard; this module surfaces the raw view Row plus the
 * derived `reading_time`.
 *
 * Source: the cookie-less anon `createClient` + `cache()` + per-read `.error`
 * inspection (WR-02) from `get-portfolio.ts:30-129`; the view + columns from the
 * generated `Database['public']['Views']['public_blog_posts']`; the reading-time
 * derivation from `@/lib/markdown/reading-time` (`readingTimeFromMarkdown`, D-06).
 */
import 'server-only';

import { cache } from 'react';

import { createClient } from '@supabase/supabase-js';

import { readingTimeFromMarkdown } from '@/lib/markdown/reading-time';
import type { Database } from '@/types/database';

/** The full `public_blog_posts` view Row (every column nullable). */
type PublicPostRow = Database['public']['Views']['public_blog_posts']['Row'];

/**
 * The projected post columns the blog routes + teaser consume (the `.select`
 * subset — NO `published` flag, no deferred cover/meta columns). The query
 * returns exactly this narrower shape, so the read type is a `Pick` of the view
 * Row rather than the full Row.
 */
type PublicPostColumns = Pick<
  PublicPostRow,
  | 'id'
  | 'portfolio_id'
  | 'slug'
  | 'title'
  | 'excerpt'
  | 'tags'
  | 'display_date'
  | 'body_md'
  | 'published_at'
>;

/**
 * A published post as the public read returns it: the projected view columns
 * plus the D-06 derived `reading_time` (computed on read, not stored).
 */
export type PublishedPost = PublicPostColumns & { reading_time: string };

/** The public columns the blog routes + teaser consume (no `published` flag). */
const POST_COLUMNS =
  'id, portfolio_id, slug, title, excerpt, tags, display_date, body_md, published_at';

/** Build the cookie-LESS anon client (Pitfall 2 — never the cookie-reading server client). */
function anonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

/** Attach the D-06 derived reading time to a projected view Row. */
function withReadingTime(row: PublicPostColumns): PublishedPost {
  return { ...row, reading_time: readingTimeFromMarkdown(row.body_md ?? '') };
}

/**
 * Every published post for a portfolio, newest first (by `display_date`, the
 * editable D-05 date). Reads the `public_blog_posts` view only. A real read error
 * THROWS (so ISR never caches a hard miss for a published blog — WR-02); an empty
 * result is a clean empty array.
 *
 * Wrapped in React `cache()` so a route's `generateMetadata` + body dedupe to one
 * read.
 */
export const getPublishedPosts = cache(
  async (portfolioId: string): Promise<PublishedPost[]> => {
    const db = anonClient();
    const { data, error } = await db
      .from('public_blog_posts')
      .select(POST_COLUMNS)
      .eq('portfolio_id', portfolioId)
      .order('display_date', { ascending: false });
    if (error) {
      throw new Error(`public_blog_posts read failed: ${error.message}`);
    }
    return (data ?? []).map(withReadingTime);
  },
);

/**
 * One published post by `(portfolioId, slug)`, or `null` when there is no such
 * published post (drives `notFound()` in the post route). A real read error
 * THROWS; a clean missing row → `null` (WR-02 — `.error` inspected separately).
 *
 * Wrapped in React `cache()` so the route's `generateMetadata` + body share one read.
 */
export const getPublishedPostBySlug = cache(
  async (portfolioId: string, slug: string): Promise<PublishedPost | null> => {
    const db = anonClient();
    const { data, error } = await db
      .from('public_blog_posts')
      .select(POST_COLUMNS)
      .eq('portfolio_id', portfolioId)
      .eq('slug', slug)
      .maybeSingle();
    if (error) {
      throw new Error(`public_blog_posts read failed: ${error.message}`);
    }
    if (!data) return null; // genuine not-found / unpublished
    return withReadingTime(data);
  },
);

/**
 * The published-post slugs for ONE username, for build-time `generateStaticParams`
 * (Pattern 2 / SC-2). Resolves the username → portfolio via the cookie-less
 * `public_profiles`/`public_portfolios` views, then lists that portfolio's published
 * post slugs from `public_blog_posts` (newest first). Cookie-LESS throughout
 * (Pitfall 2 — `await cookies()` here would flip the route to dynamic and break
 * D-22). Returns `[]` for a missing/unpublished user OR a portfolio with no posts —
 * the post route's `dynamicParams = true` then covers any non-prerendered slug
 * on-demand. A real read error THROWS (WR-02 — never silently prerender zero pages
 * for a published blog).
 *
 * NOT `cache()`'d: it runs only at build (`generateStaticParams`), where there is no
 * request-scoped dedupe to share with.
 */
export async function getPublishedPostSlugs(username: string): Promise<string[]> {
  const db = anonClient();

  const { data: profile, error: profileError } = await db
    .from('public_profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (profileError) {
    throw new Error(`public_profiles (slugs) read failed: ${profileError.message}`);
  }
  if (!profile?.id) return []; // missing/unpublished user → nothing to prerender

  const { data: portfolio, error: portfolioError } = await db
    .from('public_portfolios')
    .select('id')
    .eq('user_id', profile.id)
    .maybeSingle();
  if (portfolioError) {
    throw new Error(`public_portfolios (slugs) read failed: ${portfolioError.message}`);
  }
  if (!portfolio?.id) return [];

  const { data, error } = await db
    .from('public_blog_posts')
    .select('slug')
    .eq('portfolio_id', portfolio.id)
    .order('display_date', { ascending: false });
  if (error) {
    throw new Error(`public_blog_posts (slugs) read failed: ${error.message}`);
  }
  return (data ?? [])
    .map((r) => r.slug)
    .filter((s): s is string => typeof s === 'string' && s.length > 0);
}
