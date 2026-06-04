/**
 * The axe A11Y gate (Phase-10 Plan 04, the Wave-2 render tier) — the repo's FIRST automated
 * WCAG gate. It runs `@axe-core/playwright` (axe-core 4.11) against each registered template's
 * POPULATED render and HARD-FAILS on serious/critical violations, WARNING (not failing) on
 * minor/moderate. It is generalized over `Object.keys(templateRegistry)` (→ `minimal` +
 * `editorial`); a Phase-11 ingested template inherits the gate by registry membership.
 *
 * ── WHY THE POPULATED RENDER (Pitfall 7) ──────────────────────────────────────
 * axe's load-bearing rules (`image-alt`, `color-contrast`, `heading-order`, `link-name`,
 * `target-size`) need REAL content. The all-null render is empty, so axe would find nothing
 * and the gate would false-GREEN. So the gate runs against `variant=full` (the golden
 * fixture) ONLY — the same render the conformance/parity gates use, via `renderFixture`
 * (which already awaits `.tmpl-<slug>` visible + `document.fonts.ready` before axe runs).
 *
 * ── THE RULESET + THRESHOLD (D-P10-03) ────────────────────────────────────────
 * `withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])` (RESEARCH A2 — wcag21 adds
 * target-size/orientation rules the templates already satisfy; if a 2.1 rule false-fails it is
 * a real finding to fix OR a documented drop to 2.0 tags). Serious/critical → HARD-FAIL (the
 * message names each violation + its helpUrl). minor/moderate → `console.warn` only (the
 * D-P10-03 warn-tier — non-blocking findings are surfaced, not gated).
 *
 * NOTE: the `__fixture` render has NO Turnstile widget, so NO `.exclude(...)` is needed here.
 * The live-stack fallback render (`cms-auth.ts` → `/<username>`) WOULD need
 * `.exclude('[data-testid="turnstile-slot"]')` to keep the third-party iframe out of the scan.
 *
 * ── NEGATIVE CONTROL (B1 / D-P10-02 — the a11y gate's WITNESSED RED) ───────────
 * "A gate that has only ever passed is untrusted." Plan 10-02 added a CONCRETE WCAG violation
 * to the negative fixture (`tests/fixtures/broken-template/index.tsx`): an `<img>` with NO
 * `alt` attribute → axe `image-alt` (serious/critical under wcag2a). Because the broken fixture
 * is registry-ABSENT and can NEVER be imported by a Next route (W8 / T-10-02-GRAPHLEAK forbids
 * any `tests/` import in the Next graph), the negative-control renders the alt-less `<img>` via
 * `page.setContent` (no Next route, no graph import) — anchored to the real broken-fixture
 * SOURCE so it cannot drift — and asserts the SAME axe scan yields ≥1 serious/critical
 * violation (the `image-alt` rule), i.e. the gate has a WITNESSED FAILURE, not only a witnessed
 * pass. This is the inverse of the corpus expectation: the corpus PASSES iff blocking == 0, the
 * negative control PASSES iff blocking > 0.
 *
 * Run: `npx playwright test e2e/template-a11y.spec.ts` (npm: `gate:a11y`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Result } from 'axe-core';

import { renderFixture } from './helpers/render-fixture';
import { TEMPLATE_SLUGS } from './helpers/slugs';

/** The WCAG ruleset (RESEARCH A2): WCAG 2.0 + 2.1, levels A + AA. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A violation is BLOCKING (hard-fail) at serious/critical impact. */
const isBlocking = (v: Result): boolean => v.impact === 'serious' || v.impact === 'critical';
/** A violation is a WARNING (console.warn, non-blocking) at minor/moderate impact. */
const isWarning = (v: Result): boolean => v.impact === 'minor' || v.impact === 'moderate';

/**
 * Every registered template slug — the corpus the a11y gate generalizes over. Sourced from the
 * SHARED `e2e/helpers/slugs.ts` constant (NOT imported from `registry.ts`, whose `next/dynamic`
 * import the Playwright Node ESM runner cannot resolve at collection time). WR-05: that shared
 * constant is anchored to `Object.keys(templateRegistry)` by `slugs-anchor.test.ts`, so a
 * Phase-11 template addition fails loudly until the slug is added.
 */
const SLUGS = TEMPLATE_SLUGS;

// `next dev` cold-compiles the `__fixture` route + each lazy template chunk on first hit
// (Windows, Next 16); generous headroom for the first navigation (parity-spec budget).
test.beforeEach(({}, info) => {
  info.setTimeout(120_000);
});

