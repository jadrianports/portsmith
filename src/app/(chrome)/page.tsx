/**
 * `/` — the public landing page (Phase 22, LAND-01..05 / D-07 / D-11 / D-12).
 *
 * A plain presentational RSC. It reads NO session and NO dynamic API (no `cookies()`,
 * `headers()`, `searchParams`, `createClient`, or `getVerifiedClaims`) — D-07: any
 * such read flips `/` off SSG and regresses LAND-05. `export const dynamic =
 * 'force-static'` is the explicit guard (D-07/D-12 / T-22-04): Next THROWS at build if
 * a future edit sneaks in a dynamic read, and it keeps `pm.routes['/']` present (the
 * tests/build/route-table-landing-ssg.test.ts assertion).
 *
 * The metadata mirrors the in-repo `buildPublicMetadata` SHAPE (OG + Twitter
 * summary_large_image) but STATIC. The OG/Twitter card IMAGE is supplied by the sibling
 * `(chrome)/opengraph-image.tsx` file-convention card via Next metadata inheritance
 * (Phase 32 / BRAND-04 / D-11) — the old explicit `og-default.png` image refs were
 * removed here so they no longer outrank that card for `/`. All absolute URLs derive from
 * `siteUrl()` (D-11 / T-22-03); the file-convention OG card resolves against the
 * `metadataBase` set on the `(chrome)` root layout (CR-01 — driven by `siteOrigin()`/
 * `NEXT_PUBLIC_SITE_URL`), so its `og:image` URL is absolute in production, not localhost.
 *
 * The `(chrome)` root layout already supplies `<html>`/`<body>`/`<Providers>` + Inter +
 * BotID and has NO shared nav — so the page supplies ONLY its own header/main/footer.
 * Every landing component is imported from `@/components/landing/*` — NEVER
 * `components/templates/*` (the two-layer wall, enforced by the landing-isolation guard).
 */
import type { Metadata } from 'next';

import { FinalCta } from '@/components/landing/final-cta';
import { Footer } from '@/components/landing/footer';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { LandingHeader } from '@/components/landing/landing-header';
import { Proof } from '@/components/landing/proof';
import { siteUrl } from '@/lib/url';

/**
 * D-07 / D-12 / T-22-04 — the explicit static guard. `/` is the static chrome
 * exception (the dashboard/admin/insights chrome surfaces are `force-dynamic`); this
 * value makes the build FAIL if a dynamic/session read is ever added here.
 */
export const dynamic = 'force-static';

const TITLE = 'Portsmith — a polished portfolio in about 15 minutes';
const DESCRIPTION =
  "Pick a curated template, fill in your experience, and publish — Portsmith handles the design, so you get a page you're proud to share.";
const CANONICAL = siteUrl('/');

/**
 * D-11 — full front-door metadata. Static homepage variant of the `buildPublicMetadata`
 * shape: marketing title/description and the siteUrl canonical. The OG/Twitter card image
 * is now supplied by the `(chrome)/opengraph-image.tsx` file-convention card via Next
 * metadata inheritance — the explicit `og-default.png` refs are REMOVED so they no longer
 * outrank the file convention for `/` (Phase 32 / BRAND-04 / D-11). `public/og-default.png`
 * and its generator/tests stay — the out-of-scope `(portfolio)` routes still reference it.
 * `twitter.card: 'summary_large_image'` is kept so the inherited card renders large.
 */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: CANONICAL,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function Home() {
  return (
    <>
      <LandingHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Proof />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
