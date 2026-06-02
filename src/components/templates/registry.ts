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
import { z } from 'zod';

import type { PortfolioData } from './types';
import { minimalSpec, type TemplateSpec } from './minimal/spec';
import { editorialSpec } from './editorial/spec';

/**
 * The slug → template map. The lazy import yields the template's default export
 * (the Server-Component root in `minimal/index.tsx`), typed to the shared
 * `{ data: PortfolioData }` prop contract every template root accepts.
 */
/**
 * Deferred (runtime-resolved) specifier for the editorial template root.
 *
 * WHY THE VARIABLE SPECIFIER (the [05-01] idiom): `editorial/index.tsx` lands in
 * 07-03; only its `spec.ts` exists from 07-01. `tsc --noEmit` under
 * `moduleResolution: bundler` DOES compile-time-resolve a LITERAL
 * `import('./editorial')` and would TS2307 until the folder has an index. Importing
 * through this variable specifier with `/* @vite-ignore *​/` defers resolution to
 * runtime (Turbopack/Next), so the registry registers `editorial` now (TMPL-01)
 * while tsc stays 0. Swap to the plain literal `dynamic(() => import('./editorial'))`
 * once 07-03 ships the index.
 */
const EDITORIAL_TEMPLATE_MODULE = './editorial';

export const templateRegistry: Record<string, ComponentType<{ data: PortfolioData }>> = {
  minimal: dynamic(() => import('./minimal')),
  // TMPL-01: the editorial ("Newsprint") template — the ONE registry line a new
  // template adds (its folder is `editorial/`). Plain `dynamic()`, NEVER
  // `{ ssr: false }` (the prohibition documented above — it triggers a build error
  // on a Server-Component entry; it is reserved for FUTURE Three.js CLIENT templates).
  // The specifier is deferred to runtime until 07-03 ships the index (see above).
  editorial: dynamic(() => import(/* @vite-ignore */ EDITORIAL_TEMPLATE_MODULE)),
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

/**
 * Option B (D-P7-13 / Q1 / RESEARCH Pitfall 3): the static slug↔UUID map — the
 * SINGLE source of truth pinning the literal `templates.id` UUIDs the 07-03 (008)
 * migration seeds. `templates.id` defaults to `gen_random_uuid()` (`001:36`), so the
 * seeded UUIDs would otherwise be RANDOM per environment and the public read could
 * not resolve a slug WITHOUT a request-time `templates` lookup (which breaks the
 * ISR'd page — SHARED-7 / Pitfall 6). Pinning literal UUIDs lets the public read map
 * `portfolios.template_id` → slug from THIS static map, never a DB join.
 *
 * The 008 migration MUST seed these exact UUIDs (editorial INSERT + a `minimal`
 * id-pin) or the read path falls back to `'minimal'` for an unknown UUID.
 */
const TEMPLATE_UUIDS = {
  minimal: '00000000-0000-4000-8000-000000000001',
  editorial: '00000000-0000-4000-8000-000000000002',
} as const;

/** The inverse map (UUID → slug), derived from {@link TEMPLATE_UUIDS}. */
const UUID_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(TEMPLATE_UUIDS).map(([slug, id]) => [id, slug]),
);

/**
 * Resolve a `portfolios.template_id` UUID to its template slug, falling back to
 * `'minimal'` for a null/unknown UUID (the safe degrade — mirrors
 * `resolveTemplate`'s `?? null`; a bad UUID never yields `undefined` → the page
 * still renders a valid template). T-07-02.
 */
export function slugForTemplateId(uuid: string | null | undefined): string {
  return (uuid && UUID_TO_SLUG[uuid]) || 'minimal';
}

/**
 * Resolve a template slug to its pinned UUID, falling back to the `minimal` UUID
 * for an unknown slug (the safe degrade for the switch write). T-07-02.
 */
export function uuidForSlug(slug: string): string {
  return TEMPLATE_UUIDS[slug as keyof typeof TEMPLATE_UUIDS] ?? TEMPLATE_UUIDS.minimal;
}

/**
 * The slug-keyed spec registry — the sibling of {@link templateRegistry}. With two
 * templates the read/render path must field-gate from the CHOSEN template's spec
 * (today the public read hardcodes `minimalSpec`); `resolveSpec(slug)` selects it.
 * Both `minimalSpec` and `editorialSpec` satisfy the `TemplateSpec` shape (defined
 * once in `minimal/spec.ts`); the `Record<string, TemplateSpec>` annotation is what
 * types `editorialSpec` to that contract (it never re-declares the type).
 */
export const specRegistry: Record<string, TemplateSpec> = {
  minimal: minimalSpec,
  editorial: editorialSpec,
};

/**
 * Resolve a slug to its template spec, falling back to `minimalSpec` for an unknown
 * slug (the safe degrade — T-07-02). Used by the public/owner reads to drive
 * field-gating and by the mismatch predicate (`resolveSpec(candidateSlug)`).
 */
export function resolveSpec(slug: string): TemplateSpec {
  return specRegistry[slug] ?? minimalSpec;
}

/**
 * The Zod gate the switch action + preview-enable route consume (T-07-01 / V5).
 * Derived from `Object.keys(templateRegistry)` so a 3rd template (the deferred
 * fast-follow, D-P7-01) auto-updates the gate with no edit here — an unknown /
 * crafted slug is rejected at every entry point. Mirrors the in-repo `z.enum`
 * precedent (`settings.ts:36` — `z.enum(['light', 'dark'])`); co-located with the
 * registry to keep a single source of truth.
 */
export const templateSlugSchema = z.enum(
  Object.keys(templateRegistry) as [string, ...string[]],
);
