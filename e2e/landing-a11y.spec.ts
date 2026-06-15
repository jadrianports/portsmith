/**
 * LAND-01..05 + D-11 (Phase 22, Plan 22-01, Wave 0) — the public landing-page `/` a11y gate
 * PLUS the DOM/meta shape assertions for the four locked content blocks.
 *
 * Two responsibilities, one spec:
 *   1. A11Y (LAND-05): run `@axe-core/playwright` against `/` and HARD-FAIL on any
 *      serious/critical WCAG violation (semantic landmarks, focus rings, alt text, contrast).
 *      MIRRORS `e2e/template-a11y.spec.ts`: same `WCAG_TAGS`, the serious/critical `isBlocking`
 *      split + the minor/moderate `isWarning` `console.warn` tier, and the hard-fail
 *      `expect(blocking, …).toEqual([])` shape. Differences vs the template gate: navigate
 *      `page.goto('/')` + await `document.fonts.ready` (NO `.tmpl-<slug>` wait, NO `__fixture`
 *      route, NO per-slug loop, NO negative-control fixture — those are template-specific).
 *   2. DOM/META SHAPE (LAND-01/02/03/04 + D-11): assert the page exposes exactly the locked
 *      front-door structure the four blocks require + the marketing metadata.
 *
 * ── RED-TOLERANT NOW ──────────────────────────────────────────────────────────
 * `/` is the Phase-1 placeholder (`<h1>Portsmith</h1>`) until Plan 03 renders the real landing
 * page. So these assertions are RED today and go GREEN once Plan 03 ships the markup + metadata.
 * This file is NOT run in Plan 22-01 (only `tsc --noEmit` compiles it) — it is the executable
 * acceptance contract Plan 03 builds the page against.
 *
 * STEP SELECTOR CONTRACT (read by Plan 03): the how-it-works step count (LAND-02, ≥3) is
 * asserted on the stable attribute selector `[data-landing-step]`. Plan 03 MUST emit one
 * `[data-landing-step]` element per how-it-works step (pick a template → fill structured
 * content → publish). This avoids coupling the gate to incidental heading structure.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Result } from 'axe-core';

/** The WCAG ruleset (mirrors template-a11y.spec.ts:51-52): WCAG 2.0 + 2.1, levels A + AA. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A violation is BLOCKING (hard-fail) at serious/critical impact. */
const isBlocking = (v: Result): boolean => v.impact === 'serious' || v.impact === 'critical';
/** A violation is a WARNING (console.warn, non-blocking) at minor/moderate impact. */
const isWarning = (v: Result): boolean => v.impact === 'minor' || v.impact === 'moderate';

// `next dev` cold-compiles `/` on first hit (Windows, Next 16); generous headroom for the
// first navigation (mirrors the template a11y gate's per-test timeout bump).
test.beforeEach(({}, info) => {
  info.setTimeout(120_000);
});

test('/ — a11y (wcag2a/2aa/21a/21aa, serious+critical hard-fail) — LAND-05', async ({ page }) => {
  await page.goto('/');
  // FONT-READINESS — Playwright does NOT auto-wait for `next/font` (Inter, display:swap);
  // without this axe (color-contrast) can scan mid font-swap.
  await page.evaluate(() => document.fonts.ready);

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  const blocking = results.violations.filter(isBlocking);
  const warnings = results.violations.filter(isWarning);

  // Warn-tier: surface (do NOT fail on) minor/moderate findings (mirrors D-P10-03).
  if (warnings.length) {
    console.warn(
      `[a11y][/] ${warnings.length} non-blocking (minor/moderate): ` +
        warnings.map((w) => `${w.id} (${w.impact})`).join(', '),
    );
  }

  // HARD-FAIL on serious/critical — the message names each violation + its helpUrl.
  expect(
    blocking,
    blocking.map((v) => `${v.id}: ${v.help} → ${v.helpUrl}`).join('\n'),
  ).toEqual([]);
});

test('/ — DOM/meta shape for the four locked blocks (LAND-01/02/03/04 + D-11)', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  // LAND-01 — exactly one <h1> (the hero value proposition; one document headline).
  await expect(page.locator('h1')).toHaveCount(1);

  // LAND-02 — at least 3 how-it-works step items, on the stable `[data-landing-step]`
  // selector (the STEP SELECTOR CONTRACT above; Plan 03 emits one per step).
  const steps = page.locator('[data-landing-step]');
  expect(await steps.count(), 'expected ≥3 how-it-works steps via [data-landing-step]').toBeGreaterThanOrEqual(3);

  // LAND-04 — the primary signup CTA + the secondary login affordance are both present.
  await expect(page.locator('a[href="/signup"]').first()).toBeVisible();
  await expect(page.locator('a[href="/login"]').first()).toBeVisible();

  // LAND-03 — at least two proof screenshots: each a non-empty-alt <img> wrapped in an
  // outbound `a[target="_blank"]` carrying rel~="noopener" (opens the live portfolio in a new
  // tab; noopener is the mandatory new-tab safety attr).
  const proofLinks = page.locator('a[target="_blank"][rel~="noopener"]:has(img[alt]:not([alt=""]))');
  expect(
    await proofLinks.count(),
    'expected ≥2 proof links: a[target="_blank"][rel~="noopener"] each wrapping a non-empty-alt <img>',
  ).toBeGreaterThanOrEqual(2);

  // D-11 — front-door metadata: an ABSOLUTE og:image (crawlers reject relative URLs; no
  // metadataBase is configured, so siteUrl('/og-default.png') must emit an absolute URL) and a
  // twitter:card=summary_large_image.
  const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute('content');
  expect(ogImage, 'meta[property="og:image"] must be present').toBeTruthy();
  expect(ogImage ?? '', 'og:image must be an ABSOLUTE URL (starts with http)').toMatch(/^https?:\/\//);

  const twitterCard = await page
    .locator('meta[name="twitter:card"]')
    .first()
    .getAttribute('content');
  expect(twitterCard, 'meta[name="twitter:card"] must be summary_large_image').toBe(
    'summary_large_image',
  );
});
