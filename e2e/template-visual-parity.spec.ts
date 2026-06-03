/**
 * D-01 — the visual-regression PARITY harness (Phase 08, Plan 08-01). This spec
 * captures a deterministic FULL-PAGE screenshot of BOTH live templates on the
 * PRE-refactor tree so the post-refactor pixel-diff (Plan 03) can prove the
 * chrome strip (Plan 02) shifted not one pixel of either template render.
 *
 *   1) MINIMAL  — the seeded founder public page `/jadrianports` (`.tmpl-minimal`,
 *      dark synthwave). Read-only against the LIVE local stack; reuses the
 *      seed-or-fail guard from `e2e/portfolio-render.spec.ts` so a missing seed
 *      FAILS LOUDLY instead of silently false-greening the baseline.
 *   2) EDITORIAL — a fresh self-provisioned owner whose public page renders
 *      `.tmpl-editorial` (light ivory). A NEWLY bootstrapped portfolio defaults to
 *      EDITORIAL (migration 008 part C — the founder STAYS minimal, D-P7-09), so
 *      `createConfirmedOwner` → `setOwnerPublished(true)` → `waitForPublicState`
 *      yields the editorial render with NO template-switch UI driving required.
 *      The owner is torn down in `afterAll` (LOCAL stack only, `*@example.test`).
 *
 * ── DETERMINISM (D-01) ────────────────────────────────────────────────────────
 * The baseline AND the diff both run on the founder's Win11 machine, so cross-OS
 * font rendering is NOT a flake source. The two real flake sources are handled:
 *   - ANIMATIONS — frozen at end-state by `expect.toHaveScreenshot.animations:
 *     'disabled'` in playwright.config.ts (the templates' hero LCP wrapper is
 *     already static and the scroll-reveal islands SSR `opacity:1`).
 *   - FONT-LOAD TIMING — the templates load self-hosted faces via `next/font`
 *     (`display:'swap'`). Playwright does NOT auto-wait for fonts, so each test
 *     awaits `document.fonts.ready` BEFORE the capture — without it the first
 *     screenshot can land mid-swap. (`toHaveScreenshot` itself also auto-stabilizes
 *     by waiting for two consecutive identical frames, absorbing late layout settle.)
 * No masking is needed for v1 (no clocks / random content on either page). If a
 * residual ambient animation ever surfaces in a diff, the config freeze already
 * covers it — do NOT add masking unless a genuinely dynamic element appears.
 *
 * ── REDUCED-MOTION (D-01, the load-bearing capture fix) ───────────────────────
 * The body sections of BOTH templates are wrapped in a `ScrollReveal`
 * IntersectionObserver island (scroll-reveal.tsx) that, when motion is allowed,
 * hydrates to `opacity:0` and only reveals on intersection. A `fullPage` capture
 * renders the whole document at once, so off-screen sections never intersect and
 * would freeze INVISIBLE — the baseline would show only the hero + footer. The
 * harness emulates `prefers-reduced-motion: reduce` (playwright.config.ts `use`)
 * which (a) drives the island's `prefersReduced` branch (sections stay revealed)
 * and (b) triggers the CSS fallback `.tmpl-reveal { opacity:1 !important }`
 * (theme.css), so the FULL body renders visible with zero entrance motion. This
 * is the canonical reduced-motion render and is identical pre/post Plan 02.
 *
 * ── NEXT DEV OVERLAY EXCLUSION (D-01) ─────────────────────────────────────────
 * `next dev` injects a top-level `<nextjs-portal>` custom element hosting the dev
 * indicator / dev-tools button (confirmed via a live DOM probe: it is the only
 * dev-chrome element with a visual footprint, it is NOT inside any template root,
 * and the template theme-toggle — `aria-label="Switch to {light|dark} mode"` — is
 * a SEPARATE element outside it). It is in-frame on a `fullPage` capture but is
 * dev chrome, not template, so it must be excluded: Plan 02's chrome strip changes
 * which dev warnings fire, which could perturb the indicator and false-fail the
 * diff. Each test hides `nextjs-portal` via `addStyleTag` BEFORE capture (cleaner
 * than a Playwright `mask` — the element is gone, no pink mask box in the image).
 * This touches NO template element (the theme-toggle stays visible).
 *
 * ── PRECONDITION (LOAD-BEARING) ───────────────────────────────────────────────
 * Runs against the LIVE dev server (playwright.config.ts `webServer: npm run dev`,
 * baseURL http://127.0.0.1:3000) + the LOCAL Supabase stack. The minimal test
 * reads the SEEDED founder portfolio; the editorial test self-provisions via the
 * service-role admin API (key from `.env.local`, which playwright.config.ts loads).
 *
 * ── ORDERING (the single most important constraint in Phase 08) ───────────────
 * The baselines MUST be captured on the PRE-refactor tree, committed, THEN diffed
 * after the layout split. Baselines captured after the refactor would encode the
 * post-refactor state as "correct" and prove nothing.
 *
 * Run command: `npx playwright test e2e/template-visual-parity.spec.ts`.
 * First capture: `npx playwright test e2e/template-visual-parity.spec.ts --update-snapshots`.
 */
