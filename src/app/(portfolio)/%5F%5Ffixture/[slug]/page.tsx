/**
 * The STACK-FREE fixture render route (Phase-10 Plan 02; RESEARCH Pattern 1) — the ONE
 * render target the four Wave-2 render gates (conformance, a11y, parity, thumbnails) hit.
 *
 * `/__fixture/<slug>?variant=full|null[&sub=empty|null-content]` renders any template over
 * an INJECTED `PortfolioData` fixture — NO live stack, NO DB, NO cookies/headers. It lives
 * in the `(portfolio)` route group so it inherits the lean, chrome-free public root (matching
 * the real public render shell), but it is the DELIBERATE OPPOSITE of the public
 * `/[username]` page on the ISR axis (D-22):
 *
 * ┌─────────────────────────────────────────────────────────────────────────────────────┐
 * │ FOLDER NAME (load-bearing, fixed in Plan 10-04): this directory is named               │
 * │ `%5F%5Ffixture` — the URL-ENCODED form of `__fixture`. Next App Router treats ANY      │
 * │ folder whose name STARTS WITH `_` as a PRIVATE folder and EXCLUDES it from the route   │
 * │ tree (it never compiles; every request 404s — exactly what a bare `__fixture` folder   │
 * │ did under Next 16/Turbopack). Naming the folder with percent-encoded underscores opts  │
 * │ it BACK into routing while Next decodes the segment to the PUBLIC URL `/__fixture/      │
 * │ <slug>` — so `renderFixture` / the `gate:*` npm scripts / Plan 10-06 W6 all still hit  │
 * │ `/__fixture/<slug>` UNCHANGED. Do NOT rename this folder to a bare `__fixture`; it      │
 * │ will silently stop routing and every render gate will fail to find `.tmpl-<slug>`.     │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   - `export const dynamic = 'force-dynamic'` — explicitly NOT the ISR path. It is NOT in
 *     any `generateStaticParams` and has NO `revalidate`, so it never prerenders and never
 *     appears on the public SSG surface. `route-table-ssg.test.ts` keys strictly on
 *     `/jadrianports` + `srcRoute === '/[username]'` and `check-bundle-budget.ts` measures
 *     only `ROUTE_INSTANCE='/jadrianports'`, so this separate dynamic route does NOT trip
 *     the SSG gate or the bundle budget (RESEARCH Open Question 2 / T-10-02-SSGPERTURB).
 *   - `if (process.env.NODE_ENV === 'production') notFound()` — ASVS V4 prod-guard
 *     (T-10-02-FIXROUTE): a production build serves NOTHING here. Plan 10-06 executes a prod
 *     build and asserts the 404. It is a dev/test-only render surface.
 *
 * W8 GRAPH-SAFETY (T-10-02-GRAPHLEAK): the dev server (Playwright `webServer: npm run dev`)
 * COMPILES anything this route imports into the Next graph. So the fixture builders are
 * imported from the SRC-SIDE `@/lib/fixtures/*` ONLY — NEVER from `tests/` (which would pull
 * test source into the prod graph). The golden CONTENT was relocated src-side for exactly
 * this reason (Plan 02 Task 1).
 *
 * Next 16: `params` / `searchParams` are Promises — `await` both (the sync forms are removed).
 *
 * The live-stack `e2e/helpers/cms-auth.ts` path (createConfirmedOwner → seed → publish →
 * render `/<username>`) is the proven FALLBACK if this route is ever undesirable.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TemplateRenderer } from '@/components/templates/template-renderer';
import { allNullPortfolioData, type AllNullVariant } from '@/lib/fixtures/portfolio-data-allnull';
import { goldenPortfolioData } from '@/lib/fixtures/golden-portfolio-data';

/** Explicitly NOT the ISR path (D-22) — this route never prerenders, never goes on SSG. */
export const dynamic = 'force-dynamic';

/**
 * A static `<title>` so the test-only fixture render carries one — matching the REAL public
 * `/[username]` page, which always sets a title via `generateMetadata`. Without this, the
 * a11y gate's axe scan would flag a `document-title` (WCAG 2.4.2) violation that is a HARNESS
 * artifact (the fixture route's missing metadata), NOT a template defect — a false-positive
 * that would mask real findings. The title is generic (the gate evaluates the template body,
 * never this string).
 */
export const metadata: Metadata = {
  title: 'Template fixture render (dev/test only)',
};

export default async function FixtureRenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ variant?: string; sub?: string }>;
}) {
  // ASVS V4 prod-guard (T-10-02-FIXROUTE): a prod build serves nothing here.
  if (process.env.NODE_ENV === 'production') notFound();

  const { slug } = await params; // Next 16: params is a Promise — MUST await.
  const { variant, sub } = await searchParams; // Next 16: searchParams is a Promise — MUST await.

  const data =
    variant === 'null'
      ? allNullPortfolioData(slug, sub === 'null-content' ? 'null-content' : ('empty' as AllNullVariant))
      : goldenPortfolioData(slug);

  return <TemplateRenderer slug={slug} data={data} />;
}
