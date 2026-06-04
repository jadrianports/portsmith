/**
 * The MACHINE-CHECKABLE half of the template contract (PIPE-02 / D-06).
 *
 * This module pins — in a form Phase-10 CI gates and the Phase-11 skill can import
 * and assert against — the two things prose can't enforce on its own:
 *
 *   1. `REQUIRED_TOKENS` — the canonical CSS-custom-property surface EVERY template
 *      MUST define in its scoped `.tmpl-<slug>` `theme.css` (the INTERSECTION of the
 *      two live templates' token vocabularies, D-06). A conformance gate imports this
 *      array and asserts each name is defined in the candidate's `theme.css`
 *      (`token-conformance.test.ts` already does this for the two live templates).
 *   2. type-only re-exports of `PortfolioData` / `TemplateSpec` / `TemplateSectionSpec`
 *      — so a Phase-10 type gate (`tsc --noEmit`) asserts a candidate spec satisfies
 *      `TemplateSpec` and a template root consumes `PortfolioData`, WITHOUT this module
 *      ever pulling a runtime value onto a bundle.
 *
 * The prose companion that POINTS AT this module is `./CONTRACT.md`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BUNDLE-SPLIT GUARD (Pitfall 3 — LOAD-BEARING, T-09-07):
 * The re-exports below MUST stay `export type { ... }` (type-only). A `type` re-export
 * is erased at compile time — it carries ZERO runtime weight, so even if a CLIENT
 * component imported this module it would never pull a value. A plain `export { ... }`
 * of `TemplateSpec` would re-export from `./minimal/spec`, and re-exporting a VALUE
 * from a module that transitively reaches `registry.ts` (its module-scope `z.enum(...)`)
 * is how the ~63 kB zod leak returns onto the public `/[username]` First Load JS.
 * `REQUIRED_TOKENS` / `PRESET_NAMES` are PLAIN `as const` string arrays — NO `z.enum`,
 * NO import from `./registry` or `@/lib/validations`. `kit-isolation.test.ts` +
 * `npm run check:bundle` are the regression catch; `tsc --noEmit` proves the type
 * re-exports stay in sync with `types.ts` / `spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Type-only re-exports (erased at compile time — zero runtime weight). The single
// typed contract a template root consumes + the field-gating spec shape it declares.
export type { PortfolioData } from './types';
export type { TemplateSpec, TemplateSectionSpec } from './minimal/spec';

/**
 * The canonical REQUIRED CSS-custom-property surface every template MUST define in
 * its scoped `.tmpl-<slug>` `theme.css` (D-06). This is the INTERSECTION of the two
 * live templates' token vocabularies (`minimal/theme.css` ∩ `editorial/theme.css`) —
 * 18 names, grouped by role (RESEARCH § D-06's table enumerates exactly these rows;
 * its "19" header line is an off-by-one miscount — the verified intersection of the
 * live theme.css files, asserted by `token-conformance.test.ts`, is 18). A preset
 * overrides a SUBSET of these (primarily
 * `--accent`/`--ring` + optionally the `--font-*` triple); the binding mechanism is a
 * Phase-14 detail. Template-private extras (e.g. minimal's `--accent-cyan` synthwave
 * system) are ALLOWED and NOT part of this required surface. The conditional modal
 * sub-surface (`--tmpl-modal-*`, only if a template mounts the shared ReportDialog)
 * is documented in CONTRACT.md, NOT required here.
 *
 * The three `--font-*` faces are set via `next/font` `variable:` in each template's
 * `fonts.ts` (NOT as literal `--name:` declarations in `theme.css` text) — still
 * REQUIRED; both live templates reference `var(--font-body)` in `theme.css` and bind
 * all three in `fonts.ts`.
 */
export const REQUIRED_TOKENS = [
  // colour roles
  '--bg',
  '--surface',
  '--surface-muted',
  '--fg',
  '--muted-fg',
  '--border',
  '--border-strong',
  '--accent',
  '--ring',
  '--success',
  '--destructive',
  // type roles (set via next/font `variable:` in fonts.ts)
  '--font-display',
  '--font-body',
  '--font-mono',
  // radius scale
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-full',
] as const;

/**
 * The platform-wide preset NAME allowlist (D-05). This is the soft-enum the Phase-14
 * preset picker validates against (a Phase-14 `presetSchema = z.enum(PRESET_NAMES)`
 * would build on this; that validator is OUT OF SCOPE here — Phase 9 only fixes the
 * NAMES). Each template's `spec.color_presets` declares the SUBSET of these it
 * supports (`minimal` ships all four; `editorial` ships `['default']` only). Plain
 * string array — NO `z.enum` (that lives server-side, never on the public bundle).
 */
export const PRESET_NAMES = ['default', 'ocean', 'warm', 'monochrome'] as const;
