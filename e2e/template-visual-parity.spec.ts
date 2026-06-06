/**
 * PIPE-11 — the generalized VISUAL-PARITY render gate (Phase-10 Plan 04, the Wave-2
 * render tier). It renders EVERY registered template (`minimal` + `editorial`) over the
 * SRC-SIDE GOLDEN FIXTURE via the stack-free `__fixture` route (`renderFixture`), captures a
 * committed self-baseline per slug (`<slug>-golden.png`), and re-FAILS on any pixel drift
 * (within the global `maxDiffPixelRatio:0.01`). A Phase-11 ingested template inherits the gate
 * by registry membership (one slug added to `SLUGS`).
 *
 * ── WHY THE GOLDEN FIXTURE, NOT THE FOUNDER SEED (D-P10-04) ────────────────────
 * The Phase-8 origin of this spec rendered the SEEDED founder page (`/jadrianports`) + a fresh
 * cms-auth editorial owner to prove the Plan-08-02 chrome strip shifted no pixel. That
 * served Phase 8. For Phase 10 the regression target is the TEMPLATE RENDER ITSELF over a
 * KNOWN, STABLE content set — so the gate now renders the golden fixture (the same populated
 * content the conformance + a11y gates use) via the `__fixture` route. This SUPERSEDES the
 * live-stack founder-seed parity for Phase-10's regression purpose AND removes the gate's
 * dependency on a running Supabase stack / seeded data — the gate is now self-contained and
 * deterministic. (The Phase-8 `-full.png` baselines are retired with this generalization.)
 *
 * ── DETERMINISM (inherited; do NOT re-specify) ────────────────────────────────
 * The proven recipe lives in `renderFixture` (font-readiness via `document.fonts.ready`, the
 * `<nextjs-portal>` dev-overlay hide) and `playwright.config.ts` (the GLOBAL
 * `contextOptions.reducedMotion:'reduce'` — load-bearing so the ScrollReveal islands stay
 * REVEALED on a full-page capture instead of freezing invisible off-screen; plus
 * `animations:'disabled'`, `caret:'hide'`, `scale:'css'`, `maxDiffPixelRatio:0.01`). The
 * baseline AND the diff both run on the founder's Win11 machine, so cross-OS font rendering is
 * not a flake source.
 *
 * ── DYNAMIC-CONTENT MASK (the Turnstile slot) ─────────────────────────────────
 * The `__fixture` render has NO Turnstile widget (no contact `IntersectionObserver` arm fires
 * against injected data), so `TURNSTILE_SLOT_SELECTOR` masks nothing here — it is the SAME
 * shared convention the live-stack fallback path would need, kept for parity with the other
 * render gates (a harmless no-op on `__fixture`).
 *
 * ── ORDERING (T-10-04-PARITYBASELINE) ─────────────────────────────────────────
 * Baselines MUST be captured on the KNOWN-GOOD render and committed — NEVER captured after a
 * template change (that encodes a regression as "correct"). For Phase 10 the known-good is the
 * current `minimal`/`editorial` render of the golden fixture (captured AFTER the Plan-10-04
 * project-modal WCAG-4.1.2 fix, so the baselines reflect the corrected, accessible render).
 * Capture with: `npx playwright test e2e/template-visual-parity.spec.ts --update-snapshots`.
 *
 * ── PHASE-11 SOURCE-REFERENCE SLOT (D-P10-04) ─────────────────────────────────
 * Phase 10 ships the SELF-baseline (`<slug>-golden.png`) + the documented source-reference
 * SLOT (`e2e/__source-reference__/README.md`, the `<slug>-source.png` convention). Phase 11
 * drops in the operator's Lovable source screenshot and flips the `test.skip` placeholder
 * below to a real `toHaveScreenshot` diff (ingested render vs. source design — translate, not
 * redesign). See `e2e/__source-reference__/README.md`.
 *
 * Run command: `npx playwright test e2e/template-visual-parity.spec.ts` (npm: `gate:parity`).
 * First capture:  `npx playwright test e2e/template-visual-parity.spec.ts --update-snapshots`.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { renderFixture, TURNSTILE_SLOT_SELECTOR } from './helpers/render-fixture';
import { TEMPLATE_SLUGS } from './helpers/slugs';

/**
 * Every registered template slug — the corpus the parity gate generalizes over. Sourced from
 * the SHARED `e2e/helpers/slugs.ts` constant (NOT imported from `registry.ts`, whose
 * `next/dynamic` import is un-resolvable in the Playwright Node ESM runner). WR-05: that shared
 * constant is anchored to `Object.keys(templateRegistry)` by `slugs-anchor.test.ts`, so a
 * Phase-11 template adds one line in `slugs.ts` alongside its registry line — and captures its
 * `<slug>-golden.png` baseline with `--update-snapshots`.
 */
