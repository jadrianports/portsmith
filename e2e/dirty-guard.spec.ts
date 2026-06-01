/**
 * CMS-07 — GREEN as of 04-10. The unsaved-changes dirty-state guard (04-UI-SPEC
 * §14; App Router dirty guard, RESEARCH Pitfall 5):
 *   - editing a section field marks the panel dirty (the "● Unsaved changes"
 *     indicator appears);
 *   - a `beforeunload` listener is ARMED while dirty (tab close / hard nav fallback)
 *     and removed once clean;
 *   - an IN-APP navigation away while dirty opens the focus-trapped
 *     "You have unsaved changes" dialog (Save and continue / Discard / Keep editing),
 *     and "Keep editing" CANCELS the navigation (App Router has no router-blocking
 *     API — the nav is intercepted at the click source and simply doesn't happen
 *     until the user resolves the dialog).
 *
 * VIEWPORT NOTE (load-bearing): in the assembled editor (04-09) a rail row click
 * selects UNGUARDED (cheap re-selection); the guarded in-app navigation source is
 * the "Back to sections" control, which is part of the responsive master-detail and
 * is only rendered BELOW the `lg` breakpoint (≥1024px hides it). So this spec runs
 * at a < lg viewport (where Back-to-sections is the real guarded nav source) to
 * exercise the in-app dialog.
 *
 * Run command: `npx playwright test e2e/dirty-guard.spec.ts`.
 */
import { expect, test } from '@playwright/test';

import { createConfirmedOwner, deleteOwner, signInAsOwner, type TestOwner } from './helpers/cms-auth';

/** Dispatch a cancelable `beforeunload` and report whether a handler preventDefaulted it. */
async function beforeUnloadArmed(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => {
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });
}

test.describe('CMS-07 — dirty-state guard', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('dirty');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('dirty arms beforeunload + the in-app dialog blocks navigation; Keep editing cancels', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // < lg so the responsive master-detail (with the guarded "Back to sections"
    // control) is active.
    await page.setViewportSize({ width: 800, height: 900 });

    await signInAsOwner(page, owner);

    // Clean state: no beforeunload handler should fire yet.
    expect(await beforeUnloadArmed(page)).toBe(false);

    // Select Hero into the panel (on < lg this swaps the rail for the panel).
    await page.getByRole('button', { name: 'Hero', exact: true }).click();
    const headingField = page.getByLabel('Heading', { exact: true });
    await expect(headingField).toBeVisible();

    // Type WITHOUT saving → the panel is dirty.
    await headingField.fill(`Dirty edit ${Date.now().toString(36)}`);

    // The "● Unsaved changes" indicator appears (color-independent: dot + word).
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    // PATH 2: the beforeunload listener is now ARMED while dirty.
    await expect.poll(() => beforeUnloadArmed(page), { timeout: 5_000 }).toBe(true);

    // PATH 1: attempt an in-app navigation (Back to sections) → the guarded dialog
    // appears and BLOCKS the navigation until resolved.
    await page.getByRole('button', { name: 'Back to sections' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'You have unsaved changes' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save and continue' })).toBeVisible();
    await expect(dialog.getByText('Discard changes')).toBeVisible();

    // "Keep editing" CANCELS the navigation: the dialog closes and we are STILL on
    // the Hero panel (the heading field is still shown, still dirty).
    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(dialog).toBeHidden();
    await expect(headingField).toBeVisible();
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    // And beforeunload is still armed (we are still dirty).
    expect(await beforeUnloadArmed(page)).toBe(true);
  });
});
