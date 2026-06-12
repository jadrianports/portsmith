/**
 * D-06 (UX-02, 17-08) — the OUT-OF-ORDER SAVE GUARD, end-to-end against the REAL
 * `saveSectionAction` through REAL auth cookies (the e2e half; the fast node-unit
 * half is Plan 01's `debounced-save.test.ts` mock-saver seam).
 *
 * WHAT IT PROVES (17-VALIDATION.md § Per-Requirement — D-06 row; § Correctness
 * Guarantees — "D-06 must be e2e: real auth cookies; the node project can't supply
 * them"): the shipped `seqRef` / `isLatestSeq` guard in `useDebouncedSectionSave`
 * holds against the real Server Action — a slow EARLIER flush resolving AFTER a
 * faster LATER one never drives the visible saved/error state (no stale "Saved", no
 * stale error for a fast typer), and the LATER value is the one that persists.
 *
 * HOW THE OUT-OF-ORDER ORDERING IS FORCED (deterministic, real action): the auto-save
 * model (projects `ItemManager`) flushes a debounced whole-section `saveSectionAction`
 * — a Next Server Action POST carrying the `next-action` request header. This spec
 * intercepts those POSTs via `page.route` and STALLS the FIRST flush's response while
 * letting the SECOND flush resolve immediately. The guard must DROP the stale first
 * resolution when it finally lands, so:
 *   1. after the fast second flush resolves → the status reads "Saved" (the second,
 *      latest value);
 *   2. when the stalled first flush is released LAST (out of order) → the status does
 *      NOT revert to a stale "Saved — your page is live"/error beat, AND
 *   3. the persisted value (after a reload) is the SECOND edit's value, not the first.
 *
 * AUTH: a CONFIRMED owner bootstrapped with the real `initialize_portfolio` RPC (the
 * Projects section is seeded with 2 placeholder item cards). See cms-auth.ts.
 *
 * Run command: `npx playwright test e2e/out-of-order-save.spec.ts`.
 */
import { expect, test } from '@playwright/test';

import {
  createConfirmedOwner,
  deleteOwner,
  signInAsOwner,
  type TestOwner,
} from './helpers/cms-auth';

/** Whether a request is a Next Server Action POST (the saveSectionAction flush). */
function isServerActionPost(request: import('@playwright/test').Request): boolean {
  if (request.method() !== 'POST') return false;
  const headers = request.headers();
  // Next 16 Server Actions carry a `next-action` (or `next-router-state-tree`) header.
  return 'next-action' in headers || 'next-router-state-tree' in headers;
}

test.describe('D-06 (UX-02) — out-of-order save guard against the real saveSectionAction', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('outoforder');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('a slow earlier flush resolving after a faster later one never shows a stale Saved', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // A TALL desktop viewport so the whole rail (Profile/Template/Blog + the "On your
    // page" group + checklist + storage meter) fits above the fold — the Projects row
    // is otherwise below a default 720px-tall viewport's fold, and the editor's window-
    // scroll + the row's `truncate` make a scroll-into-view click flaky. This spec tests
    // the save-status GUARD, not layout, so a tall viewport is the right harness.
    await page.setViewportSize({ width: 1280, height: 1600 });

    await signInAsOwner(page, owner);

    // Open Projects (the auto-save model) → expand the first seeded card to reach its
    // Title field (the field-edit that debounces into a whole-section save). The row's
    // title-SELECT button is `flex-1 truncate`; with the rail's fixed controls it can be
    // narrow, so click the row's TITLE TEXT (the visible <span> inside the select button)
    // — a stable, always-painted target that activates the same select handler.
    await page
      .locator('aside[aria-label="Sections"] ul > li', { hasText: 'Projects' })
      .first()
      .getByText('Projects', { exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Your First Project', exact: true })
      .click();
    const titleField = page.getByLabel('Title', { exact: true });
    await expect(titleField).toBeVisible();

    // The two distinct values: the FIRST (slow) flush carries `firstValue`; the SECOND
    // (fast) flush carries `secondValue`. The guard must let the SECOND win.
    const stamp = Date.now().toString(36);
    const firstValue = `OOO First ${stamp}`;
    const secondValue = `OOO Second ${stamp}`;

    // Intercept the Server Action POSTs. Hold the FIRST flush's response in a pending
    // promise; let the SECOND (and any later) flush proceed immediately. Release the
    // first LAST to create the out-of-order resolution.
    let firstActionSeen = false;
    // Typed resolver — declared as a definite `() => void` (initialized to a no-op so
    // TS never narrows it to `never`); the Promise executor overwrites it synchronously.
    let releaseFirst: () => void = () => {};
    const firstReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    await page.route('**/*', async (route, request) => {
      if (!isServerActionPost(request)) {
        await route.continue();
        return;
      }
      if (!firstActionSeen) {
        // The FIRST flush — stall it until we explicitly release it (after the second).
        firstActionSeen = true;
        await firstReleased;
        await route.continue();
        return;
      }
      // The SECOND (and any subsequent) flush — let it resolve immediately/fast.
      await route.continue();
    });

    // FLUSH 1 (slow): type the first value, then wait past the ~500ms debounce so this
    // edit dispatches its own flush (which the route handler stalls).
    await titleField.fill(firstValue);
    // "Unsaved changes" → the debounce is pending; then the flush dispatches + stalls
    // (the route holds the response, so it stays in-flight, never reaching "Saved").
    await expect(page.getByText('Unsaved changes')).toBeVisible({ timeout: 10_000 });
    // Give the trailing debounce time to fire flush 1 (it will hang on the route).
    await expect.poll(() => firstActionSeen, { timeout: 10_000 }).toBe(true);

    // FLUSH 2 (fast): type the second value → a new debounced flush dispatches and,
    // because the route lets it through, resolves FAST. The seqRef bump means this is
    // now the latest; its resolution drives the visible state.
    await titleField.fill(secondValue);

    // The SECOND flush resolves → the saved-&-live beat fires for the LATEST value.
    await expect(page.getByText('Saved — your page is live')).toBeVisible({
      timeout: 30_000,
    });
    // After the ~2.2s beat settles, the line rests at "Saved".
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 30_000 });

    // NOW release the STALE first flush (out of order — it resolves AFTER the second).
    releaseFirst();

    // THE GUARD: the visible status must NOT revert to a stale beat/error. Give the
    // released first response time to land, then assert the status is still the resting
    // "Saved" (NOT a re-fired "Saved — your page is live", NOT an error Alert).
    await page.waitForTimeout(3_000);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(page.getByText('Saved — your page is live')).toBeHidden();
    await expect(
      page.getByText('Something went wrong saving your changes. Please try again.'),
    ).toBeHidden();

    // Stop intercepting before the reload (the persistence read must run unimpeded).
    await page.unroute('**/*');

    // PERSISTENCE: the LATER value won — reload and confirm the Title is `secondValue`,
    // proving the stale first flush neither overwrote the second nor corrupted state.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your portfolio' })).toBeVisible({
      timeout: 30_000,
    });
    await page
      .locator('aside[aria-label="Sections"] ul > li', { hasText: 'Projects' })
      .first()
      .getByText('Projects', { exact: true })
      .click();
    await page.getByRole('button', { name: secondValue, exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(secondValue, {
      timeout: 30_000,
    });
  });
});
