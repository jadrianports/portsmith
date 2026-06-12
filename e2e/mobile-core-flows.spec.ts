/**
 * D-10 (UX-04, 17-08) — MOBILE CORE FLOWS: "usable on a phone" must GUARANTEE that
 * edit / save / publish / section-navigation are rock-solid at a phone viewport, in
 * the SHIPPED master-detail layout (this is an audit-and-fix of the existing
 * responsive classes — no new breakpoint).
 *
 * WHAT IT PROVES (17-VALIDATION.md § Per-Requirement — D-10 core flows; 17-UI-SPEC
 * Surface 8 + § Responsive Behavior):
 *   - At a 390px viewport (iPhone-class), the master-detail holds: the rail is the
 *     landing view; selecting a section SWAPS to the full-width form panel with a
 *     "Back to sections" control; Save (explicit model) is reachable; Publish is
 *     reachable; "Back to sections" returns to the rail.
 *   - Inputs are 16px Body (no iOS zoom-on-focus) — asserted on the Hero heading input.
 *   - The core-flow touch targets are ≥44px (the inherited rule) and not clipped: the
 *     "Back to sections" control + the Save button report a ≥44px box and lie within
 *     the viewport width (no horizontal overflow off-screen).
 *
 * This is the phone half of the D-10 audit; the desktop two-pane is unchanged and the
 * move-button reorder is proven by `move-buttons-reorder.spec.ts`.
 *
 * AUTH: a CONFIRMED owner bootstrapped with the real `initialize_portfolio` RPC (the
 * same deterministic cookie session the other CMS specs use). See cms-auth.ts.
 *
 * Run command: `npx playwright test e2e/mobile-core-flows.spec.ts`.
 */
import { expect, test } from '@playwright/test';

import {
  createConfirmedOwner,
  deleteOwner,
  signInAsOwner,
  type TestOwner,
} from './helpers/cms-auth';

/** iPhone-class portrait viewport (≈ iPhone 12/13/14). The D-10 < 640px master-detail. */
const PHONE_VIEWPORT = { width: 390, height: 844 };

test.describe('D-10 (UX-04) — mobile core flows at a 390px viewport', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('mobile');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('select → edit → save → publish → back-to-sections are reachable + uncramped at 390px', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // Drive the editor as a phone BEFORE sign-in so the first render is the mobile
    // master-detail (the rail is the landing view at < 640px).
    await page.setViewportSize(PHONE_VIEWPORT);

    await signInAsOwner(page, owner);

    // The rail (the mobile landing view) shows the bootstrapped sections. Pick Hero —
    // selecting a section swaps the rail for the full-width form panel (master-detail).
    await page.getByRole('button', { name: 'Hero', exact: true }).click();

    // The "Back to sections" control appears in the form panel on mobile (lg:hidden on
    // desktop). It is the master-detail's return affordance.
    const backToSections = page.getByRole('button', { name: 'Back to sections' });
    await expect(backToSections).toBeVisible();

    // EDIT: the Hero heading input is reachable + is 16px Body (no iOS zoom-on-focus).
    const headingField = page.getByLabel('Heading', { exact: true });
    await expect(headingField).toBeVisible();
    const fontSizePx = await headingField.evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize),
    );
    // 16px is the iOS no-zoom floor — assert the input is AT LEAST 16px.
    expect(fontSizePx).toBeGreaterThanOrEqual(16);

    const editedHeading = `Mobile Heading ${Date.now().toString(36)}`;
    await headingField.fill(editedHeading);
    await expect(page.getByText('Unsaved changes')).toBeVisible();

    // SAVE (explicit model) is reachable in the sticky FormPanelHeader; the box is
    // ≥44px tall and sits within the 390px viewport (not clipped off-screen).
    const saveButton = page.getByRole('button', { name: 'Save changes' });
    await expect(saveButton).toBeVisible();
    const saveBox = await saveButton.boundingBox();
    expect(saveBox, 'Save button has a layout box').not.toBeNull();
    expect(saveBox!.height).toBeGreaterThanOrEqual(44);
    expect(saveBox!.x).toBeGreaterThanOrEqual(0);
    expect(saveBox!.x + saveBox!.width).toBeLessThanOrEqual(PHONE_VIEWPORT.width + 1);

    await saveButton.click();
    await expect(page.getByText('Saved — your page is live')).toBeVisible({
      timeout: 30_000,
    });

    // "Back to sections" is a ≥44px, on-screen touch target — return to the rail.
    const backBox = await backToSections.boundingBox();
    expect(backBox, 'Back-to-sections has a layout box').not.toBeNull();
    expect(backBox!.height).toBeGreaterThanOrEqual(44);
    expect(backBox!.x).toBeGreaterThanOrEqual(0);
    expect(backBox!.x + backBox!.width).toBeLessThanOrEqual(PHONE_VIEWPORT.width + 1);
    await backToSections.click();

    // Back on the rail: the section list is the landing view again (Hero visible).
    await expect(page.getByRole('button', { name: 'Hero', exact: true })).toBeVisible();

    // PUBLISH is reachable from the mobile header (the controls wrap without clipping).
    const publishButton = page.getByRole('button', { name: 'Publish', exact: true });
    await expect(publishButton).toBeVisible();
    const publishBox = await publishButton.boundingBox();
    expect(publishBox, 'Publish button has a layout box').not.toBeNull();
    expect(publishBox!.height).toBeGreaterThanOrEqual(44);
    expect(publishBox!.x).toBeGreaterThanOrEqual(0);
    expect(publishBox!.x + publishBox!.width).toBeLessThanOrEqual(PHONE_VIEWPORT.width + 1);

    await publishButton.click();
    await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 30_000 });

    // No horizontal page overflow at 390px (the layout fits the phone viewport — the
    // core-flow controls never push the document wider than the screen).
    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(docWidth).toBeLessThanOrEqual(PHONE_VIEWPORT.width + 1);
  });
});
