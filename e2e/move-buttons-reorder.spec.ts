/**
 * D-10 (UX-04, 17-08) — the touch/keyboard REORDER FALLBACK: the chevron up/down
 * move buttons on each rail row. dnd-kit pointer drag (proven by
 * `keyboard-reorder.spec.ts`) stays for pointer devices; this spec proves the
 * NON-DRAG fallback that phone-only users rely on.
 *
 * WHAT IT PROVES (17-VALIDATION.md § Per-Requirement — D-10 reorder row):
 *   1. Pressing "Move {section} up/down" reorders the row within its group AND the
 *      new order SURVIVES a reload — i.e. it persisted through the SAME
 *      `reorderSectionsAction` → `reorder_sections` RPC the drag uses (the buttons
 *      ride the D-13-hardened `reorderByIds` commit).
 *   2. The reorder is OPTIMISTIC — the row moves instantly (asserted before the
 *      reload, which only confirms persistence).
 *   3. The up button is DISABLED on the group's first row and the down button on the
 *      last (`aria-disabled` + a no-op handler), and a move never crosses groups.
 *   4. The `aria-label`s ("Move {section} up/down") are present (the accessible name;
 *      the chevron glyph is aria-hidden).
 *
 * PUBLIC-PAGE NOTE (inherited from keyboard-reorder.spec.ts): the seeded `minimal`
 * template renders sections in a FIXED type order, so a reorder is observable in the
 * EDITOR RAIL + the persisted `sort_order` (re-read after a reload), not as a visual
 * change on the public page — exactly what D-10's reorder requirement needs.
 *
 * AUTH: a CONFIRMED owner bootstrapped with the real `initialize_portfolio` RPC (the
 * enriched D-P4-07 placeholder: visible sections Hero, About, Projects, Contact — all
 * SUPPORTED by `minimal`, so they share the "On your page" group). See
 * e2e/helpers/cms-auth.ts.
 *
 * Run command: `npx playwright test e2e/move-buttons-reorder.spec.ts`.
 */
import { expect, test } from '@playwright/test';

import {
  createConfirmedOwner,
  deleteOwner,
  signInAsOwner,
  type TestOwner,
} from './helpers/cms-auth';

/**
 * Read the visible section titles in DOM (rail) order. Each rail row (`<li>` in the
 * "Sections" aside) carries a selection button (`aria-pressed`, no aria-label) whose
 * text is the section title; the reorder handle + the move/eye/remove buttons are
 * SEPARATE buttons (each with an aria-label), so the `[aria-pressed]:not([aria-label])`
 * button per row gives the clean ordered title list. (Mirrors keyboard-reorder.spec.ts.)
 */
async function railOrder(page: import('@playwright/test').Page): Promise<string[]> {
  const rows = page.locator('aside[aria-label="Sections"] ul > li');
  const count = await rows.count();
  const order: string[] = [];
  for (let i = 0; i < count; i++) {
    const label = (
      await rows.nth(i).locator('button[aria-pressed]:not([aria-label])').innerText()
    ).trim();
    order.push(label);
  }
  return order;
}

test.describe('D-10 (UX-04) — chevron move-button section reorder (touch/keyboard fallback)', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('movebtn');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('Move down reorders within the group, persists across reload, and edges disable', async ({
    page,
  }) => {
    test.setTimeout(150_000);

    await signInAsOwner(page, owner);

    // The bootstrapped, visible "On your page" rail order (all minimal-supported).
    const before = await railOrder(page);
    expect(before.length).toBeGreaterThanOrEqual(2);
    const firstTitle = before[0]; // "Hero"
    const secondTitle = before[1]; // "About"
    const lastTitle = before[before.length - 1]; // "Contact"

    // a11y: the move-button aria-labels are present (the accessible name; the chevron
    // glyph is aria-hidden, so the button's name comes from the aria-label).
    await expect(
      page.getByRole('button', { name: `Move ${firstTitle} up` }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Move ${firstTitle} down` }),
    ).toBeVisible();

    // EDGE DISABLE: the FIRST row's "up" is disabled (aria-disabled) and the LAST
    // row's "down" is disabled — a move never escapes the group at its edges.
    await expect(
      page.getByRole('button', { name: `Move ${firstTitle} up` }),
    ).toHaveAttribute('aria-disabled', 'true');
    await expect(
      page.getByRole('button', { name: `Move ${lastTitle} down` }),
    ).toHaveAttribute('aria-disabled', 'true');
    // The first row's "down" is NOT disabled (it can move down into the group).
    await expect(
      page.getByRole('button', { name: `Move ${firstTitle} down` }),
    ).not.toHaveAttribute('aria-disabled', 'true');

    // OPTIMISTIC reorder: press "Move {first} down" → the row moves instantly, swapping
    // the first two rows [first, second, …] → [second, first, …].
    await page.getByRole('button', { name: `Move ${firstTitle} down` }).click();
    await expect
      .poll(async () => (await railOrder(page)).slice(0, 2).join(','), { timeout: 15_000 })
      .toBe(`${secondTitle},${firstTitle}`);

    // PERSISTENCE: reload — the order must survive (the buttons committed contiguous
    // sort_order through the same reorder_sections RPC the drag uses; the owner read
    // returns sections sort_order ASC).
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your portfolio' })).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(async () => (await railOrder(page)).slice(0, 2).join(','), { timeout: 15_000 })
      .toBe(`${secondTitle},${firstTitle}`);

    // ROUND-TRIP: press "Move {first} up" on the now-second row → it returns to the top,
    // proving the inverse direction also commits + persists.
    await page.getByRole('button', { name: `Move ${firstTitle} up` }).click();
    await expect
      .poll(async () => (await railOrder(page)).slice(0, 2).join(','), { timeout: 15_000 })
      .toBe(`${firstTitle},${secondTitle}`);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your portfolio' })).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(async () => (await railOrder(page)).slice(0, 2).join(','), { timeout: 15_000 })
      .toBe(`${firstTitle},${secondTitle}`);
  });
});
