/**
 * TMPL-06 — RED scaffold (Wave 0, Plan 06-01). GREENED BY 06-04-T2.
 *
 * The deep-linkable, keyboard-accessible work-item modal (D-18). This e2e spec
 * encodes the modal's user-visible contract against the SEEDED public page
 * (`/jadrianports`) — a PUBLIC, cookie-less page (no auth needed):
 *
 *   1. clicking a project card opens a `role="dialog"` with `aria-modal="true"`
 *      and the URL gains `?project=<slug>` (SHALLOW push — no navigation);
 *   2. focus moves INTO the dialog on open (focus trap entry);
 *   3. pressing Escape closes the dialog AND drops the `?project=` param;
 *   4. loading `/jadrianports?project=<slug>` directly AUTO-OPENS the modal
 *      (the deep link), proving the client island reads the param on mount.
 *
 * The page must NEVER read `searchParams` server-side (that flips `/[username]`
 * to `ƒ` dynamic and breaks the D-22 SSG invariant) — the param is read ONLY
 * client-side via `useSearchParams()`; open/close use `window.history.pushState`.
 * The companion `tests/build/route-table-ssg.test.ts` is the binding SSG guard
 * the modal slice re-runs.
 *
 * ── WHY RED NOW ───────────────────────────────────────────────────────────────
 * The modal island does not exist yet — `projects.tsx` is still a pure Server
 * Component with cards and no overlay/deep-link. So no `role="dialog"` opens and
 * the URL never gains `?project=` — every assertion below FAILS until 06-04-T2
 * ships the island. This is genuinely RED, not a smoke that silently skips.
 *
 * ── PRECONDITION (load-bearing) ───────────────────────────────────────────────
 * Runs against the LIVE dev server (playwright webServer) + the LOCAL Supabase
 * stack with the seeded founder portfolio. Before running:
 *     supabase start
 *     npm run seed:founder
 * A 404 means the seed was not run — the spec FAILS LOUDLY with that hint rather
 * than silently skipping (a missing seed must not false-green the modal gate).
 */
import { expect, test } from '@playwright/test';

/** The seeded founder public slug (D-27 / 03-03 — MUST match generateStaticParams). */
const SEEDED_USERNAME = 'jadrianports';

/** The Projects section's mono label — proves the section rendered (03 order: 04 / work). */
const PROJECTS_LABEL = '04 / work';

test.describe('TMPL-06 — deep-linkable project modal (a11y + shallow routing)', () => {
  // `next dev` cold-compiles `/[username]` on first hit (Windows, Next 16); give
  // generous headroom so the first navigation's route compilation fits the budget.
  test.beforeEach(({}, testInfo) => {
    testInfo.setTimeout(120_000);
  });

  test('clicking a project card opens an aria-modal dialog and pushes ?project=', async ({
    page,
  }) => {
    const response = await page.goto(`/${SEEDED_USERNAME}`);
    expect(
      response?.status(),
      `GET /${SEEDED_USERNAME} returned ${response?.status()}. The founder portfolio is ` +
        'not seeded — run `supabase start` then `npm run seed:founder` against the local stack.',
    ).toBe(200);

    await expect(page.locator('.tmpl-minimal')).toBeVisible();
    // The Projects section rendered (its mono label is a stable template marker).
    await expect(page.getByText(PROJECTS_LABEL, { exact: true })).toBeVisible();

    // Click the first project card (the island makes the card the modal trigger).
    const firstCard = page.locator('.tmpl-project-card').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    // A focus-trapped accessible dialog opens (RED until the island ships).
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    // The URL gained a ?project=<slug> param via a SHALLOW push (no navigation).
    await expect(page).toHaveURL(/\?project=[^&]+/);

    // Focus moved INTO the dialog (focus-trap entry).
    const focusInDialog = await dialog.evaluate((el) =>
      el.contains(document.activeElement),
    );
    expect(focusInDialog).toBe(true);
  });

  test('Escape closes the dialog and drops the ?project= param', async ({ page }) => {
    await page.goto(`/${SEEDED_USERNAME}`);
    await expect(page.locator('.tmpl-minimal')).toBeVisible();

    await page.locator('.tmpl-project-card').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\?project=/);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // The param is cleared on close (back to the bare path, no ?project=).
    await expect(page).not.toHaveURL(/\?project=/);
  });

  test('loading ?project=<slug> directly AUTO-OPENS the modal (deep link)', async ({
    page,
  }) => {
    // Discover a real seeded slug by opening one card and reading the pushed param.
    await page.goto(`/${SEEDED_USERNAME}`);
    await expect(page.locator('.tmpl-minimal')).toBeVisible();
    await page.locator('.tmpl-project-card').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const url = new URL(page.url());
    const slug = url.searchParams.get('project');
    expect(slug, 'opening a card must push a ?project=<slug> param').toBeTruthy();

    // Fresh load straight to the deep link → the modal auto-opens on mount.
    await page.goto(`/${SEEDED_USERNAME}?project=${encodeURIComponent(slug as string)}`);
    await expect(page.locator('.tmpl-minimal')).toBeVisible();
    await expect(
      page.getByRole('dialog'),
      'a direct ?project=<slug> load must auto-open the modal (deep link, D-18)',
    ).toBeVisible();
  });
});
