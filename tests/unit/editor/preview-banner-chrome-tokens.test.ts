/**
 * D-17 / 07-05 — the PreviewBanner is the ONE chrome client component that renders on
 * the (portfolio) root (the owner-only `draftMode()` branch of `[username]/page.tsx`).
 * It styles itself with chrome utility classes (`bg-surface-muted`, `text-foreground`,
 * `bg-brand`, …). The (portfolio) root is chrome-token-free BY DESIGN — so unless
 * `portfolio.css` provides the chrome `--color-*` tokens those classes consume, the
 * banner renders TRANSPARENT and dissolves into the template behind it (catastrophic
 * over a dark template like `edgerunner-v2`: the banner + its "Use this template"
 * button become invisible/unclickable). The local build never catches it (the chrome
 * tokens exist on the (chrome) root).
 *
 * This guard scans the banner's (and its MismatchWarning child's) ACTUAL chrome color
 * utility classes and asserts every one has a matching `--color-*` token in
 * `portfolio.css`. Self-maintaining: add a new chrome color class to the banner without
 * the token and this fails.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const portfolioCss = read('src/app/(portfolio)/portfolio.css');
const banner = read('src/components/editor/preview-banner.tsx');
const mismatch = read('src/components/editor/template-mismatch-warning.tsx');

/** The chrome color-token names (the `--color-*` roles in (chrome)/globals.css @theme). */
const CHROME_COLOR_TOKENS = [
  'background',
  'surface',
  'surface-muted',
  'foreground',
  'muted-foreground',
  'border',
  'border-strong',
  'brand',
  'brand-foreground',
  'brand-hover',
  'accent',
  'accent-foreground',
  'success',
  'success-bg',
  'destructive',
  'destructive-bg',
  'warning',
  'ring',
];

/** Pull the chrome color tokens referenced via `<utility>-<token>` classes in a source file. */
function chromeColorTokensUsed(src: string): Set<string> {
  const used = new Set<string>();
  const re = /(?:bg|text|border|outline|ring|fill|stroke|from|to|divide)-([a-z-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (CHROME_COLOR_TOKENS.includes(m[1])) used.add(m[1]);
  }
  return used;
}

describe('D-17 — PreviewBanner chrome tokens are provided on the (portfolio) root', () => {
  it('portfolio.css declares a chrome `@theme` block (the banner exception)', () => {
    expect(portfolioCss).toMatch(/@theme\b/);
  });

  it('every chrome color class the banner + MismatchWarning use has a --color-* token on the portfolio root', () => {
    const used = new Set<string>([
      ...chromeColorTokensUsed(banner),
      ...chromeColorTokensUsed(mismatch),
    ]);
    // Sanity: the scan actually finds chrome color classes (guards a broken scan).
    expect(used.size).toBeGreaterThan(0);

    const missing = [...used].filter((token) => !portfolioCss.includes(`--color-${token}:`));
    expect(
      missing,
      `portfolio.css must define --color-* for the banner's chrome classes: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('provides the dark-scheme override so the banner adapts like the rest of chrome', () => {
    expect(portfolioCss).toMatch(/prefers-color-scheme:\s*dark/);
  });
});
