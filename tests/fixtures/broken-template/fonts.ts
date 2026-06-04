/**
 * The negative fixture's font module (Phase-10 Plan 02; the inverted twin of
 * `src/components/templates/minimal/fonts.ts`). It exposes a `variable:`-bound face the
 * root consumes (so the structure matches a real template).
 *
 * NOTE: this uses `next/font/google` (a sanctioned, build-time self-hosted path — NOT itself
 * a violation). The fixture's gate-tripping violations live in `index.tsx` (security + a11y +
 * dropped section + null-guard + unknown import) and `theme.css` (token + isolation).
 *
 * WR-06: the async-island bundle-cap RED path is NOT proven through this file. No gate reads
 * a source marker here — `discoverAsyncSceneChunks()` (check-bundle-budget.ts) is a no-op
 * until a real scene chunk exists. The async-cap REJECT is proven directly by the unit test
 * `tests/unit/templates/async-island-cap.test.ts`, which feeds a synthetic over-cap byte
 * length to `assertAsyncIslandWithinCap`. A previous `BUDGET_OVERSIZED_IMPORT_MARKER` export
 * here falsely implied the live bundle gate keyed on it; it was dead surface and is removed.
 *
 * D-P10-02a: this file lives ONLY under `tests/fixtures/` and is never loaded on a public page.
 */
import { JetBrains_Mono } from 'next/font/google';

/** A `variable:`-bound face so the root's `fontVars` is structurally valid. */
export const brokenFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});
