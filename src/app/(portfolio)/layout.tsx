/**
 * (portfolio) route-group layout — paints the template canvas, no chrome gutter.
 *
 * CHROME-GUTTER FIX (RESEARCH Pitfall 4 / Threat T-03-13b, verified live):
 * `src/app/globals.css` paints the document `body` with platform-CHROME colors
 * (light `#FBFAF8` / dark `#0B0C0E`). The portfolio template (`.tmpl-minimal`)
 * paints its OWN scoped canvas (`#0C0B1E` dark / `#F6F3FB` light). Without
 * intervention the chrome body color shows as an off-color band around the single
 * scroll (and during overscroll). This layout neutralizes the chrome body/html
 * background to `transparent` so ONLY the template canvas is visible.
 *
 * Why this is safe and scoped (D-17 two-layer isolation):
 *   - A route-group layout mounts ONLY for routes inside `(portfolio)`. The
 *     <style> below therefore ships exclusively on the public portfolio route —
 *     it cannot affect `(auth)`, `(dashboard)`, `(admin)`, or any other group.
 *   - It imports NO chrome design token. It only RESETS the chrome body/html
 *     background to `transparent` (removing the band); it does not read or reuse
 *     any `color-` prefixed chrome custom property. The template owns the color.
 *   - The template root additionally sets `background: var(--bg)` +
 *     `min-height: 100vh` (theme.css), so the canvas is full-bleed.
 *
 * The public page (03-05 `[username]/page.tsx`) renders inside this layout, so the
 * gutter fix lands before any visible portfolio render.
 */
export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/*
       * Scoped to this route group only (route-group layouts do not mount for
       * sibling groups). Neutralizes the chrome body/html background band; the
       * .tmpl-minimal canvas supplies the actual color. No chrome token referenced.
       */}
      <style>{`html, body { background: transparent; }`}</style>
      {children}
    </>
  );
}
