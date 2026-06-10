/**
 * edgerunner-v2 dedicated /services sub-page — `/${username}/services`.
 *
 * STATIC / ISR (D-22): mirrors `[username]/page.tsx` exactly — same `revalidate`,
 * same `generateStaticParams`, cookie-less anon data fetch via `getPortfolioByUsername`.
 * No cookies()/headers()/host-reads — stays ● SSG/ISR in the build output.
 *
 * GATE (D-14/D-15): consults the resolved template spec — if `spec.pages` does NOT
 * include `'services'`, calls `notFound()`. Standard templates omit `pages` so they
 * 404 here; only the exclusive-lane edgerunner-v2 opts in. The spec is already
 * resolved in the cookie-less read, so the gate adds NO new DB read (D-22).
 *
 * NEXT 16 ASYNC PARAMS: `params` is a Promise — MUST be `await`ed in both
 * `generateMetadata` and the page body.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getPortfolioByUsername } from '@/lib/portfolio/get-portfolio';
import { EdgerunnerV2PageShell } from '@/components/templates/edgerunner-v2/pages/page-shell';
import { ServicesPageContent } from '@/components/templates/edgerunner-v2/pages/services-page-content';
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

  // D-14 gate: only a template whose spec opts into the 'services' page renders one.
  if (!data.templateSpec.pages?.includes('services')) {
    return { title: 'Not found', robots: { index: false, follow: false } };
  }

  const displayName = data.profile.display_name ?? username;
  const canonical = siteUrl(`/${username}/services`);
  // Template-neutral, profession-agnostic services description for the SHARED route
  // metadata — NO template-specific voice (the on-page copy is the template's job).
  const description = `Services offered by ${displayName}.`;

  return {
    title: `Services — ${displayName}`,
    description,
    alternates: { canonical },
    // D-18: inherit the portfolio's isPublishReady noindex gate (no side-door).
    ...subRouteRobots(data),
    openGraph: {
      title: `Services — ${displayName}`,
      description,
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

  // D-14 gate: 404 unless the resolved spec declares the 'services' page.
  if (!data.templateSpec.pages?.includes('services')) notFound();

  return (
    <EdgerunnerV2PageShell data={data} activeNav="services">
      <ServicesPageContent username={username} />
    </EdgerunnerV2PageShell>
  );
}
