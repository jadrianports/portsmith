/**
 * 13.2-07 — BLOG-ENGINE before/after VISUAL-PARITY gate (D-17 "fidelity measured,
 * not asserted"). The dogfood proof for SC-3: the founder's 3 posts are now REAL
 * published `blog_posts` rows served by the engine, and these self-baselines lock
 * the engine render of the three edgerunner-v2 sub-routes so the upcoming deletion
 * of the static transcription files (`posts.tsx`, `post-data.ts`, `code-data.ts`)
 * cannot drift a pixel.
 *
 * ── WHY LIVE ROUTES, NOT THE __fixture ROUTE (vs. template-visual-parity.spec.ts) ─
 * The generalized parity gate (`e2e/template-visual-parity.spec.ts`) renders each
 * registered template over the stack-free `__fixture` route — a self-contained,
 * Supabase-free render of the golden fixture. That proves the single-scroll
 * `/[username]` template render. This spec is DIFFERENT: the sub-routes (`/blog`,
 * `/blog/[slug]`, `/services`) read REAL seeded DB rows through the cookie-less ISR
 * lane (`get-posts.ts` / `get-portfolio.ts`), and the blog body is the engine's
 * server-rendered Markdown (the `MarkdownRenderer` pipeline). So the parity target
 * MUST be the LIVE dev server + the LOCAL seeded stack — mirroring the live-route
 * approach of `e2e/portfolio-render.spec.ts` (`page.goto('/jadrianports…')`), not
 * the injected-fixture approach. The baseline captured here IS the engine render;
 * the blocking human-verify (13.2-07 Task 2) confirms it matches the pre-engine
 * static transcription before the static files are deleted.
 *
 * ── PRECONDITION (LOAD-BEARING) ───────────────────────────────────────────────
 * Runs against the LIVE dev server (playwright.config.ts `webServer: npm run dev`,
 * baseURL http://127.0.0.1:3000) + the LOCAL Supabase stack, reading the SEEDED
 * published founder portfolio (the 3 posts seeded by `scripts/seed-founder-portfolio.ts`
 * step 7). Before running:
 *
 *     supabase start          # the local stack (DB/API)
 *     npm run seed:founder    # idempotent — seeds the 3 published founder posts
 *
 * If a sub-route 404s, the seed has not been run (or the founder is not on the
 * edgerunner-v2 exclusive-lane template whose spec opts into the `blog`/`services`
 * pages) — the spec FAILS LOUDLY with that hint rather than silently skipping (a
 * missing seed must not false-green the gate).
 *
 * ── DETERMINISM (inherited — do NOT re-specify) ───────────────────────────────
 * The global `playwright.config.ts` recipe applies automatically:
 * `contextOptions.reducedMotion: 'reduce'` (keeps the motion/react islands in their
 * reduced-motion end-state — `initial={false}` already renders them visible, so a
 * full-page capture is stable instead of frozen mid-entrance), `animations:'disabled'`,
 * `caret:'hide'`, `scale:'css'`, `maxDiffPixelRatio:0.01`. Per-route this spec adds
 * the proven font-readiness wait (`document.fonts.ready` — Playwright does NOT auto-
 * wait for `next/font`) and the `next dev` overlay hide, both EXTRACTED from
 * `e2e/helpers/render-fixture.ts` (the shared determinism helper).
 *
 * ── ORDERING / FILE-EXISTENCE GUARD ───────────────────────────────────────────
 * Like the golden-fixture gate, a route whose self-baseline is not yet captured is
 * SKIPPED on a normal verification run (so the gate stays green through the deletion
 * wave) but PROCEEDS on an explicit `--update-snapshots` capture. The 13.2-07 Task 2
 * deletion re-runs this spec to prove the engine render diffs clean against these
 * baselines with the static transcription layer removed.
 *
 * Run command:  npx playwright test e2e/blog-engine-parity.spec.ts
 * First capture: npx playwright test e2e/blog-engine-parity.spec.ts --update-snapshots
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { HIDE_NEXT_DEV_OVERLAY, TURNSTILE_SLOT_SELECTOR } from './helpers/render-fixture';

/** The seeded founder public slug (D-27 — MUST match generateStaticParams). */
const SEEDED_USERNAME = 'jadrianports';

