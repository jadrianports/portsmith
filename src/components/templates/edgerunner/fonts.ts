/**
 * Self-hosted font faces for the `edgerunner` template (D-06 `default` font preset;
 * D-17 two-layer isolation; the synthwave Lovable export's typography, translated).
 *
 * THREE families, each exposing a CSS variable the scoped `.tmpl-edgerunner` tree
 * consumes (Display/Heading = Orbitron, Body = Space Grotesk, Mono/CRT label = VT323).
 * ≤2 weights per family (subset budget — TMPL-04). All `display: 'swap'`, latin-subset.
 *
 * The platform-CHROME sans face is FORBIDDEN here (D-17 / SHARED-D); the template
 * never reuses a chrome font.
 *
 * SELF-HOST (T-13-04-ORIGIN): all three families are on Google Fonts, so they are
 * loaded via `next/font/google` (BUILD-TIME self-host — zero runtime font request).
 * The export's runtime Google-Fonts `@import url(...)` (`styles.css:5`) was a
 * `gate:security` external-font-origin violation and is STRIPPED — these build-time
 * faces replace it. Mirrors aurora's `next/font/google` resolution (simpler than
 * minimal's `localFont` WOFF2, since all three are on Google Fonts).
 *
 * Each is bound via `variable:` (NOT a literal `--name:` declaration in `theme.css`),
 * the contract.ts requirement; `theme.css` references `var(--font-body)` for the root
 * anchor + `var(--font-display)` / `var(--font-mono)` on the elements that use them.
 */
import { Orbitron, Space_Grotesk, VT323 } from 'next/font/google';

/**
 * Orbitron (SIL OFL) — Display + Heading face (the export's `--font-display`). The
 * geometric techno face that carries the hero neon-clip name + section H2s. Weights
 * 600 (Semibold, section headings) + 800 (ExtraBold, the hero name) — ≤2 (TMPL-04).
 * Preloaded — it paints the hero LCP text.
 */
export const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['600', '800'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

/**
 * Space Grotesk (SIL OFL) — Body face (the export's `--font-sans`). Weights 400
 * (default copy) + 600 (emphasis). PRELOADED so the body face is fetched with the
 * critical assets (no font-swap repaint resetting the LCP timing, the minimal
 * 03-verification lesson). latin-subset + `swap` + the ≤2-weights budget.
 */
export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
});

/**
 * VT323 (SIL OFL) — Mono / CRT-terminal label face (the export's `--font-mono`). The
 * pixel-terminal face for mono section labels (`01 / intro`), tech-stack names, dates,
 * tier markers. VT323 ships a SINGLE weight (400) only — within the ≤2 budget.
 */
export const vt323 = VT323({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-mono',
  display: 'swap',
});
