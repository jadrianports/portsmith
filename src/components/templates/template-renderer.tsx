/**
 * Template renderer — the single render entry point for every template (TMPL-03 /
 * D-20 / D-27; RESEARCH Pattern 1).
 *
 * A SERVER COMPONENT (no `'use client'`): it resolves the slug to its lazy template
 * via the registry and wraps it in the (client) `TemplateErrorBoundary`. Because the
 * renderer stays a Server Component and the `minimal` template is itself a Server
 * Component, no template JS ships to the client — only the template's own client
 * islands do. The public page (03-05) calls
 * `<TemplateRenderer slug="minimal" data={data} />`.
 *
 * - Unknown slug → resolveTemplate returns `null` → render the generic
 *   `TemplateErrorBoundary.Fallback` (NOT a 500 — T-03-12).
 * - Known slug → render the lazy template INSIDE the error boundary so a
 *   broken/throwing template degrades gracefully rather than crashing the route.
 *
 * PAGE-VIEW MARKER (ANLY-01 / 15-RESEARCH Pattern 1A): when `data.portfolioId` is
 * non-null, this emits a STATIC, non-visual `data-portfolio-id` attribute that the
 * client beacon (`beacon.tsx`, mounted in the `(portfolio)` layout) reads to know
 * which portfolio to log. It is a plain server-rendered `data-` attribute — NO
 * client JS, NO request-time read — so SSG/ISR is unaffected (D-20/D-22). When
 * `portfolioId` is null (e.g. the `__fixture` route), NO marker is emitted and the
 * beacon no-ops (Pitfall 5). The renderer stays a Server Component (no `'use client'`).
 */
import { resolveTemplate } from './registry';
import { TemplateErrorBoundary } from './error-boundary';
import type { PortfolioData } from './types';

export function TemplateRenderer({ slug, data }: { slug: string; data: PortfolioData }) {
  const Template = resolveTemplate(slug);
  if (!Template) return <TemplateErrorBoundary.Fallback />;
  return (
    <TemplateErrorBoundary>
      {/* Static page-view marker (Pattern 1A) — emitted only when the id is known. */}
      {data.portfolioId !== null && <div hidden data-portfolio-id={data.portfolioId} />}
      <Template data={data} />
    </TemplateErrorBoundary>
  );
}
