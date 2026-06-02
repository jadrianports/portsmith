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
  const { data } = await db.from('public_profiles').select('username');

  const entries = (data ?? [])
    .filter((p): p is { username: string } => !!p.username)
    .map((p) => ({
      url: siteUrl(`/${p.username}`),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

  return [
    { url: siteUrl('/'), changeFrequency: 'monthly', priority: 1 },
    ...entries,
  ];
}
