/**
 * `app/robots.ts` — the crawl policy (SEO-02 / D-09; RESEARCH "Code Examples" →
 * app/robots.ts). Next generates `/robots.txt` from the typed
 * `MetadataRoute.Robots` this default export returns.
 *
 * Allows the public portfolio pages (`/`) and DISALLOWS the private surfaces —
 * `/dashboard` (the owner CMS), `/api` (the service-role routes), and `/admin`
 * (the T&S operator console). The sitemap reference is built from `siteUrl()`
 * (env-driven), never the request host (PUB-03 / T-06-06), so the `.vercel.app →
 * portsmith.app` switch is an env change only.
 */
import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/api', '/admin'],
    },
    sitemap: siteUrl('/sitemap.xml'),
  };
}
