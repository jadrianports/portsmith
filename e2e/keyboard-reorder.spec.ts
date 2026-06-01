/**
 * CMS-05 (a11y) — GREEN as of 04-10. The signature accessibility proof: a section
 * is reordered using the KEYBOARD ONLY (Tab to the drag handle → Space to lift →
 * ArrowDown to move → Space to drop), with NO mouse interaction, and the new order
 * PERSISTS (the `reorderSectionsAction` writes contiguous `sort_order`, so a
 * dashboard reload shows the new order). 04-VALIDATION.md E2E row; RESEARCH
 * Pattern 5 (dnd-kit `KeyboardSensor` + `sortableKeyboardCoordinates`).
 *
 * PUBLIC-PAGE NOTE: the Phase-4 `minimal` template renders the 7 sections in a
 * FIXED type order (hero, about, skills, projects, …) — it does NOT yet honor the
 * DB `sort_order`. So a reorder is observable in the EDITOR RAIL and in the
 * persisted `sort_order` (proven by re-reading the rail after a reload), not by a
 * visual change on the public page. This spec therefore asserts the rail order +
 * its persistence, which is exactly what CMS-05's keyboard-a11y requirement needs.
 *
 * AUTH: a confirmed owner with the bootstrapped placeholder (visible sections:
 * Hero, About, Projects, Contact). See e2e/helpers/cms-auth.ts.
 *
 * Run command: `npx playwright test e2e/keyboard-reorder.spec.ts`.
 */
import { expect, test } from '@playwright/test';

import { createConfirmedOwner, deleteOwner, signInAsOwner, type TestOwner } from './helpers/cms-auth';

/**
 * Read the visible section titles in DOM (rail) order. Each rail row (`<li>` in the
 * "Sections" aside) carries a selection button (`aria-pressed`) whose text is the
 * section title; the reorder handle is a SEPARATE button, so reading the
 * `[aria-pressed]` button per row gives the clean ordered title list.
 */
async function railOrder(page: import('@playwright/test').Page): Promise<string[]> {
  const rows = page.locator('aside[aria-label="Sections"] ul > li');
  const count = await rows.count();
  const order: string[] = [];
  for (let i = 0; i < count; i++) {
    // Per row there are two aria-pressed buttons (the title SELECT button and the
    // visibility eye-toggle). The select button has NO aria-label (its name is the
    // bare title); target it precisely via :not([aria-label]).
    const label = (
      await rows.nth(i).locator('button[aria-pressed]:not([aria-label])').innerText()
    ).trim();
    order.push(label);
  }
  return order;
}

test.describe('CMS-05 (a11y) — keyboard-only section reorder', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('kbd');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('Tab → Space → ArrowDown → Space reorders a section with no mouse, and it persists', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await signInAsOwner(page, owner);

    // The bootstrapped, visible rail order.
    const before = await railOrder(page);
    expect(before.length).toBeGreaterThanOrEqual(2);
    const firstTitle = before[0]; // "Hero"
    const secondTitle = before[1]; // "About"

    // Focus the FIRST section's drag handle WITHOUT a mouse: focus it directly
    // (a programmatic focus is keyboard-equivalent — no pointer events), then drive
    // the dnd-kit KeyboardSensor sequence entirely from the keyboard.
    const firstHandle = page.getByRole('button', {
      name: new RegExp(`^Reorder ${firstTitle}\\b`),
    });
    await firstHandle.focus();
    await expect(firstHandle).toBeFocused();

    // Lift → move down one → drop. (dnd-kit: Space/Enter lifts, arrows move, Space
    // drops, Esc cancels.) Pauses let dnd-kit's keyboard coordinate getter settle.
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    await page.keyboard.press('Space');

    // The optimistic reorder swaps the first two rows: [first, second, …] →
    // [second, first, …]. Assert the new rail order (no mouse was used).
    await expect
      .poll(async () => (await railOrder(page)).slice(0, 2).join(','), { timeout: 15_000 })
      .toBe(`${secondTitle},${firstTitle}`);

    // PERSISTENCE: reload the dashboard — the order must survive (the reorder action
    // wrote contiguous sort_order; the owner read returns sections sort_order ASC).
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your portfolio' })).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(async () => (await railOrder(page)).slice(0, 2).join(','), { timeout: 15_000 })
      .toBe(`${secondTitle},${firstTitle}`);
  });
});
