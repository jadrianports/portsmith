/**
 * WR-02 — the Profile / Identity editor is REACHABLE and wired to saveProfileAction
 * (CMS-02 / D-P4-05). saveProfileAction was fully built + integration-tested
 * (tests/integration/cms/profile-write.test.ts) but had NO user-reachable caller
 * before WR-02; EditorShell now renders a "Profile" rail entry that routes the
 * panel to the ProfileForm.
 *
 * What this spec asserts against the REAL editor (a fresh confirmed owner):
 *   - the "Profile" rail entry exists and selecting it opens the profile panel with
 *     the four editable fields (Display name / Headline / Avatar URL / Résumé URL);
 *   - editing a field marks the panel dirty and Save persists it (the action runs —
 *     the saved-&-live beat fires), proving CMS-02 is reachable end-to-end;
 *   - the saved value survives a reload (it was actually written to the DB).
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

    // The profile panel opens with the four editable fields.
    const displayName = page.getByLabel('Display name', { exact: true });
    const headline = page.getByLabel('Headline', { exact: true });
    await expect(displayName).toBeVisible();
    await expect(headline).toBeVisible();
    await expect(page.getByLabel('Avatar URL', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Résumé URL', { exact: true })).toBeVisible();

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

  test('a javascript:-scheme avatar URL is rejected at the server gate (no save)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 800, height: 1000 });

    await signInAsOwner(page, owner);
    await page.getByRole('button', { name: /^Profile/ }).click();

    const displayName = page.getByLabel('Display name', { exact: true });
    await expect(displayName).toBeVisible();
    // Keep a valid display name (required) so only the avatar scheme is the failure.
    await displayName.fill('Valid Name');
    const avatar = page.getByLabel('Avatar URL', { exact: true });
    await avatar.fill('javascript:alert(1)');
    // Blur to trigger the inline client check + mark dirty.
    await avatar.blur();
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    // Attempt to save → the saved-&-live beat must NOT appear (the server Zod gate
    // rejects the dangerous scheme; the field shows an error and stays dirty).
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved — your page is live')).toBeHidden();
    // Still dirty (the save did not succeed).
    await expect(page.getByText('Unsaved changes')).toBeVisible();
  });
});