const SLUGS = TEMPLATE_SLUGS;

// `next dev` cold-compiles the `__fixture` route + each lazy template chunk on first hit
// (Windows, Next 16); generous headroom for the first navigation's route compilation.
test.beforeEach(({}, info) => {
  info.setTimeout(120_000);
});

for (const slug of SLUGS) {
  test(`${slug} — full-page visual parity (golden fixture, PIPE-11)`, async ({ page }) => {
    // POPULATED render of the SRC-SIDE golden fixture via the stack-free __fixture route —
    // the SAME render the conformance + a11y gates use. renderFixture already awaits
    // `.tmpl-<slug>` visible + `document.fonts.ready` + hides the dev overlay.
    await renderFixture(page, slug, { variant: 'full' });

    // Self-baseline `<slug>-golden.png` under snapshotPathTemplate
    // (e2e/__screenshots__/template-visual-parity.spec.ts/). The Turnstile mask is the shared
    // convention (no-op on __fixture — there is no Turnstile widget here). Drift beyond
    // maxDiffPixelRatio:0.01 (a real layout shift) FAILS the gate.
    await expect(page).toHaveScreenshot(`${slug}-golden.png`, {
      fullPage: true,
      mask: [page.locator(TURNSTILE_SLOT_SELECTOR)],
    });
  });
}

/**
 * PHASE-11 SOURCE-PARITY SLOT (D-P10-04 — FILE-EXISTENCE GUARDED). Phase 10 shipped the slot +
 * the self-baseline above; Phase 11 makes the source-parity case CONDITIONAL on a committed
 * `e2e/__source-reference__/<slug>-source.png` existing on disk: the case RUNS a real
 * translate-not-redesign diff (ingested render vs. the operator's Lovable source screenshot)
 * ONLY for a slug whose source PNG is committed, and stays SKIPPED otherwise.
 *
 * WHY GUARDED, NOT FLIPPED (D-P11-10 / 11-04-ADDENDUM): minimal + editorial are bespoke,
 * self-baseline-only templates with no source PNG — they STAY skipped. `aurora` (the Wave-C
 * marketer dogfood, the marketing-girl export) deliberately DEFERS source-parity: the source
 * is an SPA multi-page Lovable design and aurora collapses it to a single-scroll template, so a
 * full-page source-PNG diff would not be a translate-not-redesign signal. Aurora ships on its
 * own committed golden SELF-baseline (the loop above) only; its source-parity case stays
 * SKIPPED via this file-existence guard (no `aurora-source.png` is committed). When a FUTURE
 * single-scroll ingest drops in a real `<slug>-source.png`, this case activates automatically
 * at the tuned `maxDiffPixelRatio` (start ~0.04 — looser than the 0.01 self-baseline to absorb
 * anti-aliasing + RSC-vs-React render + Lovable paraphrase). See `__source-reference__/README.md`.
 */
const SOURCE_REF_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '__source-reference__');
for (const slug of SLUGS) {
  const sourcePng = path.join(SOURCE_REF_DIR, `${slug}-source.png`);
  const hasSourceRef = existsSync(sourcePng);
  test(`${slug} — source-design parity (file-existence guarded — __source-reference__/${slug}-source.png)`, async ({
    page,
  }) => {
    // FILE-EXISTENCE GUARD (D-P11-10): skip unless the operator committed `<slug>-source.png`.
    // minimal/editorial (no source PNG, self-baseline only) and aurora (source-parity DEFERRED,
    // SPA→single-scroll, no source PNG committed) all stay skipped here. A future single-scroll
    // ingest with a committed source PNG activates this diff automatically.
    test.skip(
      !hasSourceRef,
      `no committed e2e/__source-reference__/${slug}-source.png — source-parity not applicable for "${slug}" ` +
        `(self-baseline only / deferred). Drop in the source screenshot to activate this diff.`,
    );
    // Render the ingested template over the golden fixture, then diff against the operator's
    // committed source screenshot (translate-not-redesign — a drift is a FINDING, not trusted).
    await renderFixture(page, slug, { variant: 'full' });
    await expect(page).toHaveScreenshot(`../__source-reference__/${slug}-source.png`, {
      fullPage: true,
      // Looser than the 0.01 self-baseline: anti-aliasing + RSC-vs-React render + Lovable
      // paraphrase. Tune DOWN if it passes a visibly-divergent render; UP only with a
      // documented anti-aliasing reason (record the chosen ratio in the INGEST-MANIFEST).
      maxDiffPixelRatio: 0.04,
      mask: [page.locator(TURNSTILE_SLOT_SELECTOR)],
    });
  });
}
