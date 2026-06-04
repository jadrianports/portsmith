/**
 * The negative fixture's font module (Phase-10 Plan 02; the inverted twin of
 * `src/components/templates/minimal/fonts.ts`). It exposes a `variable:`-bound face the
 * root consumes (so the structure matches a real template), and it carries a DELIBERATELY-
 * OVERSIZED import marker for the async-island bundle-cap RED path (Plan 10-05): a template
 * that pulls a heavy, un-tree-shaken import would blow the per-template async cap (250 kB gz
 * starting). The marker below is the source-text signal that gate keys on.
 *
 * NOTE: this uses `next/font/google` (a sanctioned, build-time self-hosted path — NOT itself
 * a violation). The fixture's gate-tripping violations live in `index.tsx` (security + a11y +
 * dropped section + null-guard + unknown import) and `theme.css` (token + isolation). This
 * file's only deliberate signal is the over-budget import marker.
 *
 * D-P10-02a: this file lives ONLY under `tests/fixtures/` and is never loaded on a public page.
 */
import { JetBrains_Mono } from 'next/font/google';

/**
 * A `variable:`-bound face so the root's `fontVars` is structurally valid. The
 * `BUDGET-OVERSIZED-IMPORT` marker below is the deliberate over-budget signal for the
 * async-island cap gate (Plan 10-05) — a real heavy import (e.g. `import * from 'three'`
 * with no tree-shaking) would blow the cap; this marker stands in for it without actually
 * installing a heavy dep.
 */
export const brokenFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

// BUDGET-OVERSIZED-IMPORT (Plan 10-05 async-cap RED path): a deliberately-oversized import
// marker. A real rich-lane template that un-tree-shakes a heavy module would exceed the
// per-template async-island cap (250 kB gz). The bundle gate's negative-control keys on this
// marker / an actual oversized chunk.
export const BUDGET_OVERSIZED_IMPORT_MARKER = 'three/examples/jsm/everything' as const;
