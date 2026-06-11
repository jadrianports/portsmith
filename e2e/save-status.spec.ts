/**
 * Unified save-status vocabulary (UX-02 / D-04 / D-05 — 17-07) — the cross-cutting
 * Save Model contract: the TWO shipped save models read IDENTICALLY to the user.
 *
 *   - EXPLICIT model (hero/about/contact — `section-form.tsx` → `FormPanelHeader` +
 *     `SaveButton`): the user clicks Save; the status moves
 *     "Unsaved changes" → "Saving…" → "Saved — your page is live" (the beat).
 *   - AUTO-SAVE model (projects/experience/… — `item-card.tsx` `ItemManager`, plus
 *     skills/moodboard): a field-edit burst debounces into one save; BEFORE 17-07
 *     these forms showed only an error Alert — no unified status line, and the
 *     dopamine beat never fired here. 17-07 added the shared `SaveStatus` line +
 *     wired the hook's `onSavedAndLive`, so the SAME words now appear AND the
 *     "Saved — your page is live" beat fires in this model too.
 *
 * This spec proves both models surface the same vocabulary + the live beat, so a
 * non-technical user never perceives the difference (17-UI-SPEC § Save Model;
 * 17-VALIDATION.md UX-02 / D-04,05 row).
 *
 * AUTH + bootstrap: the SAME deterministic confirmed-owner cookie session the
 * Phase-4 CMS specs use (`createConfirmedOwner` → the real `initialize_portfolio`
 * RPC seeds the enriched D-P4-07 placeholder, incl. the 2 seeded `projects` items).
 * The spec creates its OWN owner (never the founder `/jadrianports` seed), so a
 * stale founder seed cannot affect it.
 *
 * Run command: `npx playwright test e2e/save-status.spec.ts`.
 */
import { expect, test } from '@playwright/test';

import {
  createConfirmedOwner,
  deleteOwner,
  signInAsOwner,
  type TestOwner,
} from './helpers/cms-auth';

test.describe('UX-02 / D-04,05 — both save models render the same vocabulary + the live beat', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('save');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('explicit (hero) AND auto-save (projects) read identically + both fire the beat', async ({
    page,
  }) => {
    // Cold Next 16 dev compile + the real auth/write/revalidate paths run here; give
    // generous headroom on Windows (mirrors cms-loop.spec.ts).
    test.setTimeout(180_000);

    // 1) Sign in → the editor mounts (populated, not blank).
    await signInAsOwner(page, owner);

    // ───────────────────────────────────────────────────────────────────────────
    // EXPLICIT SAVE MODEL — hero (the user clicks Save).
    // ───────────────────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Hero', exact: true }).click();

    const heroHeading = `Save Status Hero ${Date.now().toString(36)}`;
    const headingField = page.getByLabel('Heading', { exact: true });
    await expect(headingField).toBeVisible();
    await headingField.fill(heroHeading);

    // "Unsaved changes" (the FormPanelHeader dirty indicator) — the explicit model's
    // pending word.
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    // Click Save → "Saving…" (transient, the SaveButton) then the load-bearing beat.
    await page.getByRole('button', { name: 'Save changes' }).click();
    // The saved-&-live beat — the dopamine moment, the explicit model's payoff.
    await expect(page.getByText('Saved — your page is live')).toBeVisible({
      timeout: 30_000,
    });

    // ───────────────────────────────────────────────────────────────────────────
    // AUTO-SAVE MODEL — projects (a field-edit debounces; 17-07 brought the SAME
    // vocabulary + the beat to this model).
    // ───────────────────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Projects', exact: true }).click();

    // The Projects section is seeded with 2 placeholder item cards (migration 006);
    // expand the first one ("Your First Project") to reach its fields. The card
    // summary toggle is the EXACT-named button (the reorder handle + remove button
    // also carry the title in their aria-labels, so an exact match is required to
    // disambiguate — it has aria-expanded, the others do not).
    await page
      .getByRole('button', { name: 'Your First Project', exact: true })
      .click();

    // Edit the project Title — this routes through the debounced whole-section save
    // (Pitfall 7). Editing a seeded card also vanishes its ExampleChip (D-01), and
    // arms the unified SaveStatus line (D-04/D-05) in the auto-save model.
    const projectHeading = `Save Status Project ${Date.now().toString(36)}`;
    const titleField = page.getByLabel('Title', { exact: true });
    await expect(titleField).toBeVisible();
    await titleField.fill(projectHeading);

    // The unified SaveStatus line surfaces the SAME pending word "Unsaved changes"
    // in the auto-save model (it shows briefly while the ~500ms debounce is pending).
    await expect(page.getByText('Unsaved changes')).toBeVisible({ timeout: 10_000 });

    // The load-bearing proof: the saved-&-live beat fires in the AUTO-SAVE model too
    // (parity with the explicit model) once the debounced save resolves ok. This is
    // the D-04/D-05 guarantee — both models read identically, the beat included.
    await expect(page.getByText('Saved — your page is live')).toBeVisible({
      timeout: 30_000,
    });

    // After the ~2.2s beat settles, the auto-save line relaxes to the resting "Saved"
    // (the same resting word the explicit model uses) — confirming the full shared
    // vocabulary, not just the beat.
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 30_000 });
  });
});
