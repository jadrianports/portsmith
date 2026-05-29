/**
 * (auth) route group — passthrough layout.
 *
 * Phase 1 is non-UI (CONTEXT D-02). The real auth UI (sign in / sign up /
 * password reset) lands in Phase 2. This layout is a minimal passthrough so the
 * route group exists and renders.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