for (const slug of SLUGS) {
  test(`${slug} — a11y (wcag2a/2aa/21a/21aa, serious+critical hard-fail)`, async ({ page }) => {
    // POPULATED render (Pitfall 7) via the stack-free __fixture route — renderFixture awaits
    // `.tmpl-<slug>` visible + `document.fonts.ready` so axe scans the settled, real-content DOM.
    await renderFixture(page, slug, { variant: 'full' });

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    const blocking = results.violations.filter(isBlocking);
    const warnings = results.violations.filter(isWarning);

    // D-P10-03 warn-tier: surface (do NOT fail on) minor/moderate findings.
    if (warnings.length) {
      console.warn(
        `[a11y][${slug}] ${warnings.length} non-blocking (minor/moderate): ` +
          warnings.map((w) => `${w.id} (${w.impact})`).join(', '),
      );
    }

    // HARD-FAIL on serious/critical — the message names each violation + its helpUrl so a real
    // finding is actionable. A real serious/critical violation must be FIXED in the template
    // before the plan closes; the gate passing on the corpus is the success state.
    expect(
      blocking,
      blocking.map((v) => `${v.id}: ${v.help} → ${v.helpUrl}`).join('\n'),
    ).toEqual([]);
  });
}

/**
 * NEGATIVE CONTROL (B1 / D-P10-02 / T-10-04-A11YBLINDSPOT): prove the a11y gate goes RED on the
 * negative fixture's concrete WCAG violation. The broken fixture is registry-absent and cannot
 * enter the Next graph (W8), so its alt-less `<img>` is rendered via `page.setContent` — anchored
 * to the real broken-fixture source so the control cannot silently drift.
 */
test.describe('negative control — a11y REJECTS the broken fixture alt-less <img> (B1 / D-P10-02)', () => {
  const BROKEN_INDEX = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'tests',
    'fixtures',
    'broken-template',
    'index.tsx',
  );
  const brokenIndexSrc = readFileSync(BROKEN_INDEX, 'utf8');

  test('the broken fixture SOURCE still renders an alt-less <img> (anchor)', () => {
    // ANCHOR: if the broken fixture's `<img>` gains an `alt` (or the element is removed), this
    // control is no longer testing the B1 violation it claims — re-validate it. The fixture's
    // image-tag has NO `alt=` attribute (the deliberate axe `image-alt` trip, lines 83-87).
    const imgTag = brokenIndexSrc.match(/<img[^>]*src="https:\/\/evil\.example\/tracker\.png"[^>]*>/);
    expect(imgTag, 'broken-template/index.tsx must render the deliberate <img src="https://evil.example/tracker.png">.')
      .not.toBeNull();
    expect(
      imgTag?.[0],
      'broken-template/index.tsx <img> must have NO alt attribute (the B1 image-alt WCAG violation).',
    ).not.toMatch(/\balt=/);
  });

  test('axe finds ≥1 serious/critical violation (image-alt) on the alt-less <img>', async ({
    page,
  }) => {
    // Faithful DOM of the broken fixture's a11y-relevant markup: the alt-less <img> (the B1
    // image-alt trip) inside a `.tmpl-broken` root, mirroring tests/fixtures/broken-template/
    // index.tsx lines 79-87. (1×1 px in the source; given a visible size here so axe evaluates
    // it — axe ignores zero-area/hidden images, which would mask the very violation we assert.)
    await page.setContent(
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>broken</title></head>
       <body><div class="tmpl-broken" data-template-root>
         <h1>BROKEN</h1>
         <img src="https://evil.example/tracker.png" width="120" height="80">
       </div></body></html>`,
    );

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const blocking = results.violations.filter(isBlocking);

    // The load-bearing assertion: the a11y gate WITNESSES a serious/critical reject (inverts the
    // corpus expectation — here blocking MUST be non-empty).
    expect(
      blocking.length,
      'expected the alt-less <img> to surface ≥1 serious/critical axe violation (the a11y RED, B1). ' +
        `Got violations: ${results.violations.map((v) => `${v.id} (${v.impact})`).join(', ') || '(none)'}`,
    ).toBeGreaterThan(0);

    // Sharper signal: one of the blocking violations is `image-alt` (the alt-less <img> rule).
    expect(
      blocking.map((v) => v.id),
      'expected the `image-alt` rule among the serious/critical violations (the alt-less <img> → B1).',
    ).toContain('image-alt');
  });
});
