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

// The shared FOUC-guard infra (`themeInitScript` + `THEME_STORAGE_KEY` +
// `TemplateThemeMode`) moved to the shared kit (`../_kit/theme-init.ts`, PIPE-01 /
// D-01/D-02) and is now imported by `index.tsx` from `'../_kit'`. Only the
// template-specific `next/font` faces above remain per-template by design.
