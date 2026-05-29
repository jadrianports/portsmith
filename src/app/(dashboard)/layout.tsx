/**
 * (dashboard) route group — passthrough layout.
 *
 * Phase 1 is non-UI (CONTEXT D-02). The CMS dashboard (content editors,
 * reorder, publish) lands in Phase 4. Minimal passthrough for now.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
