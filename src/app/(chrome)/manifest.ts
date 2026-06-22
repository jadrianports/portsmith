/**
 * `manifest.ts` — the PWA web app manifest (D-10), Next 16 `MetadataRoute.Manifest`
 * convention. Served at `/manifest.webmanifest` and auto-linked from chrome `<head>`.
 * Lives under `(chrome)/` so it scopes to chrome routes only — there is no app-root
 * layout, so it does NOT auto-apply to the public `(portfolio)` tree (BRAND-05).
 *
 * The icons array references the static `/icon.svg` favicon plus the two installable PNGs
 * served by the sibling `app-icon/[size]/route.tsx` route handler (`/app-icon/192` +
 * `/app-icon/512`), both `purpose: 'any maskable'` so Android can mask them.
 *
 * `theme_color` / `background_color` use the LIGHT @theme values (`--color-brand`
 * #1B3A2E / `--color-background` #FBFAF8): a manifest is a FIXED single-variant asset
 * (it has no light/dark mechanism), so the light brand values are baked per UI-SPEC.
 * Copy (name/short_name/description) is verbatim from the UI-SPEC Copywriting Contract.
 */
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Portsmith',
    short_name: 'Portsmith',
    description:
      'Publish a polished, single-scroll portfolio by filling in structured content and choosing a curated template.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FBFAF8', // --color-background (light) — fixed single-variant asset
    theme_color: '#1B3A2E', // --color-brand (light) — evergreen
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      {
        src: '/app-icon/192',
        type: 'image/png',
        sizes: '192x192',
        purpose: 'maskable',
      },
      {
        src: '/app-icon/512',
        type: 'image/png',
        sizes: '512x512',
        purpose: 'maskable',
      },
    ],
  };
}
