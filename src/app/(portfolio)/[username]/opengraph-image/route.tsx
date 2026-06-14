/**
 * `GET /<username>/opengraph-image` — the dynamic share-card GENERATOR (SHARE-01 / SHARE-02).
 *
 * A specialized Route Handler that renders the Plan-02 `<ShareCard>` to a 1200×630 PNG via
 * `next/og`'s `ImageResponse` (Satori + resvg, both built into next 16.2.6 — ZERO new packages).
 * It is a SIBLING route segment to `page.tsx`, so adding it cannot introduce any dynamism into the
 * public `/[username]` page branch — the page stays `● SSG`/ISR on its own merits (SHARE-02/D-22).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ OPTION (b) — NON-METADATA-FILE Route Handler (RESEARCH §3):                     │
 * │ This lives at `opengraph-image/route.tsx` (a SUBPATH), NOT the sibling          │
 * │ `opengraph-image.tsx` metadata-file convention. Next therefore does NOT          │
 * │ auto-inject an `og:image` tag for it — Plan-03's `buildPublicMetadata` owns ALL  │
 * │ tag emission, so the D-06 precedence ladder (`og_image_url` override → this card)│
 * │ holds (the file convention's auto-injected tag would otherwise outrank           │
 * │ `openGraph.images` and defeat the override).                                     │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ISR / D-22 INVARIANT (mirrors page.tsx:51-69 EXACTLY — Pitfall 6):              │
 * │ `revalidate = 3600` + `dynamicParams = true` + `generateStaticParams` →          │
 * │ `[{username:'jadrianports'}]` MUST match page.tsx or the founder's card won't     │
 * │ prebuild. The read is the SAME cookie-LESS `getPortfolioByUsername` the page      │
 * │ uses (anon key, `persistSession:false`, public_* views only) — so this route      │
 * │ adds ZERO `cookies()`/`headers()`/request-host reads and stays ISR/static. The    │
 * │ URL line's host comes from `siteOrigin()` (env), NEVER the request Host.          │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * SECURITY (threat register T-20-03/04/06):
 * - Reuses the public-views-only read → never leaks a private column (email/role/storage).
 * - Monogram-PRIMARY (D-04): no remote avatar fetch, no `<img>` → ZERO server-side image-fetch /
 *   SSRF surface (the WebP landmine is eliminated by construction — Satori can't decode WebP).
 * - All URLs env-driven via `siteOrigin()` — no host-header injection (D-22/PUB-03).
 */
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { notFound } from 'next/navigation';

import { getPortfolioByUsername } from '@/lib/portfolio/get-portfolio';
import { accentForSlug } from '@/lib/og/template-accent';
import { ShareCard } from '@/lib/og/share-card';
import { siteOrigin } from '@/lib/url';

// node:fs Inter font reads + Satori rasterization require the Node runtime, never edge
// (edge has no filesystem → custom fonts can't load). Same export convention as
// api/page-view/route.ts, different reason (fonts + Satori, not service-role).
export const runtime = 'nodejs';

/** D-21 ISR backstop — 1 hour. Mirrors page.tsx so the founder's card prebuilds + ISR-caches. */
export const revalidate = 3600;

/** Mirror page.tsx: usernames not prebuilt render + cache on first request (bounded by ISR). */
export const dynamicParams = true;

/** The standard summary_large_image dimensions. */
export const size = { width: 1200, height: 630 };

/** The OG image alt text (accessibility / crawler hint). */
export const alt = 'Portfolio share card';

export const contentType = 'image/png';

/**
 * Pre-render the one known seeded username at build time — MUST match page.tsx's
 * `generateStaticParams` byte-for-byte (Pitfall 6) so the founder's card prebuilds.
 */
export async function generateStaticParams(): Promise<{ username: string }[]> {
  return [{ username: 'jadrianports' }];
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Response> {
  const { username } = await params; // Next 16: params is a Promise — MUST await.

  // The SAME cookie-LESS, cache()'d, public-views-only read the page uses — zero new dynamism.
  const data = await getPortfolioByUsername(username);
  if (!data) notFound(); // D-24 — missing/unpublished (mirrors page.tsx), never a blank card.

  // D-01/D-02: the accent is the ONLY thing pulled from the template world, PRE-RESOLVED to a hex
  // here (the card never imports accentForSlug). Null-guard every public-view column (all `| null`).
  const accent = accentForSlug(data.templateSlug);
  const displayName = data.profile.display_name ?? username; // a published page always has one.
  const headline = data.profile.headline; // `null` → the card drops the headline line (D-04).
  // The bare host for the URL line (e.g. `portsmith.vercel.app`) — env-driven, never request Host.
  const siteHost = siteOrigin().replace(/^https?:\/\//, '');

  // Satori needs raw font bytes (ArrayBuffer). Read both bundled Inter static weights via node:fs.
  const [interSemiBold, interRegular] = await Promise.all([
    readFile(join(process.cwd(), 'public/Inter-SemiBold.ttf')),
    readFile(join(process.cwd(), 'public/Inter-Regular.ttf')),
  ]);

  return new ImageResponse(
    (
      <ShareCard
        displayName={displayName}
        headline={headline}
        username={username}
        accent={accent}
        siteHost={siteHost}
      />
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: interSemiBold, weight: 600, style: 'normal' },
        { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
      ],
    },
  );
}
