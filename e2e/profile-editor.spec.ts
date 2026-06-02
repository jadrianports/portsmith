/**
 * WR-02 — the Profile / Identity editor is REACHABLE and wired to saveProfileAction
 * (CMS-02 / D-P4-05). saveProfileAction was fully built + integration-tested
 * (tests/integration/cms/profile-write.test.ts) but had NO user-reachable caller
 * before WR-02; EditorShell now renders a "Profile" rail entry that routes the
 * panel to the ProfileForm.
 *
 * PHASE-5 UI CONTRACT UPDATE (D-07, Plan 05-02): the avatar + résumé URL TEXT
 * fields were REPLACED by upload-only surfaces — the avatar is now the
 * `ImageUploader` (pick → crop → WebP) and the résumé is the `ResumeUploader`
 * (PDF upload). There is no longer an "Avatar URL" / "Résumé URL" text input to
 * paste into. This spec was updated by Plan 05-05 (the phase gate) to assert the
 * CURRENT upload-only contract instead of the removed URL fields — the stale URL
 * assertions were a cross-plan integration break the gate surfaced.
 *
 * What this spec asserts against the REAL editor (a fresh confirmed owner):
 *   - the "Profile" rail entry exists and selecting it opens the profile panel with
 *     the editable text fields (Display name / Headline) AND the upload surfaces
 *     (the Avatar image dropzone + the Résumé PDF dropzone — no URL paste field);
 *   - editing a field marks the panel dirty and Save persists it (the action runs —
 *     the saved-&-live beat fires), proving CMS-02 is reachable end-to-end;
 *   - the saved value survives a reload (it was actually written to the DB);
 *   - the dangerous-scheme paste vector is STRUCTURALLY ELIMINATED — there is no
 *     avatar/résumé URL text input to paste a `javascript:`-scheme string into
 *     (D-07 upload-only; the server Zod scheme gate remains covered by the
 *     profile-write integration test as defense-in-depth).
 *
 * Run command: `npx playwright test e2e/profile-editor.spec.ts`.
 */
import { expect, test } from '@playwright/test';

import { createConfirmedOwner, deleteOwner, signInAsOwner, type TestOwner } from './helpers/cms-auth';

test.describe('WR-02 — profile editor reachable + wired to saveProfileAction', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('prof');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('select Profile → edit display name + headline → Save persists', async ({ page }) => {
    test.setTimeout(120_000);

    // < lg so selecting the Profile entry swaps the rail for the panel (the panel is
    // the surface we assert on).
    await page.setViewportSize({ width: 800, height: 1000 });

    await signInAsOwner(page, owner);

    // The Profile rail entry is present (the WR-02 caller) and selectable.
    const profileEntry = page.getByRole('button', { name: /^Profile/ });
    await expect(profileEntry).toBeVisible();
    await profileEntry.click();

    // The profile panel opens with the editable text fields + the upload surfaces.
    const displayName = page.getByLabel('Display name', { exact: true });
    const headline = page.getByLabel('Headline', { exact: true });
    await expect(displayName).toBeVisible();
    await expect(headline).toBeVisible();
    // D-07 (Plan 05-02): avatar + résumé are now upload-only surfaces, NOT URL text
    // fields. Assert the upload dropzones are present (the empty-state CTAs).
    await expect(page.getByRole('button', { name: 'Upload a photo' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Upload your résumé (PDF)' }),
    ).toBeVisible();
    // And the removed URL paste fields are GONE (the structural security improvement).
    await expect(page.getByLabel('Avatar URL', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Résumé URL', { exact: true })).toHaveCount(0);

    // Edit display name + headline → the panel goes dirty.
    const newName = `Profile Name ${Date.now().toString(36)}`;
    const newHeadline = `Headline ${Date.now().toString(36)}`;
    await displayName.fill(newName);
    await headline.fill(newHeadline);
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    // Save (NOT optimistic) → "Saving…" until saveProfileAction resolves, then the
    // load-bearing saved-&-live beat — the proof CMS-02 is reachable end-to-end.
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved — your page is live')).toBeVisible({ timeout: 30_000 });

    // Persistence: RELOAD (re-fetches the owner read) and re-open Profile — the
    // saved values are THERE (saveProfileAction actually wrote the row).
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your portfolio' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: /^Profile/ }).click();
    await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(newName);
    await expect(page.getByLabel('Headline', { exact: true })).toHaveValue(newHeadline);
  });

  test('the dangerous-scheme avatar-URL paste vector is structurally eliminated (D-07)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 800, height: 1000 });

    await signInAsOwner(page, owner);
    await page.getByRole('button', { name: /^Profile/ }).click();

    const displayName = page.getByLabel('Display name', { exact: true });
    await expect(displayName).toBeVisible();

    // D-07 (Plan 05-02): there is NO avatar/résumé URL text input anymore — the
    // avatar is upload-only via the ImageUploader. So a `javascript:`-scheme string
    // can no longer be PASTED in at all: the vector this test once exercised is
    // structurally gone. Assert there is no avatar-URL textbox to type a scheme into.
    await expect(page.getByLabel('Avatar URL', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Upload a photo' })).toBeVisible();

    // The form is still fully functional without the URL field: a plain display-name
    // edit marks dirty and saves (proves the upload-only ProfileForm still persists,
    // and the server Zod scheme gate on avatar_url is covered by the
    // profile-write integration test as defense-in-depth).
    await displayName.fill('Valid Name');
    await expect(page.getByText('Unsaved changes')).toBeVisible();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved — your page is live')).toBeVisible({ timeout: 30_000 });
  });
});
