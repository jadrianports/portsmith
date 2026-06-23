/**
 * Font faces for the `atelier` template (36-02 — the dark-editorial gallery-wall ship;
 * `default` font preset; CTPL-04 two-layer isolation).
 *
 * FAITHFUL CLONE + TWO-LAYER ISOLATION (load-bearing): the Lovable export
 * (`lovable-exports/atelier/`) pairs **Bebas Neue** (display) with **Inter** (body sans).
 * Bebas Neue is reproduced 1:1. Inter, however, is the platform-CHROME face and is
 * FORBIDDEN inside any template (two-layer isolation, `template-isolation-any.test.ts`) —
 * so atelier's body face is **Archivo**, a neutral humanist grotesque that carries the
 * export's quiet, legible, slightly-condensed sans voice without being the chrome Inter.
 * The export's `font-feature-settings: "ss01","cv11"` is a cosmetic refinement; Archivo's
 * default metrics preserve the editorial neutrality the export intends.
 *
 * THREE families, each exposing the CSS variable the scoped `.tmpl-atelier` tree consumes:
 *   - Display / Heading = Bebas Neue (the export's `--font-display`): the oversized,
 *     UPPERCASE, ultra-condensed masthead voice — the hero name + every section H2.
 *   - Body             = Archivo (the export's `--font-sans` role, Inter-free): the
 *     kicker micro-labels + all long-form copy + meta lines.
 *   - Mono Label       = Space Mono: the required `--font-mono` token. The export ships
 *     no mono face; Space Mono fills the contract token (used sparingly, if at all).
 *
 * FONT SOURCING (D-16 guardrail): all three are SIL OFL and loaded via
 * `next/font/google`, which **build-time self-hosts** the faces (no runtime Google
 * request, no npm font package, no committed WOFF2) — the SAME proven pattern chrome +
 * minimal + editorial + aurora use. The export's runtime Google-Fonts `<link>` is a
 * must-strip external-font-origin — replaced HERE by this self-host. ≤2 weights per
 * family (TMPL-04 subset budget), all `display: 'swap'`, `latin`-subset; the hero faces
 * `preload`ed.
 */
import { Archivo, Bebas_Neue, Space_Mono } from 'next/font/google';

/**
 * Bebas Neue (Dharma Type, SIL OFL) — Display + Heading face. Single weight (400 — Bebas
 * ships one weight). Preloaded — it paints the hero LCP masthead. `latin`-subset.
 */
export const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

/**
 * Archivo (Omnibus-Type, SIL OFL) — Body face (the export's Inter role, Inter-free).
 * Weights 400 (default copy + kicker labels) + 500 (the kicker micro-label weight the
 * export uses). PRELOADED: the hero kicker + role line render in this face, so preloading
 * removes the font-swap repaint from the LCP path.
 */
export const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
});

/**
 * Space Mono (Colophon Foundry, SIL OFL) — the required `--font-mono` token. The export
 * carries no mono face; this satisfies the 18-token contract surface. Weights 400 + 700.
 * Not preloaded (not on the LCP path).
 */
export const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
});

// The shared FOUC-guard infra (`themeInitScript` + `THEME_STORAGE_KEY` +
// `TemplateThemeMode`) lives in the shared kit (`../_kit/theme-init.ts`) and is imported
// by `index.tsx` from `'../_kit'`. Only the template-specific `next/font` faces above
// remain per-template by design.