import { expect, test } from '@playwright/test';

import {
  createConfirmedOwner,
  deleteOwner,
  setOwnerPublished,
  waitForPublicState,
  type TestOwner,
} from './helpers/cms-auth';

/** The seeded founder public slug — minimal template (must match generateStaticParams). */
const SEEDED = 'jadrianports';

/**
 * Hides the `next dev` overlay (`<nextjs-portal>` — the dev indicator / dev-tools
 * button) before a full-page capture. Dev chrome, NOT a template element, so it is
 * excluded from the baseline; touches no template element (the theme-toggle is a
 * separate element outside the portal). Injected per-test right before `toHaveScreenshot`.
 */
const HIDE_NEXT_DEV_OVERLAY = 'nextjs-portal{display:none!important}';

// `next dev` cold-compiles `/[username]` on first hit (Windows, Next 16); give
// generous headroom so the first navigation's route compilation fits the budget.
test.beforeEach(({}, info) => {
  info.setTimeout(120_000);
});

test('minimal template — full-page visual parity (founder seed)', async ({ page }) => {
  const res = await page.goto(`/${SEEDED}`);

  // Precondition guard: a non-200 means the founder portfolio was not seeded. Fail
  // loudly with the fix rather than silently skipping — a missing seed must not
  // false-green the baseline (mirrors portfolio-render.spec.ts).
  expect(
    res?.status(),
    `GET /${SEEDED} returned ${res?.status()}. The founder portfolio is not seeded — ` +
      'seed not run: supabase start && npm run seed:founder (against the local stack).',
  ).toBe(200);

  // The scoped template root rendered (proves the lazy `minimal` template loaded).
  await expect(page.locator('.tmpl-minimal')).toBeVisible();

  // FONT-READINESS — Playwright does NOT auto-wait for `next/font`; without this
  // the first capture can land mid font-swap (`display:'swap'`).
  await page.evaluate(() => document.fonts.ready);

  // Exclude the `next dev` overlay (dev chrome, not template) so the Plan 02 chrome
  // strip — which changes which dev warnings fire — can't perturb the diff.
  await page.addStyleTag({ content: HIDE_NEXT_DEV_OVERLAY });

  await expect(page).toHaveScreenshot('minimal-full.png', { fullPage: true });
});

test.describe('editorial template — full-page visual parity (fresh owner)', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    // A NEWLY bootstrapped portfolio defaults to EDITORIAL (migration 008 part C) —
    // so this fresh owner's public page renders `.tmpl-editorial` with no switch UI
    // to drive. Provision via the service-role admin API (LOCAL stack only).
    owner = await createConfirmedOwner('vparity');
    // A fresh account is unpublished; publish so the public ISR page is live.
    await setOwnerPublished(owner, true);
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('seeded editorial owner full-page visual parity', async ({ page }) => {
    const publicPath = `/${owner.username}`;

    // The on-demand publish + ISR purge is fast but not synchronous — poll until the
    // public page is live (200) before capturing.
    await waitForPublicState(page, publicPath, { status: 200 });

    await page.goto(publicPath);

    // The scoped editorial template root rendered (proves the editorial template loaded).
    await expect(page.locator('.tmpl-editorial')).toBeVisible();

    // FONT-READINESS — same as the minimal test (self-hosted `next/font` faces).
    await page.evaluate(() => document.fonts.ready);

    // Exclude the `next dev` overlay (dev chrome, not template) — same as the minimal test.
    await page.addStyleTag({ content: HIDE_NEXT_DEV_OVERLAY });

    await expect(page).toHaveScreenshot('editorial-full.png', { fullPage: true });
  });
});
