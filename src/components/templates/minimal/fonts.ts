/**
 * Self-hosted font faces for the `minimal` / founder template (D-15 `default` font
 * preset; D-17 two-layer isolation; UI-SPEC §Typography; RESEARCH Pattern 4).
 *
 * THREE families, each exposing a CSS variable the scoped `.tmpl-minimal` tree
 * consumes (Display/Heading = Clash Display, Body = General Sans, Mono Label =
 * JetBrains Mono). ≤2 weights per family (subset budget — TMPL-04). All
 * `display: 'swap'`, latin-subset.
 *
 * The platform-CHROME sans face is FORBIDDEN here (D-17 / SHARED-D); the template
 * never reuses a chrome font. Adapts the chrome's `next/font/google` `{ subsets,
 * display, variable }` pattern from `src/app/layout.tsx` to `next/font/local`
 * (callable outside the root layout in Next 16).
 *
 * Clash Display + General Sans are self-hosted latin-subset WOFF2 from Fontshare
 * (ITF Free Font License — free for commercial use), committed under `./fonts/`.
 */
import { JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';

/**
 * Clash Display (Fontshare / ITF-FFL) — Display + Heading face.
 * Weights 500 (Medium, for large numeric/section-number flourishes) + 600
 * (Semibold, hero name + section H2). Preloaded — it paints the hero LCP text.
 */
export const clashDisplay = localFont({
  src: [
    { path: './fonts/ClashDisplay-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ClashDisplay-Semibold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

/**
 * General Sans (Fontshare / ITF-FFL) — Body face. Weights 400 (default copy) +
 * 600 (emphasis — NOT italics-as-bold).
 *
 * PRELOADED (03 verification perf fix 2026-06-01 — TMPL-04 LCP ≤ 2.5s): the hero
 * TAGLINE `<p>` (the measured LCP element) is rendered in this Body face. With
 * `display: 'swap'` and NO preload, the tagline first paints in the fallback face
 * (FCP) and then RE-RENDERS the instant General Sans arrives — and that font-swap
 * repaint RESETS the LCP timing to when the web font loads, which (un-preloaded)
 * is late = the ~2.8s LCP render-delay. Preloading the Body face so it is fetched
 * with the critical assets removes that swap-repaint from the LCP path. Still
 * `latin`-subset + `swap` + the TMPL-04 ≤2-weights budget (no extra weight added).
 */
export const generalSans = localFont({
  src: [
    { path: './fonts/GeneralSans-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/GeneralSans-Semibold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-body',
  display: 'swap',
  preload: true,
});

/**
 * JetBrains Mono (SIL OFL) — Mono Label face (section labels `01 / intro`,
 * tech-stack names, `tnum` dates, tier markers). Weights 400 + 500.
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
 */
export const THEME_STORAGE_KEY = 'portsmith-theme';

/** The two-value theme enum (mirrors `portfolio_settings.theme_mode`). */
export type TemplateThemeMode = 'light' | 'dark';

/**
 * Build the pre-paint FOUC-guard inline-script STRING (RESEARCH Pattern 4 /
 * Pitfall 5). 03-04's `index.tsx` drops the returned string into a
 * `<script dangerouslySetInnerHTML>` that runs BEFORE first paint, so the correct
 * theme is set synchronously and there is no dark<->light flash.
 *
 * Resolution order (the standard no-flash pattern):
 *   1. a persisted visitor choice in `localStorage['portsmith-theme']`
 *   2. the server-injected default (`settings.theme_mode`, defaults `dark`)
 *   3. the OS `prefers-color-scheme`
 * The resolved value is written to `data-template-theme` on the `.tmpl-minimal`
 * root element.
 *
 * SECURITY (T-03-11b / XSS): the ONLY interpolated value is `defaultMode`, which
 * the caller MUST pass as the server-controlled `theme_mode` enum ('light' |
 * 'dark'). This function COERCES it to exactly 'light' or 'dark' before embedding,
 * so no free-form / user-controlled string can ever reach the inline script. The
 * key is the static `THEME_STORAGE_KEY` constant. Never widen this to accept user
 * content.
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
    "var el=document.querySelector('.tmpl-minimal');",
    'if(el){el.setAttribute("data-template-theme",m);}',
    '}catch(e){}})();',
  ].join('');
}
