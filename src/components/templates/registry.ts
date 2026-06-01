/**
 * Template registry — slug → lazy template chunk (TMPL-03 / D-20 / D-27; RESEARCH
 * Pattern 1). This is the GENERIC, REUSABLE engine: Phase 7's templates 2-3 add one
 * registry line + one folder and inherit the rest unchanged. Get it right.
 *
 * Each entry is a `next/dynamic` import, so each template gets its OWN chunk for any
 * CLIENT islands it ships. A purely-server template (like `minimal`) ships ZERO
 * template JS to the client regardless — only its client islands (the 2 from 03-10:
 * ThemeToggle + ScrollReveal) cross into the client bundle.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ Next 16 RSC + next/dynamic (verified, RESEARCH Pattern 1 note):              │
 * │ `{ ssr: false }` is FORBIDDEN on the `minimal` entry — it is not allowed in a │
 * │ Server Component (it triggers a build error). It is reserved for FUTURE       │
 * │ Three.js CLIENT templates, which must live inside a Client Component. Do NOT  │
 * │ add `{ ssr: false }` here.                                                    │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

import type { PortfolioData } from './types';

/**
 * The slug → template map. The lazy import yields the template's default export
 * (the Server-Component root in `minimal/index.tsx`), typed to the shared
 * `{ data: PortfolioData }` prop contract every template root accepts.
 */
export const templateRegistry: Record<string, ComponentType<{ data: PortfolioData }>> = {
  minimal: dynamic(() => import('./minimal')),
  // Phase 7 adds siblings here, e.g.:
  //   'founder-v2': dynamic(() => import('./founder-v2')),
  // Three.js / CLIENT-only templates (later) live inside a Client Component and may
  // use `{ ssr: false }` THERE — never on a Server-Component template entry above.
};

/**
 * Resolve a slug to its template component, or `null` for an unknown slug (the
 * caller — `TemplateRenderer` — renders the error/fallback for `null`).
 */
export function resolveTemplate(slug: string): ComponentType<{ data: PortfolioData }> | null {
  return templateRegistry[slug] ?? null;
}
