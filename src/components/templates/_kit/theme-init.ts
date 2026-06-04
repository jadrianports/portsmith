/**
 * Pre-paint FOUC guard + the theme storage key + the generic root contract — the
 * SHARED-KIT theme plumbing (D-01/D-02 — PIPE-01). Extracted VERBATIM from the
 * `minimal`/`editorial` `fonts.ts` copies (their font faces STAY per-template); the
 * ONE generalization is the root SELECTOR — the slug literals (`.tmpl-minimal` /
 * `.tmpl-editorial`) become the generic `[data-template-root]` attribute (D-02/D-03),
 * so the kit is slug-agnostic and a new template inherits the no-flash contract by
 * setting `data-template-root` on its root + passing its own default through.
 *
 * BUNDLE-SPLIT GUARD (Pitfall 3 — load-bearing): this module imports NOTHING from
 * `registry.ts` / `@/lib/validations` (both evaluate `z.enum(...)` at module scope →
 * ~63 kB zod onto the public First Load JS). It is logic-only — a string-builder + two
 * consts + one type.
 */

/**
 * The localStorage key the toggle writes and the FOUC guard reads. Kept in one
 * place so the toggle island (theme-toggle.tsx) and this pre-paint script agree.
 * SHARED key across every template by design — a visitor's light/dark choice is a
 * single site-wide preference (the attribute is set on whichever template root is
 * mounted). VALUE UNCHANGED from the per-template copies (visitors' persisted theme
 * survives the kit move).
 */
export const THEME_STORAGE_KEY = 'portsmith-theme';

/**
 * The generic root contract (D-02/D-03). Every template sets this attribute on its
 * root element; the FOUC guard + the toggle target `[data-template-root]` instead of
 * the slug class, so the kit never references a `.tmpl-<slug>` literal.
 */
export const TEMPLATE_ROOT_ATTR = 'data-template-root';

/** The two-value theme enum (mirrors `portfolio_settings.theme_mode`). */
export type TemplateThemeMode = 'light' | 'dark';

/**
 * Build the pre-paint FOUC-guard inline-script STRING. Each template's `index.tsx`
 * drops the returned string into a `<script dangerouslySetInnerHTML>` that runs
 * BEFORE first paint, so the correct theme is set synchronously and there is no
 * dark<->light flash.
 *
 * Resolution order (the standard no-flash pattern):
 *   1. a persisted visitor choice in `localStorage['portsmith-theme']`
 *   2. the server-injected default (`settings.theme_mode`) — passed in by the caller
 *   3. the OS `prefers-color-scheme`
 * The resolved value is written to `data-template-theme` on the `[data-template-root]`
 * element.
 *
 * DEFAULT-MODE IS A PARAMETER (Pitfall 2 — the kit must NOT hardcode a default):
 * `minimal` passes `'dark'`, `editorial` passes `'light'`. Each `index.tsx` computes
 * its own default and passes it through, so the `'dark'` fallback for the UNKNOWN case
 * (below) is never reached for editorial. The default-to-`dark` for the unknown case
 * matches minimal's baseline + the DB column default (`theme_mode DEFAULT 'dark'`).
 *
 * SECURITY (T-09-01 / XSS): the ONLY interpolated value is `defaultMode`, which the
 * caller MUST pass as the server-controlled `theme_mode` enum ('light' | 'dark').
 * This function COERCES it to exactly 'light' or 'dark' before embedding, so no
 * free-form / user-controlled string can ever reach the inline script. The key is the
 * static `THEME_STORAGE_KEY` constant. Never widen this to accept user content.
 */
export function themeInitScript(defaultMode: TemplateThemeMode | string | null | undefined): string {
  // Coerce to the strict enum — anything that is not exactly 'light' falls back
  // to 'dark' (the product default). This guarantees the embedded literal is one
  // of two known-safe tokens regardless of what the caller passes.
  const safeDefault: TemplateThemeMode = defaultMode === 'light' ? 'light' : 'dark';
  return [
    '(function(){try{',
    `var d='${safeDefault}';`,
    `var s=localStorage.getItem('${THEME_STORAGE_KEY}');`,
    "var m=(s==='light'||s==='dark')?s:(d||(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'));",
    `var el=document.querySelector('[${TEMPLATE_ROOT_ATTR}]');`,
    'if(el){el.setAttribute("data-template-theme",m);}',
    '}catch(e){}})();',
  ].join('');
}
