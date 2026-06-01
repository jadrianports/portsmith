/**
 * CMS-07 — turned GREEN by 04-09 (unsaved-changes dirty-state guard).
 * 04-VALIDATION.md E2E row.
 *
 * Wave-0 RED scaffold (04-01). INTENTIONALLY not-yet-passing: the editor, its
 * Zustand `dirty` flag wiring, the in-app "Save / Discard / Keep editing" dialog,
 * and the `beforeunload` arming do not exist until 04-09. Registered with
 * `test.fixme` so it appears PENDING (RED — not a vacuous pass). 04-09 removes
 * `.fixme` and fills the body to turn it GREEN.
 *
 * Behavior the GREEN version proves (App Router dirty guard, RESEARCH Pitfall 5):
 *   - editing a field arms the guard (Zustand `dirty` = true);
 *   - an in-app navigation away while dirty shows the custom dialog (intercepted
 *     at the click source — App Router has no router-blocking API);
 *   - `beforeunload` is armed while dirty (tab close / hard nav fallback) and
 *     removed once clean.
 *
 * Run command (04-VALIDATION.md): `npx playwright test e2e/dirty-guard.spec.ts`.
 */
import { expect, test } from '@playwright/test';

test.fixme(
  'CMS-07 — dirty guard: beforeunload armed when dirty; in-app dialog blocks nav',
  async ({ page }) => {
    // 04-09 fills this in. Sketch:
    //   await signInAsTestOwner(page);
    //   await page.goto('/dashboard');
    //   ... type into a section field (sets dirty) ...
    //   ... assert window has a beforeunload handler armed ...
    //   ... click an in-app link -> the "unsaved changes" dialog appears and blocks nav ...
    //   ... Save (or Discard) -> dialog clears, beforeunload removed ...
    await expect(page).toHaveURL(/\/dashboard/);
  },
);
