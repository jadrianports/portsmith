/**
 * CR-01 — section visibility round-trips in the EDITOR (CMS-05 / D-P4-09).
 *
 * The blocker this proves fixed: before CR-01 the owner read filtered out hidden
 * sections AND the editor hard-coded every row `visible: true`, so a brand-new
 * account's editor showed only 4 of its 7 bootstrap sections — the 3 default-hidden
 * ones (experience / testimonials / blog_preview, seeded `visible:false` by
 * migration 006) were invisible, and the eye-toggle could never re-show a section
 * it had hidden (on the next load the row vanished).
 *
 * What this spec asserts against the REAL editor (a fresh confirmed owner with the
 * enriched D-P4-07 bootstrap):
 *   - the rail shows ALL 7 bootstrap sections, including the 3 default-hidden ones
 *     marked "Hidden" (color-independent: the literal word, not opacity alone);
 *   - hiding a VISIBLE section via its eye-toggle marks it Hidden in place (the row
 *     does NOT disappear), and re-showing it clears the Hidden tag — the full
 *     hide → show round-trip, the exact path that was broken;
 *   - a full reload re-derives the rail from the owner read (includeHidden:true) and
 *     every section is STILL present.
 *
 * LOCATOR NOTE (load-bearing): a HIDDEN row's selection button accessible name is
 * "<Title> Hidden" (the title span + the "Hidden" tag span), so we locate each row
 * by its always-present reorder handle ("Reorder <Title> …"), whose name is the bare
 * title — robust to the visible/hidden state flip. The eye-toggle is the per-row
 * "Hide <Title> from your page" / "Show <Title> on your page" button.
 *
 * Run command: `npx playwright test e2e/visibility-roundtrip.spec.ts`.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { createConfirmedOwner, deleteOwner, signInAsOwner, type TestOwner } from './helpers/cms-auth';

/**
 * The 7 bootstrap sections by their RAIL TITLE (migration 006 order). The rail
 * titles each section via `titleFor` in editor-shell.tsx — hero/about/projects/
 * experience/testimonials/contact get their SECTION_TITLES label; blog_preview has
 * no SECTION_TITLES entry so it falls back to its `content.heading` ("From the
 * Blog"). The default-hidden three are experience / testimonials / blog_preview.
 */
const SECTIONS = [
  { title: 'Hero', defaultHidden: false },
  { title: 'About', defaultHidden: false },
  { title: 'Projects', defaultHidden: false },
  { title: 'Experience', defaultHidden: true },
  { title: 'Testimonials', defaultHidden: true },
  { title: 'Contact', defaultHidden: false },
  { title: 'From the Blog', defaultHidden: true },
] as const;

/** The rail row (listitem) for a section, located by its bare-title reorder handle. */
function rowFor(rail: Locator, page: Page, title: string): Locator {
  return rail.getByRole('listitem').filter({
    has: page.getByRole('button', { name: `Reorder ${title} (use arrow keys after pressing space)` }),
  });
}

test.describe('CR-01 — editor visibility round-trip', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('vis');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('rail shows ALL 7 sections incl. hidden; hide → show round-trips', async ({ page }) => {
    test.setTimeout(120_000);

    // < lg so the responsive master-detail rail is the active surface.
    await page.setViewportSize({ width: 800, height: 1100 });

    await signInAsOwner(page, owner);

    const rail = page.getByRole('complementary', { name: 'Sections' });

    // 1) ALL 7 bootstrap sections are present (the bug hid 3 of them). Locate each by
    //    its reorder handle (bare title), robust to the hidden-state name suffix.
    for (const { title } of SECTIONS) {
      await expect(rowFor(rail, page, title), `rail should show the "${title}" row`).toBeVisible();
    }

    // 2) The 3 default-hidden bootstrap sections are marked "Hidden" in the rail
    //    (color-independent word) AND expose a "Show …" eye-toggle — proving the
    //    editor carries the REAL visible flag, not a hard-coded true.
    for (const { title, defaultHidden } of SECTIONS) {
      const row = rowFor(rail, page, title);
      if (defaultHidden) {
        await expect(row.getByText('Hidden', { exact: true })).toBeVisible();
        await expect(row.getByRole('button', { name: `Show ${title} on your page` })).toBeVisible();
      } else {
        await expect(row.getByText('Hidden', { exact: true })).toBeHidden();
        await expect(row.getByRole('button', { name: `Hide ${title} from your page` })).toBeVisible();
      }
    }

    // 3) HIDE a currently-VISIBLE section (Projects) via its eye-toggle. The row must
    //    stay in the rail and gain the "Hidden" tag (it must NOT disappear).
    const projectsRow = rowFor(rail, page, 'Projects');
    await expect(projectsRow.getByText('Hidden', { exact: true })).toBeHidden();
    await projectsRow.getByRole('button', { name: 'Hide Projects from your page' }).click();
    await expect(projectsRow.getByText('Hidden', { exact: true })).toBeVisible();
    await expect(rowFor(rail, page, 'Projects')).toBeVisible(); // still present

    // 4) SHOW it again — the Hidden tag clears, completing the round-trip.
    await projectsRow.getByRole('button', { name: 'Show Projects on your page' }).click();
    await expect(projectsRow.getByText('Hidden', { exact: true })).toBeHidden();
    await expect(
      projectsRow.getByRole('button', { name: 'Hide Projects from your page' }),
    ).toBeVisible();

    // 5) A full reload re-derives the rail from the OWNER read (includeHidden:true);
    //    EVERY section is STILL present (the previously-hidden defaults never vanish).
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your portfolio' })).toBeVisible({
      timeout: 30_000,
    });
    const railAfter = page.getByRole('complementary', { name: 'Sections' });
    for (const { title } of SECTIONS) {
      await expect(rowFor(railAfter, page, title)).toBeVisible();
    }
  });
});
