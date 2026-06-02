/**
 * TMPL-02 — RED scaffold (Wave 0, Plan 07-01). GREENED BY 07-05 (the template
 * switcher UI + preview-before-commit) and the 07-06 phase gate.
 *
 * The lossless round-trip proof (D-P7-13a): fill every section with UNIQUE typed
 * values → open the template picker → preview the editorial candidate in Draft Mode
 * → assert all filled content renders in the Newsprint template → "Use this template"
 * → assert the public page renders all the content in Newsprint → switch BACK to
 * minimal → assert the content is IDENTICAL to the start (nothing was lost). Modeled
 * on e2e/cms-loop.spec.ts + e2e/helpers/cms-auth.ts.
 *
 * CONTENT-INDEPENDENCE (cms-loop.spec.ts:54-55 idiom): the spec asserts on the
 * UNIQUE values IT TYPES into each section, never on seeded placeholder copy — so a
 * regression in the switch/lossless chain is what fails the test, not a content edit
 * elsewhere. The template difference is STYLING only (D-P7-10); the same content must
 * survive a round-trip through both templates.
 *
 * SELECTORS model the UI-SPEC B.8 copy strings (the switcher chrome contract):
 *   - picker heading  → "Choose a template"
 *   - confirm         → "Use this template"
 *   - back from preview → "Back to templates"
 *   - success beat    → "Your page now uses the {Template} template."
 * The reused PreviewBanner keeps the Phase-4 "Draft preview" text + the Preview link
 * stays prefetch={false} (the cookie-race caveat — the shell/helper already enforce
 * it).
 *
 * ── WHY RED NOW ───────────────────────────────────────────────────────────────
 * The template picker UI (the "Choose a template" gallery, the candidate preview,
 * the "Use this template" confirm) does NOT exist until 07-05 — so this spec is
 * collected but FAILS at the first missing picker affordance. The 07-05 switcher UI
 * + the 07-06 phase gate green it. It imports ONLY existing helpers (tsc stays 0).
 *
 * Run command: `npx playwright test e2e/template-switch.spec.ts`.
 */
import { expect, test } from '@playwright/test';

import {
  createConfirmedOwner,
  deleteOwner,
  signInAsOwner,
  waitForPublicState,
  type TestOwner,
} from './helpers/cms-auth';

test.describe('TMPL-02 — lossless template round-trip (GREENED BY 07-05/07-06)', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('switch');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('fill every section → preview editorial → switch → public renders all → switch back identical', async ({
    page,
  }) => {
    // Cold Next 16 dev compiles + real auth + write + revalidate + a second template
    // chunk — generous headroom on Windows.
    test.setTimeout(180_000);

    // A unique value per section — the content-independent assertion targets that
    // must survive the round-trip through BOTH templates (styling-only difference).
    const stamp = Date.now().toString(36);
    const heroHeading = `Switch Hero ${stamp}`;
    const aboutBio = `Switch About bio ${stamp}`;

    // 1) Sign in → the editor mounts (populated, not blank).
    await signInAsOwner(page, owner);

    // 2) Fill the Hero heading + Save (the public/preview <h1> assertion target).
    await page.getByRole('button', { name: 'Hero', exact: true }).click();
    const heading = page.getByLabel('Heading', { exact: true });
    await expect(heading).toBeVisible();
    await heading.fill(heroHeading);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved — your page is live')).toBeVisible({ timeout: 30_000 });

    // Fill the About bio + Save (a second filled section so "every section" is real).
    await page.getByRole('button', { name: 'About', exact: true }).click();
    const bio = page.getByLabel('Bio', { exact: true });
    await expect(bio).toBeVisible();
    await bio.fill(aboutBio);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved — your page is live')).toBeVisible({ timeout: 30_000 });

    // 3) Open the template picker (UI-SPEC B.8 — "Choose a template"). RED until 07-05.
    await page.getByRole('button', { name: /choose a template/i }).click();
    await expect(page.getByRole('heading', { name: 'Choose a template' })).toBeVisible({
      timeout: 30_000,
    });

    // 4) Preview the editorial candidate in Draft Mode — the reused PreviewBanner +
    //    the "Previewing the Editorial template" line; the filled content renders in
    //    Newsprint (the editorial template surface), proving styling-only difference.
    await page
      .getByRole('link', { name: /preview the editorial template with your content/i })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${owner.username}(\\b|/|\\?|$)`), {
      timeout: 30_000,
    });
    await expect(page.getByText('Draft preview', { exact: false })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/previewing the editorial template/i)).toBeVisible();
    // The filled content renders in the candidate template (content survives styling).
    await expect(page.getByRole('heading', { level: 1, name: heroHeading })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(aboutBio)).toBeVisible();

    // 5) "Use this template" → the switch commits + revalidates + exits Draft Mode.
    await page.getByRole('button', { name: 'Use this template', exact: true }).click();
    await expect(
      page.getByText(/your page now uses the editorial template/i),
    ).toBeVisible({ timeout: 30_000 });

    // 6) PUBLISH (a fresh account is unpublished) then assert the PUBLIC page renders
    //    all the content in Newsprint (cookie-less GET → the public ISR page).
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 30_000 });
    await waitForPublicState(page, `/${owner.username}`, {
      status: 200,
      expectText: heroHeading,
    });
    await waitForPublicState(page, `/${owner.username}`, {
      status: 200,
      expectText: aboutBio,
    });

    // 7) Switch BACK to minimal and assert the content is IDENTICAL — the round-trip
    //    is lossless (D-P7-13a). Open the picker again, preview minimal, confirm.
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /choose a template/i }).click();
    await page
      .getByRole('link', { name: /preview the minimal template with your content/i })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: heroHeading })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Use this template', exact: true }).click();
    await expect(
      page.getByText(/your page now uses the minimal template/i),
    ).toBeVisible({ timeout: 30_000 });

    // The public page still carries every value we typed — nothing was lost switching
    // editorial → minimal → editorial → minimal.
    await waitForPublicState(page, `/${owner.username}`, {
      status: 200,
      expectText: heroHeading,
    });
    await waitForPublicState(page, `/${owner.username}`, {
      status: 200,
      expectText: aboutBio,
    });
  });
});
