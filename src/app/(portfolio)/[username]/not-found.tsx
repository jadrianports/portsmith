/**
 * The public portfolio 404 — rendered when `/[username]/page.tsx` calls
 * `notFound()` for a missing or unpublished username (D-24 / threat T-03-14).
 *
 * DETAIL-FREE (access control / information disclosure): this page MUST NOT reveal
 * whether the username exists-but-unpublished vs. never-existed, and MUST NOT leak
 * any portfolio detail. It shows a single generic message. (The full locked/deleted
 * 404 nuance — PUB-02 — is Phase 4; this is the basic in-scope case.)
 *
 * SELF-CONTAINED CANVAS: the `(portfolio)` layout neutralizes the chrome `body`
 * background to `transparent`, so this page paints its OWN dark canvas inline (it is
 * NOT the `.tmpl-minimal` template tree — no template tokens are in scope here).
 * The inline colors are the template canvas/foreground values (kept literal here
 * because no scoped token context exists on the 404; this is not the templated
 * portfolio surface).
 *
 * NO PLATFORM BRANDING (TMPL-07): no platform name, no platform link — consistent
 * with the public surface carrying only the URL.
 */
export default function PortfolioNotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '64px 24px',
        textAlign: 'center',
        background: '#0c0b1e',
        color: '#f0ecfb',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 'clamp(2.5rem, 6vw, 3.5rem)', fontWeight: 600 }}>404</h1>
      <p style={{ margin: 0, fontSize: '16px', color: '#a39dc4', maxWidth: '40ch' }}>
        This page could not be found.
      </p>
    </main>
  );
}
