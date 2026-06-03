/**
 * Font faces for the `editorial` / "Newsprint" template (D-15 `default` font preset;
 * D-17 two-layer isolation; 07-UI-SPEC A.3 §Typography).
 *
 * THREE families, each exposing a CSS variable the scoped `.tmpl-editorial` tree
 * consumes (Display = Fraunces, Heading + Body = Space Grotesk, Mono Label =
 * JetBrains Mono). EXACTLY 4 type sizes, <=2 weights per family (the A.8 / TMPL-04
 * subset budget). All `display: 'swap'`, `latin`-subset; the hero faces `preload`ed.
 *
 * FONT SOURCING (07-03 load-bearing handoff guardrail). All three families are
 * SIL OFL. They are loaded via `next/font/google`, which **build-time self-hosts**
 * the faces (no runtime Google request, no npm dependency, no committed WOFF2) — the
 * SAME proven in-repo pattern as the chrome (`Inter`, src/app/layout.tsx) and the
 * `minimal` template's Mono (`JetBrains_Mono`, minimal/fonts.ts). The guardrail
 * explicitly designates `next/font/google` as an acceptable path; NO npm font
 * package was added (that would require a checkpoint:human-verify + slopcheck — the
 * Phase-2 lucide precedent). Isolation (D-17) is about CSS custom properties, not
 * about which OFL family a template happens to load — JetBrains Mono is shared with
 * `minimal` as a font (not as a token), exactly as A.3 permits.
 *
 * The platform-CHROME sans face (Inter) is FORBIDDEN here (D-17); `minimal`'s faces
 * (Clash Display + General Sans) are likewise forbidden — Newsprint owns its OWN
 * identity.
 *
 * FRAUNCES VARIABLE-AXIS NOTE (A.3 / A.8 budget): we request exactly TWO static
 * weight cuts (400 + 600), `latin`-subset — NOT the full variable file with every
 * axis (the documented A.8 budget risk). `next/font/google` subsets to the requested
 * weights, so only those cuts ship. Confirm the per-template chunk in 07-06's
 * `check:bundle` gate.
 */
import { Fraunces, JetBrains_Mono, Space_Grotesk } from 'next/font/google';

/**
 * Fraunces (Undercase Type, SIL OFL) — Display face (the oversized broadsheet hero
 * name + the Fraunces-400 testimonial pull-quotes). A high-contrast serif; the
 * editorial-serif moment. Weights 400 (the restrained second serif use — pull-quotes)
 * + 600 (the hero name + any large serif heading). Preloaded — it paints the hero LCP
 * text. `latin`-subset, two weights only (A.3 / A.8).
 */
export const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

/**
 * Space Grotesk (Florian Karsten, SIL OFL) — the neo-grotesque doing structural work
 * (section H2s, body voice, captions, UI). Weights 400 (default copy) + 600 (emphasis
 * + section headings — NOT italics-as-bold). PRELOADED: the hero role line and the
 * bulk of above-the-fold body text render in this face, so preloading it removes the
 * font-swap repaint from the LCP path (the same A.8 / TMPL-04 reasoning minimal's Body
 * face documents).
 */
export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
});

/**
 * JetBrains Mono (SIL OFL) — Mono Label face (section numerals `01 — PROFILE`,
 * tech-stack names, `tnum` dates, tier markers, kicker labels). Weights 400 + 500.
 * A font shared with `minimal` (A.3 permits — isolation is about CSS custom
 * properties, not the OFL family). Not preloaded (it is not the LCP path).
 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

/**
 * The localStorage key the toggle writes and the FOUC guard reads. Kept in one
 * place so the toggle island (theme-toggle.tsx) and this pre-paint script agree.
 * SHARED key with `minimal` by design — a visitor's light/dark choice is a single
 * site-wide preference (the attribute is set on whichever template root is mounted).
 */
export const THEME_STORAGE_KEY = 'portsmith-theme';

/** The two-value theme enum (mirrors `portfolio_settings.theme_mode`). */
export type TemplateThemeMode = 'light' | 'dark';

/**
 * Build the pre-paint FOUC-guard inline-script STRING. `index.tsx` drops the returned
 * string into a `<script dangerouslySetInnerHTML>` that runs BEFORE first paint, so
 * the correct theme is set synchronously and there is no light<->dark flash.
 *
 * Resolution order (the standard no-flash pattern):
 *   1. a persisted visitor choice in `localStorage['portsmith-theme']`
 *   2. the server-injected default (`settings.theme_mode`, **defaults `light` for
 *      editorial** — D-P7-06, inverting minimal's default-dark)
 *   3. the OS `prefers-color-scheme`
 * The resolved value is written to `data-template-theme` on the `.tmpl-editorial`
 * root element.
 *
 * SECURITY (T-07-05 / XSS): the ONLY interpolated value is `defaultMode`, which the
 * caller MUST pass as the server-controlled `theme_mode` enum ('light' | 'dark').
 * This function COERCES it to exactly 'light' or 'dark' before embedding, so no
 * free-form / user-controlled string can ever reach the inline script. The key is the
 * static `THEME_STORAGE_KEY` constant. Never widen this to accept user content.
 */
export function themeInitScript(defaultMode: TemplateThemeMode | string | null | undefined): string {
  // Coerce to the strict enum — anything that is not exactly 'dark' falls back to
  // 'light' (the EDITORIAL default, D-P7-06; inverts minimal's `'light' ? 'light' :
  // 'dark'`). This guarantees the embedded literal is one of two known-safe tokens
  // regardless of what the caller passes.
  const safeDefault: TemplateThemeMode = defaultMode === 'dark' ? 'dark' : 'light';
  return [
    '(function(){try{',
    `var d='${safeDefault}';`,
    `var s=localStorage.getItem('${THEME_STORAGE_KEY}');`,
    "var m=(s==='light'||s==='dark')?s:(d||(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'));",
    "var el=document.querySelector('.tmpl-editorial');",
    'if(el){el.setAttribute("data-template-theme",m);}',
    '}catch(e){}})();',
  ].join('');
}
