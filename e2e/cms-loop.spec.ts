/**
 * CMS-06 (the loop) — GREEN as of 04-10. The full Phase-4 promise end-to-end:
 * edit a section → Save → the change is reflected (Preview while unpublished, then
 * the live public page once Published) → Publish makes the public page live (200) →
 * Unpublish 404s it. 04-VALIDATION.md E2E row.
 *
 * AUTH: a CONFIRMED owner is created via the admin API and bootstrapped with the
 * real `initialize_portfolio` RPC (the enriched D-P4-07 placeholder), then signed
 * into the BROWSER through the real `/login` form (no Turnstile on login — fast &
 * deterministic). See e2e/helpers/cms-auth.ts; the Phase-2 auth-signup.spec.ts
 * still proves the full signup→Mailpit→dashboard funnel separately.
 *
 * CONTENT-INDEPENDENCE: the spec asserts on a UNIQUE value IT TYPES into the Hero
 * heading (the minimal template renders `hero.content.heading` as the page <h1>),
 * never on seeded placeholder copy — so a regression in the save/revalidate chain
 * is what fails the test, not a content edit elsewhere.
 *
 * ORDER NOTE: a fresh account is UNPUBLISHED, so the public `/[username]` 404s
 * until Publish. We therefore prove "edit → Save reflected" via PREVIEW (Draft
 * Mode, which renders the owner's unpublished last-saved content) FIRST, then prove
 * Publish→live (the same edited value now on the public page) and Unpublish→404.
 * This covers every truth in the plan: edit→Save, the page fresh, Preview, Publish
 * live, Unpublish 404.
 *
 * Run command: `npx playwright test e2e/cms-loop.spec.ts`.
 */
import { expect, test } from '@playwright/test';

import {
  createConfirmedOwner,
  deleteOwner,
  signInAsOwner,
  waitForPublicState,
  type TestOwner,
} from './helpers/cms-auth';

test.describe('CMS-06 — the full edit → save → preview → publish → 404 loop', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('loop');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('edit → Save (preview fresh) → Publish (live) → Unpublish (404)', async ({ page }) => {
    // Cold Next 16 dev compiles + the real auth + write + revalidate paths run
    // here; give generous headroom on Windows.
    test.setTimeout(150_000);

    // A unique value we type into the Hero heading — the loop's content-independent
    // assertion target (rendered as the public/preview <h1>).
    const editedHeading = `Loop Heading ${Date.now().toString(36)}`;

    // 1) Sign in → the editor mounts (populated, not blank).
    await signInAsOwner(page, owner);

    // The rail shows the visible bootstrapped sections; pick Hero.
    await page.getByRole('button', { name: 'Hero', exact: true }).click();

    // 2) Edit the Hero heading + Save. The save is NOT optimistic: the button shows
    //    "Saving…" until the action resolves, then the load-bearing
    //    "Saved — your page is live" beat appears (only after the revalidate fires).
    const headingField = page.getByLabel('Heading', { exact: true });
    await expect(headingField).toBeVisible();
    await headingField.fill(editedHeading);

    // The dirty indicator appears once the panel is dirty.
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved — your page is live')).toBeVisible({ timeout: 30_000 });

    // 3) PREVIEW (Draft Mode) — the unpublished, last-saved content renders with the
    //    banner and carries the value we just typed (proves edit→Save reflected even
    //    before publish). The Preview link is prefetch={false} → /api/preview/enable
    //    → redirect to the owner's own slug with the draft cookie set.
    await page.getByRole('link', { name: 'Preview' }).click();
    await expect(page).toHaveURL(new RegExp(`/${owner.username}(\\b|/|\\?|$)`), {
      timeout: 30_000,
    });
    // The PreviewBanner is the one chrome element over the template surface.
    await expect(page.getByText('Draft preview', { exact: false })).toBeVisible({
      timeout: 30_000,
    });
    // The edited heading is rendered as the template <h1> in the preview.
    await expect(
      page.getByRole('heading', { level: 1, name: editedHeading }),
    ).toBeVisible({ timeout: 30_000 });

    // Exit preview (the disable route) → back to /dashboard.
    await page.getByRole('link', { name: /exit preview/i }).click();
    await expect(page).toHaveURL(/\/dashboard(\/|\?|$)/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Your portfolio' })).toBeVisible();

    // 4) Before publish, the PUBLIC page 404s (unpublished). (Cookie-less GET.)
    await waitForPublicState(page, `/${owner.username}`, { status: 404 });

    // 5) PUBLISH (frictionless, no confirm). The status flips to Live and the
    //    public page goes live (200) carrying the edited heading.
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 30_000 });

    await waitForPublicState(page, `/${owner.username}`, {
      status: 200,
      expectText: editedHeading,
    });

    // 6) UNPUBLISH (requires the confirm dialog; the safe default is "Keep it live").
    //    Confirm with the destructive "Unpublish" → the public page 404s.
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Unpublish your page?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Unpublish', exact: true }).click();

    await expect(page.getByText('Draft', { exact: true })).toBeVisible({ timeout: 30_000 });
    await waitForPublicState(page, `/${owner.username}`, { status: 404 });
  });
});
