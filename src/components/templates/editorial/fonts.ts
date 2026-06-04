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

// The shared FOUC-guard infra (`themeInitScript` + `THEME_STORAGE_KEY` +
// `TemplateThemeMode`) moved to the shared kit (`../_kit/theme-init.ts`, PIPE-01 /
// D-01/D-02) and is now imported by `index.tsx` from `'../_kit'`. The kit keeps the
// XSS-safe `light|dark` coercion; editorial preserves its LIGHT default by passing
// `'light'` through from `index.tsx` (Pitfall 2). Only the template-specific
// `next/font` faces above remain per-template by design.
