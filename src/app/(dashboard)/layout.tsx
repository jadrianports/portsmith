/**
 * (dashboard) route group — the platform-chrome shell frame (04-09).
 *
 * Phase 4 lands the real CMS dashboard. This layout is the route-group chrome
 * FRAME: it scopes the chrome font (Inter via `--font-sans`) and the chrome
 * background/foreground tokens so every dashboard surface renders in the locked
 * "Evergreen & Copper" platform-chrome system (two-layer identity — chrome tokens
 * ONLY, never a portfolio-template token). The actual header bar + the two-pane
 * rail/panel editor live in the `EditorShell` island rendered by the `/dashboard`
 * page, because the header (PublishToggle / status / View live) needs the loaded
 * owner data the RSC page resolves.
 *
 * Chrome tokens only (SHARED-E): zero template-token reach, zero inline hex.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background font-sans text-foreground">{children}</div>
  );
}
