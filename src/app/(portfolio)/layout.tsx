/**
 * (portfolio) route group — passthrough layout.
 *
 * Phase 1 is non-UI (CONTEXT D-02). The public single-scroll portfolio page
 * (`/[username]`, ISR + on-demand revalidation) lands in Phase 3. Passthrough
 * for now.
 */
export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