/**
 * The edgerunner-v2 scoped template root (proves the lazy template chunk + page
 * shell rendered). The sub-routes wrap content in `EdgerunnerV2PageShell`, whose
 * scoped root class is `tmpl-edgerunner-v2` (page-shell.tsx:109 — the SAME scoped
 * root the main `index.tsx` emits; NOT the registry slug `edgerunner`).
 */
const TEMPLATE_ROOT = '.tmpl-edgerunner-v2';

/**
 * The three engine-fed sub-routes whose render this gate locks, each with the
 * self-baseline file name. The post page uses an actual seeded slug
 * (`shipping-on-the-edge`, the newest founder post — display_date 2026-04-18).
 */
const ROUTES = [
  { name: 'blog index', urlPath: `/${SEEDED_USERNAME}/blog`, snapshot: 'blog-index.png' },
  {
    name: 'blog post',
    urlPath: `/${SEEDED_USERNAME}/blog/shipping-on-the-edge`,
    snapshot: 'blog-post-shipping-on-the-edge.png',
  },
  { name: 'services', urlPath: `/${SEEDED_USERNAME}/services`, snapshot: 'services.png' },
] as const;

// The committed self-baselines live at
// `{testDir}/__screenshots__/{testFilePath}/{snapshot}` (the global
// snapshotPathTemplate in playwright.config.ts). This dir backs the FILE-EXISTENCE
// GUARD so a route whose baseline is not yet captured does not hard-fail the gate.
const SNAPSHOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '__screenshots__',
  'blog-engine-parity.spec.ts',
);

// `next dev` cold-compiles each sub-route + lazy template chunk on first hit
// (Windows, Next 16); generous headroom for the first navigation's route compilation.
test.beforeEach(({}, info) => {
  info.setTimeout(120_000);
});

for (const route of ROUTES) {
  const snapshotPng = path.join(SNAPSHOT_DIR, route.snapshot);

  test(`${route.name} — engine render parity (${route.urlPath})`, async ({ page }) => {
    // `updateSnapshots: 'none'` ⇒ a normal verification run (no capture). Any other
    // value ('all'/'missing'/'changed' under `--update-snapshots`) is a capture run —
    // let it proceed so the baseline CAN be created (a blanket skip would prevent it).
    const isVerificationRun = test.info().config.updateSnapshots === 'none';
    test.skip(
      isVerificationRun && !existsSync(snapshotPng),
      `engine-parity baseline not yet captured for "${route.urlPath}" (no committed ` +
        `${route.snapshot}) — skipping its diff on this verification run (the gate stays ` +
        'green). Capture it with `npx playwright test e2e/blog-engine-parity.spec.ts ' +
        '--update-snapshots`.',
    );

    const response = await page.goto(route.urlPath);

    // Precondition guard: a non-200 means the founder posts were not seeded (or the
    // founder is not on the edgerunner exclusive-lane template). Fail loudly with the
    // fix rather than silently skipping — a missing seed must not false-green the gate.
    expect(
      response?.status(),
      `GET ${route.urlPath} returned ${response?.status()}. The founder blog/services ` +
        'sub-routes are not served — run `supabase start` then `npm run seed:founder` ' +
        'against the local stack (the 3 posts must be seeded + published).',
    ).toBe(200);

    // The scoped edgerunner template root rendered (proves the lazy chunk + page shell).
    await expect(page.locator(TEMPLATE_ROOT)).toBeVisible();

    // FONT-READINESS — Playwright does NOT auto-wait for `next/font` (`display:'swap'`);
    // without this a capture can land mid font-swap (extracted from render-fixture.ts).
    await page.evaluate(() => document.fonts.ready);

    // Exclude the `next dev` overlay (dev chrome, not a template element).
    await page.addStyleTag({ content: HIDE_NEXT_DEV_OVERLAY });

    // Self-baseline under snapshotPathTemplate. The Turnstile mask is the shared
    // convention (the contact widget is not on these sub-routes — a harmless no-op).
    // Drift beyond maxDiffPixelRatio:0.01 (a real layout shift) FAILS the gate.
    await expect(page).toHaveScreenshot(route.snapshot, {
      fullPage: true,
      mask: [page.locator(TURNSTILE_SLOT_SELECTOR)],
    });
  });
}
