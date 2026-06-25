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
import { auroraSpec } from './aurora/spec';
import { edgerunnerV2Spec } from './edgerunner-v2/spec';
import { atelierSpec } from './atelier/spec';
import { blueprintSpec } from './blueprint/spec';

/**
 * The slug → template map. The lazy import yields the template's default export
 * (the Server-Component root in `minimal/index.tsx` / `editorial/index.tsx`), typed
 * to the shared `{ data: PortfolioData }` prop contract every template root accepts.
 */
export const templateRegistry: Record<string, ComponentType<{ data: PortfolioData }>> = {
  minimal: dynamic(() => import('./minimal')),
  // TMPL-01: the editorial ("Newsprint") template — the ONE registry line a new
  // template adds (its folder is `editorial/`). A PLAIN LITERAL `dynamic(() =>
  // import('./editorial'))` (07-03 shipped `editorial/index.tsx`, so the 07-01
  // variable-specifier deferral is no longer needed) — required for proper
  // per-template code-splitting (the <=200kb chunk budget 07-06 gates). NEVER
  // `{ ssr: false }` (the prohibition documented above — it triggers a build error
  // on a Server-Component entry; it is reserved for FUTURE Three.js CLIENT templates).
  editorial: dynamic(() => import('./editorial')),
  // TMPL / 11-04 Wave-C: the `aurora` ("Aurora Rose") marketer template — the third
  // public template, the real Lovable→Portsmith dogfood ship (the `marketing-girl`
  // export, translated). A PLAIN LITERAL `dynamic(() => import('./aurora'))` (its folder
  // is `aurora/`) — required for proper per-template code-splitting (the ≤200kb chunk
  // budget). NEVER `{ ssr: false }` (build-forbidden on a Server-Component entry).
  aurora: dynamic(() => import('./aurora')),
  // 13.2-08 / D-21: the v1 `edgerunner` template was TOMBSTONED — deregistered here in
  // lockstep with migration 018 (which DELETEs the orphaned …0004 row + grant). The founder
  // is on `edgerunner-v2` (…0005); v1 had no live portfolio. Its folder + every CI surface
  // (slugs anchor, thumbnail SLUGS, conformance SPEC_BY_SLUG, seed self-heal) were removed in
  // the same commit so no slug dangles. Do NOT re-add `edgerunner` (v1) here.
  // edgerunner-v2: bar-for-bar transcription of the synthwave Lovable export using
  // the export's EXACT class names (text-glow-pink, holo-panel, font-mono-retro, etc.)
  // scoped under .tmpl-edgerunner-v2 — verified hero-first before full section build.
  'edgerunner-v2': dynamic(() => import('./edgerunner-v2')),
  // 36-02 / CTPL-01: the `atelier` ("Atelier") gallery-forward creative template — a
  // faithful 1:1 clone of the dark-editorial Lovable export (v2.8 "Show the Work"). A
  // PLAIN LITERAL `dynamic(() => import('./atelier'))` (its folder is `atelier/`) —
  // required for proper per-template code-splitting. NEVER `{ ssr: false }`
  // (build-forbidden on a Server-Component entry). Image-first: it supports the 3
  // creative types (gallery/case_study/moodboard) the other templates do not.
  atelier: dynamic(() => import('./atelier')),
  // blueprint: faithful 1:1 clone of the dark "engineering bench" Lovable export — the first
  // PUBLIC page-capable template (opts into /blog via spec.pages). A PLAIN LITERAL `dynamic(() =>
  // import('./blueprint'))` (its folder is `blueprint/`) — per-template code-splitting. NEVER
  // `{ ssr: false }` (build-forbidden on a Server-Component entry).
  blueprint: dynamic(() => import('./blueprint')),
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
  // 11-04 Wave-C: the `aurora` template — the next pinned literal after editorial
  // (…0002). It MUST equal the 010 seed migration's UUID exactly or `slugForTemplateId`
  // can't resolve and the public read falls back to minimal.
  aurora: '00000000-0000-4000-8000-000000000003',
  // 13.2-08 / D-21: the v1 `edgerunner` UUID pin (…0004) was REMOVED in lockstep with
  // migration 018 (the DB tombstone). With no pin, `slugForTemplateId(…0004)` resolves no
  // entry and safely degrades to 'minimal' — but migration 018 also DELETEs the …0004 row,
  // so no portfolio carries that UUID. The UUID …0004 is now permanently retired; do NOT
  // reuse it for a future template (the next free literal is …0006).
  // edgerunner-v2: bar-for-bar faithful clone (UUID …0005)
  'edgerunner-v2': '00000000-0000-4000-8000-000000000005',
  // 36-02 / D-13: the `atelier` template — the next free pinned literal (…0004 retired,
  // …0005 = edgerunner-v2). It MUST equal the 032 seed migration's UUID exactly or
  // `slugForTemplateId` can't resolve and the public read falls back to minimal.
  atelier: '00000000-0000-4000-8000-000000000006',
  // blueprint: the next free pinned literal (…0007). It MUST equal the seed migration's UUID
  // exactly or `slugForTemplateId` can't resolve and the public read falls back to minimal.
  blueprint: '00000000-0000-4000-8000-000000000007',
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
  aurora: auroraSpec,
  // edgerunner (v1) deregistered — see the tombstone note in templateRegistry above (D-21).
  'edgerunner-v2': edgerunnerV2Spec,
  atelier: atelierSpec,
  blueprint: blueprintSpec,
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

/**
 * The visibility soft-enum gate (GATE-01 / D-P12-01 / CMS-08). Zod is the SOURCE OF
 * TRUTH for `templates.visibility` — the column is `TEXT NOT NULL DEFAULT 'restricted'`
 * with NO Postgres CHECK (the same CMS-08 posture as `sections.type`, so a future
 * visibility lane needs no migration). The 12-03 switch gate compares against
 * `'restricted'` and the 12-05 admin `setTemplateVisibility` action re-parses through
 * THIS enum. Like `templateSlugSchema`, it imports zod, so it stays SERVER-side — the
 * client picker imports display copy from `template-meta.ts`, NEVER this file (D-25,
 * the :140-153 isolation rule below). Do NOT export it from any client-imported barrel.
 */
export const templateVisibilitySchema = z.enum(['public', 'restricted']);

// CHROME presentation metadata (TemplateMeta / templateMeta / resolveTemplateMeta /
// listTemplates) is the zod-free, next/dynamic-free half of the registry — it now lives
// in `./template-meta` and is re-exported here so SERVER consumers (page.tsx) keep
// importing it from the registry unchanged. CLIENT chrome (template-picker,
// template-mismatch-warning) MUST import these from `./template-meta` directly, NEVER
// from this file: importing ANY symbol from `registry.ts` drags its module-scope
// `z.enum(...)` (zod) into the client bundle, leaking ~63 kB gz onto the public
// `/[username]` First Load JS and breaching the D-25 ≤200 kB budget (the 07-06 gate).
export {
  templateMeta,
  resolveTemplateMeta,
  listTemplates,
  type TemplateMeta,
} from './template-meta';
