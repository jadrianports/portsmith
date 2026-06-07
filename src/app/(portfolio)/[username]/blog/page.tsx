/**
 * edgerunner-v2 dedicated /blog list sub-page — `/${username}/blog`.
 *
 * STATIC / ISR (D-22): mirrors `[username]/services/page.tsx` exactly — same
 * `revalidate`, same `generateStaticParams`, cookie-less anon data fetch via
 * `getPortfolioByUsername`. No cookies()/headers()/host-reads — stays ● SSG/ISR
 * in the build output.
 *
 * GATE: resolves the portfolio's template slug; if NOT `edgerunner-v2`, calls
 * `notFound()`. Only this template ships a /blog sub-page.
 *
 * NEXT 16 ASYNC PARAMS: `params` is a Promise — MUST be `await`ed in both
 * `generateMetadata` and the page body.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getPortfolioByUsername } from '@/lib/portfolio/get-portfolio';
import { EdgerunnerV2PageShell } from '@/components/templates/edgerunner-v2/pages/page-shell';
import { BlogIndexContent } from '@/components/templates/edgerunner-v2/pages/blog/blog-index-content';
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

  // Gate: only edgerunner-v2 has a /blog sub-page
  if (data.templateSlug !== 'edgerunner-v2') {
    return { title: 'Not found', robots: { index: false, follow: false } };
  }

  const displayName = data.profile.display_name ?? username;
  const canonical = siteUrl(`/${username}/blog`);

  return {
    title: `Blog — ${displayName}`,
    description:
      'Notes from the grid: essays on edge runtimes, motion design, and type-safe frontend craft.',
    alternates: { canonical },
    openGraph: {
      title: `Blog — ${displayName}`,
      description:
        'Long-form essays on edge runtimes, motion design, and the craft of building software that feels alive.',
      url: canonical,
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

  // GATE: only edgerunner-v2 ships a /blog sub-page
  if (data.templateSlug !== 'edgerunner-v2') notFound();

  return (
    <EdgerunnerV2PageShell data={data} activeNav="blog">
      <BlogIndexContent username={username} />
    </EdgerunnerV2PageShell>
  );
}
