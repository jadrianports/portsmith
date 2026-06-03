import './portfolio.css';

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
 */
export default function PortfolioRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
