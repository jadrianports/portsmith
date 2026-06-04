/**
 * Shared template kit barrel (PIPE-01 / D-01/D-02). The ONE import surface every
 * template uses for the unstyleable plumbing:
 *
 *   import { ScrollReveal, ThemeToggle, themeInitScript, TEMPLATE_ROOT_ATTR } from '../_kit';
 *
 * BUNDLE-SPLIT GUARD (Pitfall 3 — load-bearing): this barrel re-exports ONLY kit
 * symbols. It imports NOTHING from `registry.ts` / `@/lib/validations` (both evaluate
 * `z.enum(...)` at module scope → ~63 kB zod onto the public First Load JS). The kit is
 * logic-only; `npm run check:bundle` (≤200 kB gz) is the regression catch.
 *
 * DEPENDENCY DIRECTION IS ONE-WAY (D-02): templates import FROM the kit; the kit NEVER
 * imports a template. The kit is chrome-free + slug-agnostic — no `.tmpl-<slug>`
 * literal, no chrome token, no template import.
 */
export { ScrollReveal } from './scroll-reveal';
export { ThemeToggle } from './theme-toggle';
export {
  themeInitScript,
  THEME_STORAGE_KEY,
  TEMPLATE_ROOT_ATTR,
  type TemplateThemeMode,
} from './theme-init';
