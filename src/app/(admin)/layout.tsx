/**
 * (admin) route group — passthrough layout.
 *
 * Phase 1 is non-UI (CONTEXT D-02). Minimal admin tooling is deferred; this is a
 * passthrough so the route group exists.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
