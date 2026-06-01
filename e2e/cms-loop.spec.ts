/**
 * CMS-06 (the loop) — turned GREEN by 04-10 (full edit -> save -> preview ->
 * publish -> 404 loop). 04-VALIDATION.md E2E row.
 *
 * Wave-0 RED scaffold (04-01). This spec is INTENTIONALLY not-yet-passing: the
 * dashboard editor, the save action, the Draft Mode preview, and the publish
 * toggle do not exist until Waves 1-3. It is registered with `test.fixme` so it
 * appears in the suite as PENDING (RED — not a vacuous pass, and it does not boot
 * the dev server in CI for an unbuilt feature). 04-10 removes `.fixme` and fills
 * the body to turn it GREEN.
 *
 * Behavior the GREEN version proves (the whole Phase-4 promise, end to end):
 *   1. sign in -> dashboard -> edit a section field -> Save;
 *   2. the saved change appears on the public /[username] page within seconds
 *      (on-demand revalidatePath);
 *   3. Preview (Draft Mode) shows the owner's last-saved state with the banner;
 *   4. Publish -> the page is live; Unpublish -> the public page 404s.
 *
 * Run command (04-VALIDATION.md): `npx playwright test e2e/cms-loop.spec.ts`.
 */
import { expect, test } from '@playwright/test';

test.fixme(
  'CMS-06 — edit -> Save -> public page fresh -> publish/unpublish flips live/404',
  async ({ page }) => {
    // 04-10 fills this in. Sketch of the asserted loop:
    //   await signInAsTestOwner(page);
    //   await page.goto('/dashboard');
    //   ... edit a hero field, click Save, await the "Saved — your page is live" beat ...
    //   await page.goto('/' + username);
    //   await expect(page.getByText(EDITED_TEXT)).toBeVisible();
    //   ... Preview (Draft Mode) shows the banner; Publish -> live; Unpublish -> 404 ...
    await expect(page).toHaveURL(/\/dashboard/);
  },
);
