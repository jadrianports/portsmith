/**
 * edgerunner-v2 dedicated /blog list sub-page — `/${username}/blog`.
 *
 * STATIC / ISR (D-22): mirrors `[username]/services/page.tsx` exactly — same
 * `revalidate`, same `generateStaticParams`, cookie-less anon data fetch via
 * `getPortfolioByUsername`. No cookies()/headers()/host-reads — stays ● SSG/ISR
 * in the build output.
 *
 * GATE (D-14/D-15): consults the resolved template spec — if `spec.pages` does NOT
 * include `'blog'`, calls `notFound()`. Standard templates omit `pages` (→ undefined)
 * so they 404 here; only the exclusive-lane edgerunner-v2 opts in. The spec is already
 * resolved in the cookie-less read (`get-portfolio.ts` → `resolveSpec`), so the gate
 * adds NO new DB read — the route stays ● SSG/ISR (D-22).
 *
 * NEXT 16 ASYNC PARAMS: `params` is a Promise — MUST be `await`ed in both
 * `generateMetadata` and the page body.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getPortfolioByUsername } from '@/lib/portfolio/get-portfolio';
import { getPublishedPosts } from '@/lib/portfolio/get-posts';
import { EdgerunnerV2PageShell } from '@/components/templates/edgerunner-v2/pages/page-shell';
import { BlogIndexContent } from '@/components/templates/edgerunner-v2/pages/blog/blog-index-content';
import { subRouteRobots } from '@/lib/seo/public-metadata';
import { siteUrl } from '@/lib/url';

/** D-21 ISR backstop — matches [username]/page.tsx */
export const revalidate = 3600;

/** Allow on-demand ISR for usernames not pre-rendered at build time */
export const dynamicParams = true;

/** Pre-render the seeded founder at build time — mirrors [username]/page.tsx */
export async function generateStaticParams(): Promise<{ username: string }[]> {
  return [{ username: 'jadrianports' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params; // Next 16: params is a Promise — MUST await.

  const data = await getPortfolioByUsername(username);
  if (!data) {
    return { title: 'Not found', robots: { index: false, follow: false } };
  }

  // D-14 gate: only a template whose spec opts into the 'blog' page renders one.
  if (!data.templateSpec.pages?.includes('blog')) {
    return { title: 'Not found', robots: { index: false, follow: false } };
  }

  const displayName = data.profile.display_name ?? username;
  const canonical = siteUrl(`/${username}/blog`);
  // Template-neutral, profession-agnostic blog description for the SHARED route
  // metadata — NO template-specific voice (the on-page heading/intro is the
  // template's own job, inside the template folder). Keeps the meta correct for any
  // present/future template that opts into a blog page, not just edgerunner-v2.
  const description = `Articles and writing by ${displayName}.`;

  return {
    title: `Blog — ${displayName}`,
    description,
    alternates: { canonical },
    // D-18: inherit the portfolio's isPublishReady noindex gate (no posts-as-indexable
    // side-door) — withheld-but-reachable while the parent portfolio is incomplete.
    ...subRouteRobots(data),
    openGraph: {
      title: `Blog — ${displayName}`,
      description,
      url: canonical,
      images: [data.settings.og_image_url ?? siteUrl('/og-default.png')],
    },
    // Twitter/X large-image card for the blog index.
    twitter: {
      card: 'summary_large_image',
      title: `Blog — ${displayName}`,
      description,
      images: [data.settings.og_image_url ?? siteUrl('/og-default.png')],
    },
  };
}

export default async function BlogIndexPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params; // Next 16: params is a Promise — MUST await.

  // Cookie-LESS anon read — keeps this route ISR-cacheable (D-22, Pitfall 2)
  const data = await getPortfolioByUsername(username);
  if (!data) notFound(); // D-24 — missing/unpublished

  // D-14 gate: 404 unless the resolved spec declares the 'blog' page (posts stay
  // saved as data on a non-granted template; the URL 404s).
  if (!data.templateSpec.pages?.includes('blog')) notFound();

  // DB posts — a SECOND cookie-less anon read (Pitfall 2; D-22 preserved). Sorted
  // newest-first by display_date in get-posts. The pink/cyan/purple accent is
  // template decoration cycled BY INDEX in BlogIndexContent (D-06 — not stored).
  // `portfolioId` is non-null here (a missing portfolio was notFound()-ed above).
  const posts = data.portfolioId ? await getPublishedPosts(data.portfolioId) : [];

  return (
    <EdgerunnerV2PageShell data={data} activeNav="blog">
      <BlogIndexContent username={username} posts={posts} />
    </EdgerunnerV2PageShell>
  );
}
