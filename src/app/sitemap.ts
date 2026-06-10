/**
 * `app/sitemap.ts` — the public crawl manifest (SEO-02 / D-09; RESEARCH "Code
 * Examples" → app/sitemap.ts). Next generates `/sitemap.xml` from the typed
 * `MetadataRoute.Sitemap` this default export returns.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ PUBLISHED-ONLY BY CONSTRUCTION (SEO-02 / T-06-08): it reads the                │
 * │ `public_profiles` VIEW, which already encodes `published AND deleted_at IS     │
 * │ NULL AND locked=false` (portfolio_is_public()). Reading the view — never a     │
 * │ base table — means a locked/unpublished/deleted portfolio simply has no row    │
 * │ here, so no extra WHERE is needed and the sitemap can never leak a withheld    │
 * │ page. The username filter drops any null-username row the view may present.    │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ COOKIE-LESS READ (RESEARCH Pitfall 2 / SHARED-A — LOAD-BEARING): this uses a   │
 * │ plain `createClient` from `@supabase/supabase-js` with                         │
 * │ `{ auth: { persistSession: false } }` — the SAME posture as get-portfolio.ts.  │
 * │ It must NOT use the cookie-reading SSR server client: a cookie/host            │
 * │ coupling would re-introduce request-time dynamism. Every URL is built from     │
 * │ `siteUrl()` (env-driven), never the request host (PUB-03 / T-06-06).           │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
import type { MetadataRoute } from 'next';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';
import { siteUrl } from '@/lib/url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Cookie-LESS anon client (Pitfall 2) — uses the NEXT_PUBLIC_* runtime env names,
  // never a session/cookie/host read, so the build stays host-decoupled.
  const db = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  // public_profiles already filters published + non-deleted + non-locked (SEO-02).
  // Select `id` too so we can bridge a post's portfolio → its owner's username
  // (the post view is portfolio_id-keyed, not username-keyed).
  const { data: profiles } = await db.from('public_profiles').select('id, username');

  const publishReadyProfiles = (profiles ?? []).filter(
    (p): p is { id: string | null; username: string } => !!p.username,
  );
  const usernameSet = new Set(publishReadyProfiles.map((p) => p.username));
  const userIdToUsername = new Map<string, string>(
    publishReadyProfiles
      .filter((p): p is { id: string; username: string } => !!p.id)
      .map((p) => [p.id, p.username]),
  );

  // Per-portfolio homepage entries (existing behavior, :43-49).
  const profileEntries = publishReadyProfiles.map((p) => ({
    url: siteUrl(`/${p.username}`),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // D-18 — published-post URLs. `public_blog_posts` is published-only + portfolio-
  // published by construction (blog_post_is_public DEFINER helper), so reading the
  // view — never the base table — means no withheld post can leak (T-13.2-13). Bridge
  // each post's portfolio → owner username via public_portfolios + the publish-ready
  // profile set, so only posts of a publish-ready (indexable) portfolio enter the
  // sitemap (the isPublishReady noindex inheritance, D-18). Cookie-less; siteUrl()
  // for every URL (PUB-03). A post row may also carry `username` directly (test
  // fixture / future view column) — honored as a fast path before the join.
  const { data: portfolios } = await db
    .from('public_portfolios')
    .select('id, user_id');
  const portfolioIdToUsername = new Map<string, string>();
  for (const pf of portfolios ?? []) {
    if (pf.id && pf.user_id) {
      const uname = userIdToUsername.get(pf.user_id);
      if (uname) portfolioIdToUsername.set(pf.id, uname);
    }
  }

  const { data: posts } = await db
    .from('public_blog_posts')
    .select('portfolio_id, slug');

  const postEntries = (posts ?? [])
    .map((post) => {
      const slug = post.slug;
      if (!slug) return null;
      // Resolve the post's owner username: the portfolio→profile join (real view),
      // falling back to a `username` field on the row itself when present (fixture).
      const viaJoin = post.portfolio_id
        ? portfolioIdToUsername.get(post.portfolio_id)
        : undefined;
      const direct = (post as { username?: string | null }).username ?? undefined;
      const username =
        viaJoin ?? (direct && usernameSet.has(direct) ? direct : undefined);
      if (!username) return null;
      return {
        url: siteUrl(`/${username}/blog/${slug}`),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  return [
    { url: siteUrl('/'), changeFrequency: 'monthly', priority: 1 },
    ...profileEntries,
    ...postEntries,
  ];
}
