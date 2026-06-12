/**
 * `/onboarding` route group — the onboarding-wizard chrome FRAME (18-04 / D-19).
 *
 * The wizard is PLATFORM CHROME (an authenticated first-run surface), not a
 * portfolio template. This layout scopes the chrome font (Inter via `--font-sans`)
 * and the chrome background/foreground tokens so every wizard surface renders in the
 * locked "Evergreen & Copper" platform-chrome system (two-layer identity — chrome
 * tokens ONLY, never a portfolio-template `.tmpl-*` token). It is a sibling of
 * `(dashboard)/layout.tsx` (the structural twin) — `/onboarding` lives directly in
 * `(chrome)`, NOT nested under `(dashboard)`, so it inherits chrome tokens but is
 * structurally independent of the gate-bearing `/dashboard` page (RESEARCH Risk 4).
 *
 * The ONLY template-token surface in the whole wizard is the inline live-preview
 * `<iframe>` in the Template step — a SEPARATE document that paints the chosen
 * template through its own scoped `theme.css`, frame-isolated from this chrome.
 *
 * Chrome tokens only (SHARED-E): zero template-token reach, zero inline hex.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background font-sans text-foreground">{children}</div>
  );
}
