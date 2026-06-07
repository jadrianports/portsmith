/**
 * edgerunner-v2 dedicated /services sub-page — `/${username}/services`.
 *
 * STATIC / ISR (D-22): mirrors `[username]/page.tsx` exactly — same `revalidate`,
 * same `generateStaticParams`, cookie-less anon data fetch via `getPortfolioByUsername`.
 * No cookies()/headers()/host-reads — stays ● SSG/ISR in the build output.
 *
 * GATE: resolves the portfolio's template slug from the fetched data; if it is NOT
 * `edgerunner-v2`, calls `notFound()`. Only this template ships a /services sub-page.
 *
 * NEXT 16 ASYNC PARAMS: `params` is a Promise — MUST be `await`ed in both
 * `generateMetadata` and the page body.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getPortfolioByUsername } from '@/lib/portfolio/get-portfolio';
import { EdgerunnerV2PageShell } from '@/components/templates/edgerunner-v2/pages/page-shell';
import { ServicesPageContent } from '@/components/templates/edgerunner-v2/pages/services-page-content';
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

  // Gate: only edgerunner-v2 has a /services sub-page
  if (data.templateSlug !== 'edgerunner-v2') {
    return { title: 'Not found', robots: { index: false, follow: false } };
  }

  const displayName = data.profile.display_name ?? username;
  const canonical = siteUrl(`/${username}/services`);

  return {
    title: `Services — ${displayName}`,
    description:
      'Full-stack engineering, API builds, UI/UX design, headless CMS, and custom automation — end-to-end ownership, edge-native architecture.',
    alternates: { canonical },
    openGraph: {
      title: `Services — ${displayName}`,
      description:
        'End-to-end product engineering: build, ship, and make it gnarly. Five focused offerings, no contracts, 30-day support.',
      url: canonical,
      images: [data.settings.og_image_url ?? siteUrl('/og-default.png')],
    },
  };
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params; // Next 16: params is a Promise — MUST await.

  // Cookie-LESS anon read — keeps this route ISR-cacheable (D-22, Pitfall 2)
  const data = await getPortfolioByUsername(username);
  if (!data) notFound(); // D-24 — missing/unpublished

  // GATE: only edgerunner-v2 ships a /services sub-page
  if (data.templateSlug !== 'edgerunner-v2') notFound();

  return (
    <EdgerunnerV2PageShell data={data} activeNav="services">
      <ServicesPageContent username={username} />
    </EdgerunnerV2PageShell>
  );
}
