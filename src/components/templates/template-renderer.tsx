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
 */
import { resolveTemplate } from './registry';
import { TemplateErrorBoundary } from './error-boundary';
import type { PortfolioData } from './types';

export function TemplateRenderer({ slug, data }: { slug: string; data: PortfolioData }) {
  const Template = resolveTemplate(slug);
  if (!Template) return <TemplateErrorBoundary.Fallback />;
  return (
    <TemplateErrorBoundary>
      <Template data={data} />
    </TemplateErrorBoundary>
  );
}
