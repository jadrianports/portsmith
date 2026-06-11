import './portfolio.css';

import { BeaconMount } from '@/components/portfolio/beacon-mount';

/**
 * (portfolio) root layout — the LEAN PUBLIC ROOT (D-03).
 *
 * Since the top-level `app/layout.tsx` was deleted (Plan 08-02 Task 1), every
 * route-group layout is now a Next 16 root layout. This is the public portfolio
 * root: it owns its OWN `<html>`/`<body>` and ships NONE of the platform chrome.
 *
 * Deliberately absent (the whole point of the chrome-free strip):
 *   - NO Inter web font — the public render must not pull the chrome UI font.
 *   - NO client provider tree (TanStack Query + devtools) — keeps that off the
 *     public first-load JS (Success Criterion 2). The public page is a cookie-less
 *     anon ISR read; it needs no client query cache.
 *   - NO chrome `globals.css` — `import './portfolio.css'` ships Tailwind preflight
 *     ONLY (D-02), with none of the chrome design tokens.
 *
 * D-05 — the old body-gutter inline-style hack (which forced the html/body
 * background to be see-through) is REMOVED. Its sole purpose was to neutralize the
 * chrome `body { background: var(--color-background) }` rule that leaked from the shared
 * `globals.css`. That chrome `body` rule no longer loads on this route (the lean
 * root imports `portfolio.css`, not `globals.css`), so the leak's root cause is
 * gone. Tailwind preflight supplies `body { margin: 0 }`, and the template's
 * `.tmpl-*` root paints `background: var(--bg)` + `min-height: 100vh` (theme.css),
 * so the full-bleed template canvas is the only thing visible.
 *
 * PAGE-VIEW BEACON (ANLY-01 / D-02 / D-03 / D-20): this is the SOLE layout wrapping
 * all four public routes (`[username]`, `[username]/blog`, `[username]/blog/[slug]`,
 * `[username]/services`), so the single `<BeaconMount/>` mounted here covers every
 * public route (D-03) for every template — current and future — with zero per-page
 * wiring (D-02). The beacon is PLATFORM CHROME — it is NEVER mounted in a
 * `templates/*` folder (two-layer identity). `BeaconMount` is a `{ ssr:false }`-split
 * client island, so the server render branch of this layout stays cookie/header-less
 * and the beacon's bytes leave the public First Load JS — `/[username]` + the sub-
 * routes stay ● SSG/ISR (D-20), asserted by `route-table-ssg.test.ts` + `check:bundle`.
 */
export default function PortfolioRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <BeaconMount />
      </body>
    </html>
  );
}
