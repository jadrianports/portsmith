/**
 * The machine-readable TEMPLATE DEPENDENCY ALLOWLIST (Phase-10 Plan 02; D-15 / D-P10-03).
 *
 * The Wave-2 security gate (`gate:security`, Plan 10-03) imports this module and checks
 * every import specifier in a candidate template folder for NAME membership against
 * {@link ALLOWED_IMPORT_SPECIFIERS}, and every `dangerouslySetInnerHTML` `__html` producer
 * against {@link SANCTIONED_HTML_PRODUCERS}. An import specifier NOT on the list is the
 * D-P10-03 "unknown dependency → hard-fail, resolved by adding an allowlist line in the
 * SAME diff" case (ingestion is operator-curated; adding a line IS the reviewable change).
 *
 * SHAPE (mirrors `src/components/templates/contract.ts` `REQUIRED_TOKENS`/`PRESET_NAMES`):
 * plain `as const` string arrays — NO `z.enum`, NO import from `registry.ts` /
 * `@/lib/validations` (both evaluate zod at module scope). This module therefore carries
 * ZERO zod weight and is importable by the gate (and any bundle) as plain data.
 *
 * MEMBERSHIP IS BY NAME, NOT INSTALLED-STATE (RESEARCH Pitfall 8): `motion` / `three` /
 * R3F / drei are the OPTIONAL rich-lane members a template MAY pull; only `lucide-react`
 * + `next/font` (+ the kit) are installed today. The allowlist is the NAME contract, not a
 * dependency manifest. Relative imports within a template folder and `../_kit` are allowed
 * structurally (see {@link isAllowedRelativeImport}), not by literal membership.
 *
 * BARE `framer-motion` IS NOT ALLOWED (A6 / RESEARCH Pitfall 8): only the modern `motion`
 * / `motion/react` line is allowlisted. A template importing bare `framer-motion` trips the
 * unknown-dependency hard-fail so the operator confirms the modern package.
 */

/**
 * The allowlisted import specifier NAMES a standard/rich-lane template MAY pull. Any
 * non-relative import specifier NOT in this set (and not matched by
 * {@link isAllowedRelativeImport}) is an unknown dependency → D-P10-03 hard-fail.
 */
export const ALLOWED_IMPORT_SPECIFIERS = [
  // Icons (the only non-next/font deps installed today — package.json).
  'lucide-react',
  // Brand logos: both live templates import named, tree-shaken icons from `simple-icons`
  // (`minimal/sections/icons.ts` + `editorial/sections/icons.ts`). Each imported value is
  // a CONSTANT SVG `path` from the package (T-03-17 / T-07-07 — no runtime/user input), so
  // the brand-logo lane is XSS-safe by construction. Allowlisted (D-P10-03) so the GREEN-
  // on-corpus security canary passes the known-good templates.
  'simple-icons',
  // The ONE blessed animation lib (standard lane). Modern Motion line ONLY — bare
  // `framer-motion` is deliberately NOT here (A6): an unknown-dep hard-fail forces the
  // operator to confirm the modern package.
  'motion',
  'motion/react',
  // The rich / viz lane (opt-in, lazy client island) — R3F v9 + drei + three.
  '@react-three/fiber',
  '@react-three/drei',
  'three',
  // Build-time self-hosted fonts (D-16) — the ONLY sanctioned font path. A runtime CDN
  // origin (`https://fonts.googleapis.com`) is a SEPARATE source-text violation the gate
  // catches; the IMPORT of these modules is legal.
  'next/font/local',
  'next/font/google',
  // Next primitives a template legitimately uses.
  'next/image',
  'next/dynamic',
  // The React runtime.
  'react',
  'react-dom',
  // The sanctioned JSON-LD helper (the producer of `personLdScriptHtml`).
  '@/lib/seo/person-jsonld',
  // The type-only contract surfaces (erased at compile — zero runtime weight).
  '@/components/templates/types',
  '@/components/templates/contract',
] as const;

/**
 * The ONLY TWO sanctioned `dangerouslySetInnerHTML` `__html` producers (+ the inner
 * serializer), codebase-confirmed XSS-safe by construction:
 *   - `themeInitScript`     — `_kit/theme-init.ts`, coerces to a 2-value `light|dark` enum.
 *   - `personLdScriptHtml`  — `@/lib/seo/person-jsonld.ts`, escapes `<`/`>`/`&`/U+2028-9.
 *   - `jsonLdToScriptHtml`  — the inner serializer `personLdScriptHtml` delegates to.
 * ANY other `__html` value is a D-13 security REJECT.
 */
export const SANCTIONED_HTML_PRODUCERS = [
  'themeInitScript',
  'personLdScriptHtml',
  'jsonLdToScriptHtml',
] as const;

/**
 * Structural allowance for RELATIVE imports inside a template folder (sibling files,
 * `sections/*`, scoped css) and the one-way `../_kit` import. The gate applies this in
 * ADDITION to the literal {@link ALLOWED_IMPORT_SPECIFIERS} membership check: a specifier
 * starting with `./` or `../` is allowed (it cannot reach an unvetted npm package — only
 * in-repo source — and `../_kit` is the sanctioned shared-kit path).
 */
export function isAllowedRelativeImport(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}
