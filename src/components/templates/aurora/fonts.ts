/**
 * Font faces for the `aurora` template (11-04 Wave-C — the marketer dogfood ship;
 * D-15 `default` font preset; D-17 two-layer isolation).
 *
 * AURORA'S OWN IDENTITY (D-17 two-layer rule — load-bearing): the marketer source
 * (`lovable-exports/marketing-girl/`) used the platform-CHROME face (Inter) for its
 * body. Inter is the CHROME font and is FORBIDDEN inside any template (two-layer
 * isolation) — so aurora picks its OWN self-hosted faces fitting the rosy, modern,
 * glamour-marketer vibe. `minimal`'s (Clash Display / General Sans) and `editorial`'s
 * (Fraunces / Space Grotesk) faces are likewise off-limits — aurora owns its identity.
 *
 * THREE families, each exposing the CSS variable the scoped `.tmpl-aurora` tree
 * consumes:
 *   - Display / Heading = Poppins (the friendly geometric headline face — the warm,
 *     rounded marketer voice; the hero name + section H2s).
 *   - Body             = Plus Jakarta Sans (a humanist neo-grotesque — calm, legible
 *     long-form copy; NOT Inter, NOT a chrome face).
 *   - Mono Label       = Space Mono (the kicker labels `01 — PROFILE`, metric/stat
 *     numerals, tier markers).
 *
 * FONT SOURCING (07-03 load-bearing handoff guardrail; D-16): all three families are
 * SIL OFL and loaded via `next/font/google`, which **build-time self-hosts** the faces
 * (no runtime Google request, no npm font package, no committed WOFF2) — the SAME
 * proven in-repo pattern the chrome + minimal + editorial use. The Lovable export's
 * runtime Google-Fonts `<link>` (`index.html`) is a must-strip external-font-origin
 * (Task 1) — replaced HERE by this self-host. ≤2 weights per family (TMPL-04 subset
 * budget), all `display: 'swap'`, `latin`-subset; the hero faces `preload`ed.
 */
import { Plus_Jakarta_Sans, Poppins, Space_Mono } from 'next/font/google';

/**
 * Poppins (Indian Type Foundry, SIL OFL) — Display + Heading face. Weights 500
 * (section headings) + 600 (the oversized hero name). Preloaded — it paints the hero
 * LCP text. `latin`-subset, two weights only (TMPL-04 budget).
 */
export const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal'],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});

/**
 * Plus Jakarta Sans (Tokotype, SIL OFL) — Body face. Weights 400 (default copy) + 600
 * (emphasis — NOT italics-as-bold). PRELOADED: the hero role line + the bulk of
 * above-the-fold body text render in this face, so preloading removes the font-swap
 * repaint from the LCP path (the same TMPL-04 reasoning minimal/editorial document).
 */
export const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-body',
  display: 'swap',
  preload: true,
});

/**
 * Space Mono (Colophon Foundry, SIL OFL) — Mono Label face (kicker numerals
 * `01 — PROFILE`, metric stat values, tier markers, dates). Weights 400 + 700. Not
 * preloaded (it is not the LCP path).
 */
export const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
});

// The shared FOUC-guard infra (`themeInitScript` + `THEME_STORAGE_KEY` +
// `TemplateThemeMode`) lives in the shared kit (`../_kit/theme-init.ts`, PIPE-01 /
// D-01/D-02) and is imported by `index.tsx` from `'../_kit'`. Only the
// template-specific `next/font` faces above remain per-template by design.
