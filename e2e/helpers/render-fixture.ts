/**
 * `renderFixture(page, slug, opts?)` — the CENTRALIZED render-determinism recipe for the
 * four Wave-2 render gates (conformance, a11y, parity, thumbnails; Phase-10 Plan 02).
 *
 * This is the single most-reused pattern across the render gates — getting it wrong is
 * flake. It navigates the stack-free `/__fixture/<slug>` route, then applies the proven
 * determinism sequence EXTRACTED from `e2e/template-visual-parity.spec.ts:121-135`:
 *
 *   1. `page.goto('/__fixture/<slug>?variant=...')` — the injected-fixture render target.
 *   2. `await expect(page.locator('.tmpl-<slug>')).toBeVisible()` — proves the lazy
 *      template chunk loaded + rendered.
 *   3. `await page.evaluate(() => document.fonts.ready)` — Playwright does NOT auto-wait
 *      for `next/font` (`display:'swap'`); without this a capture can land mid font-swap.
 *   4. `await page.addStyleTag({ content: HIDE_NEXT_DEV_OVERLAY })` — hide the `next dev`
 *      overlay (dev chrome, not a template element).
 *
 * GLOBAL determinism (`playwright.config.ts`) is inherited automatically — do NOT
 * re-specify here: `contextOptions.reducedMotion: 'reduce'` (keeps the ScrollReveal
 * islands revealed so off-screen sections don't freeze invisible on a full-page capture),
 * `animations: 'disabled'`, `maxDiffPixelRatio: 0.01`, `caret: 'hide'`, `scale: 'css'`.
 *
 * The live-stack `e2e/helpers/cms-auth.ts` path is the proven FALLBACK render target if
 * the `__fixture` route is ever undesirable.
 */
import { expect, type Page, type Response } from '@playwright/test';

/**
 * Hides the `next dev` overlay (`<nextjs-portal>` — the dev indicator / dev-tools button)
 * before a capture. Dev chrome, NOT a template element. Shared so the parity / conformance
 * / a11y specs hide it identically (extracted from `template-visual-parity.spec.ts:100`).
 */
export const HIDE_NEXT_DEV_OVERLAY = 'nextjs-portal{display:none!important}';

/**
 * The deferred-Turnstile slot mask convention — the ONE nondeterministic third-party slot
 * a full-page capture must mask. Pass `mask: [page.locator(TURNSTILE_SLOT_SELECTOR)]` to
 * `toHaveScreenshot`. On the `__fixture` render there is no Turnstile, so the mask is a
 * harmless no-op here; it stays the shared convention for the live-stack fallback path.
 */
export const TURNSTILE_SLOT_SELECTOR = '[data-testid="turnstile-slot"]';

/** Options for {@link renderFixture}. */
export interface RenderFixtureOptions {
  /** `'full'` (golden, populated) | `'null'` (all-null). Defaults to `'full'`. */
  variant?: 'full' | 'null';
  /** For `variant: 'null'`: the all-null sub-variant. Defaults to `'empty'`. */
  sub?: 'empty' | 'null-content';
}

/**
 * Navigate the `__fixture` render route for `slug` + `opts` and apply the determinism
 * recipe. Returns the navigation `Response` (for status assertions) and the ready `page`.
 */
export async function renderFixture(
  page: Page,
  slug: string,
  opts?: RenderFixtureOptions,
): Promise<{ page: Page; response: Response | null }> {
  const variant = opts?.variant ?? 'full';
  const sub = opts?.sub ?? 'empty';
  const subQuery = variant === 'null' ? `&sub=${sub}` : '';

  const response = await page.goto(`/__fixture/${slug}?variant=${variant}${subQuery}`);

  // The scoped template root rendered (proves the lazy template chunk loaded).
  await expect(page.locator(`.tmpl-${slug}`)).toBeVisible();

  // FONT-READINESS — Playwright does NOT auto-wait for `next/font`.
  await page.evaluate(() => document.fonts.ready);

  // Exclude the `next dev` overlay (dev chrome, not template).
  await page.addStyleTag({ content: HIDE_NEXT_DEV_OVERLAY });

  return { page, response };
}
