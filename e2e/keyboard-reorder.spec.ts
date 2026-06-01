/**
 * CMS-05 (a11y) — turned GREEN by 04-05 (dnd-kit keyboard-accessible reorder).
 * 04-VALIDATION.md E2E row.
 *
 * Wave-0 RED scaffold (04-01). INTENTIONALLY not-yet-passing: the section-list
 * editor with the dnd-kit sortable + KeyboardSensor does not exist until 04-05.
 * Registered with `test.fixme` so it appears PENDING (RED — not a vacuous pass).
 * 04-05 removes `.fixme` and fills the body to turn it GREEN.
 *
 * Behavior the GREEN version proves (WCAG mouse-free reorder, RESEARCH Pattern 5):
 *   Tab to a section's drag handle -> Space/Enter to lift -> ArrowDown to move ->
 *   Space/Enter to drop -> the section order changes (and persists contiguous
 *   sort_order via the reorder action). dnd-kit's `sortableKeyboardCoordinates`
 *   + `KeyboardSensor` provide the keyboard story; the spec asserts the reordered
 *   DOM order after the keystroke sequence.
 *
 * Run command (04-VALIDATION.md): `npx playwright test e2e/keyboard-reorder.spec.ts`.
 */
import { expect, test } from '@playwright/test';

test.fixme(
  'CMS-05 — keyboard reorder (Tab -> Space -> ArrowDown -> Space) reorders a section',
  async ({ page }) => {
    // 04-05 fills this in. Sketch:
    //   await signInAsTestOwner(page);
    //   await page.goto('/dashboard');
    //   const handle = page.getByRole('button', { name: /reorder/i }).first();
    //   await handle.focus();
    //   await page.keyboard.press('Space');      // lift
    //   await page.keyboard.press('ArrowDown');   // move down one
    //   await page.keyboard.press('Space');      // drop
    //   ... assert the section-list order changed ...
    await expect(page).toHaveURL(/\/dashboard/);
  },
);
