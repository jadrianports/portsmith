/**
 * EDIT-02 / D-13 — authed UAT for the preview click → panel-focus loop (Phase 27, Wave 0).
 *
 * Owner lifecycle via the shared `cms-auth` helpers (cookie-injected `@supabase/ssr`
 * session, the same model `dirty-guard.spec.ts` uses). The behaviours this spec pins:
 *   1. with the editor open, the live-preview `<iframe>` exists (EDIT-01);
 *   2. clicking a section inside the iframe focuses the matching rail entry — the rail row
 *      shows the existing `bg-brand` active marker (D-12), reusing the rail selection feedback;
 *   3. with the form DIRTY, a preview click that would switch panels routes through the
 *      existing unsaved-changes guard — the "You have unsaved changes" dialog appears (D-13).
 *
 * ── WAVE-0 SCAFFOLD ───────────────────────────────────────────────────────────────
 * The preview pane + click bridge land in Plans 02/03. The owner lifecycle + the
 * iframe-present assertion are wired now; the click → marker and dirty → dialog beats are
 * marked `test.fixme` (they go green once the bridge + listener exist) so this spec parses
 * and runs in CI today without false-greening unbuilt behaviour. The implementation waves
 * lift the `fixme`s.
 *
 * Run command: `npx playwright test e2e/edit-preview-click.spec.ts`.
 */
import { expect, test } from '@playwright/test';

import { createConfirmedOwner, deleteOwner, signInAsOwner, type TestOwner } from './helpers/cms-auth';

test.describe('EDIT-02 / D-13 — preview click → panel focus (with dirty-guard)', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('edprev');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('the editor mounts the live-preview iframe (EDIT-01)', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAsOwner(page, owner);

    // The desktop 3-pane layout (D-07) is open-by-default (D-16). The preview pane is an
    // <iframe> pointing at the owner's own draft route (?edit=1). Assert it exists.
    // TODO(Plan 02/03): tighten to the exact iframe title/name once the pane lands.
    test.fixme(true, 'live-preview pane lands in Plan 02/03');
    await expect(page.locator('iframe')).toHaveCount(1);
  });

  test('clicking a section in the preview marks its rail entry active (D-12)', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAsOwner(page, owner);

    // TODO(Plan 03): post a `section-click` from inside the iframe (or click the rendered
    // section) → assert the matching rail row carries the `bg-brand` active marker.
    test.fixme(true, 'click bridge + listener land in Plan 03');
    expect(owner.username).toBeTruthy();
  });

  test('a preview click while DIRTY opens the unsaved-changes dialog (D-13)', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAsOwner(page, owner);

    // TODO(Plan 03): open Hero, make the form dirty, then click ANOTHER section in the
    // preview → the existing "You have unsaved changes" alertdialog appears (the bridge
    // routes through the guarded path, never sets activeSectionId directly).
    test.fixme(true, 'guarded preview navigation lands in Plan 03');
    const dialog = page.getByRole('alertdialog', { name: 'You have unsaved changes' });
    await expect(dialog).toBeVisible();
  });
});
