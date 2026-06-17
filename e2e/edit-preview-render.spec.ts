/**
 * EDIT-01 / D-15 — authed UAT for the iframe draft render + draft-cookie persistence
 * (Phase 27, Wave 0).
 *
 * Owner lifecycle via the shared `cms-auth` helpers. The behaviours this spec pins:
 *   1. with the editor open, the preview `<iframe>` `src` carries the edit-preview flag
 *      (`?edit=1` or equivalent) and renders the owner's DRAFT branch (last-saved content,
 *      D-03) — i.e. the iframe points at the owner's own slug under the draft signal (EDIT-01);
 *   2. Draft Mode is auto-enabled on editor mount and NOT aggressively disabled on leave —
 *      the `__prerender_bypass` draft cookie persists after navigating away from the editor
 *      (D-15: avoid cross-tab teardown races with a separately-open "View my page" tab).
 *
 * ── WAVE-0 SCAFFOLD ───────────────────────────────────────────────────────────────
 * The preview pane + the mount-time draft acquisition land in Plans 02/03. The owner
 * lifecycle is wired now; the iframe-src + cookie-persistence beats are `test.fixme` (they
 * go green once the pane + draft enable exist) so the spec parses + runs in CI today
 * without false-greening unbuilt behaviour. The implementation waves lift the `fixme`s.
 *
 * Run command: `npx playwright test e2e/edit-preview-render.spec.ts`.
 */
import { expect, test } from '@playwright/test';

import { createConfirmedOwner, deleteOwner, signInAsOwner, type TestOwner } from './helpers/cms-auth';

/** The draft-mode bypass cookie Next sets on `draftMode().enable()`. */
const DRAFT_COOKIE = '__prerender_bypass';

test.describe('EDIT-01 / D-15 — iframe renders the owner draft; draft cookie persists', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('edrend');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('the preview iframe src carries the edit flag and targets the owner draft (EDIT-01)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signInAsOwner(page, owner);

    // TODO(Plan 02/03): assert the iframe src === siteUrl(`/${owner.username}`) + the edit
    // flag (e.g. `?edit=1`) and that the rendered document is the draft branch.
    test.fixme(true, 'live-preview pane + edit flag land in Plan 02/03');
    const frame = page.locator('iframe');
    await expect(frame).toHaveAttribute('src', new RegExp(`/${owner.username}.*edit`));
  });

  test('Draft Mode persists after leaving the editor (D-15 — never-disable-on-unmount)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signInAsOwner(page, owner);

    // TODO(Plan 02/03): after the editor auto-enables Draft Mode on mount, navigate away
    // (e.g. to /dashboard/settings) and assert the __prerender_bypass cookie is STILL set
    // — the editor must NOT aggressively disable draft on unmount (cross-tab race, D-15).
    test.fixme(true, 'mount-time draft acquisition lands in Plan 02/03');
    await page.goto('/dashboard/settings');
    const cookies = await page.context().cookies();
    expect(cookies.some((c) => c.name === DRAFT_COOKIE)).toBe(true);
  });
});
