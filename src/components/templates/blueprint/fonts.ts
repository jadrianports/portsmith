/**
 * Font faces for the `blueprint` template — the dark "engineering bench" ship
 * (lovable-ingest of `lovable-exports/blueprint/`; `default` preset; CTPL-04 two-layer
 * isolation).
 *
 * FAITHFUL CLONE + TWO-LAYER ISOLATION (load-bearing): the Lovable export ships SYSTEM font
 * stacks (Lovable left the intended faces unwired in `styles.css`), but its `plan.md` design
 * intent is **Space Grotesk** (display, "geometric sans") + **Inter** (body) + **JetBrains
 * Mono** (mono). Inter is the platform-CHROME face and is FORBIDDEN inside any template
 * (two-layer isolation, `template-isolation-any.test.ts`) — so blueprint's body face is **IBM
 * Plex Sans**, a neutral technical grotesque that carries the export's quiet, legible
 * engineering voice without being the chrome Inter. The display + mono honour the plan intent
 * 1:1.
 *
 * THREE families, each exposing the CSS variable the scoped `.tmpl-blueprint` tree consumes:
 *   - Display / Heading = Space Grotesk (`--font-display`): the geometric section headings +
 *     the oversized hero name.
 *   - Body             = IBM Plex Sans (`--font-body`, Inter-free): the bio + card copy +
 *     descriptions.
 *   - Mono             = JetBrains Mono (`--font-mono`): the WORKHORSE — channel eyebrows
 *     (`CH1`/`// SELECTED_WORK`), every pill, metric readouts, timeline dates, labels.
 *
 * FONT SOURCING (D-16 guardrail): all three are SIL OFL and loaded via `next/font/google`,
 * which **build-time self-hosts** the faces (no runtime Google request, no npm font package,
 * no committed WOFF2) — the SAME proven pattern chrome + minimal + editorial + aurora +
 * atelier use. The export's system-stack `font-family` is the must-translate; the runtime
 * Google-Fonts `@import` (gotcha 3) never existed here. ≤2 weights per family (TMPL-04 subset
 * budget), all `display: 'swap'`, `latin`-subset; the hero faces `preload`ed.
 */
import { IBM_Plex_Sans, JetBrains_Mono, Space_Grotesk } from 'next/font/google';

/**
 * Space Grotesk (Florian Karsten, SIL OFL) — Display + Heading face. Weights 500 + 700
 * (the export's `font-semibold` headings + the hero masthead). Preloaded — it paints the
 * hero LCP headline. `latin`-subset.
 */
export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

/**
 * IBM Plex Sans (IBM / Bold Monday, SIL OFL) — Body face (the export's Inter role,
 * Inter-free). Weights 300 (the export's `font-light` bio) + 400 (copy). PRELOADED: the hero
 * subheading + body copy render in this face on first paint.
 */
export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
});

/**
 * JetBrains Mono (JetBrains, SIL OFL) — the `--font-mono` token and the template's defining
 * voice (eyebrows / channel markers / pills / metrics / dates). Weights 400 + 500. Preloaded:
 * the hero eyebrow + the oversized contact mailto are mono, so the face is on the LCP path.
 */
export const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
});

// The shared FOUC-guard infra (`themeInitScript` + `THEME_STORAGE_KEY` + `TemplateThemeMode`)
// lives in the shared kit (`../_kit/theme-init.ts`) and is imported by `index.tsx` from
// `'../_kit'`. Only the template-specific `next/font` faces above remain per-template.
