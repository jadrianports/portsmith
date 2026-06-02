/**
 * MEDIA slice (full upload → render loop) — Wave 0 RED.
 *
 * GREENED BY: Plan 05 (the e2e slice — the image uploader wired into the editor,
 * upload → Save → Publish → the public page renders the Storage image). RED NOW
 * because the uploader UI does not yet exist on the dashboard: the
 * `getByTestId('avatar-uploader')` locator below never resolves, so the spec FAILS
 * (a real failing assertion, NOT `test.skip`/`.fixme`). This is the Phase-4 RED
 * idiom (a committed failing gate the downstream slice turns green).
 *
 * AUTH: a CONFIRMED owner created via the admin API + the real initialize_portfolio
 * RPC, signed into the browser via the deterministic @supabase/ssr cookie injection
 * (e2e/helpers/cms-auth.ts) — the same model cms-loop.spec.ts uses.
 *
 * Run command: `npx playwright test e2e/media-upload.spec.ts`.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import {
  createConfirmedOwner,
  deleteOwner,
  signInAsOwner,
  waitForPublicState,
  type TestOwner,
} from './helpers/cms-auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('MEDIA — upload an avatar → Save → Publish → public page renders the Storage image', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('media');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('avatar upload appears as a Storage-origin image on the published page', async ({
    page,
  }) => {
    await signInAsOwner(page, owner);

    // RED GATE (greened by Plan 05): the avatar image uploader is wired into the
    // Profile editor. Until then this locator never resolves and the spec fails.
    const uploader = page.getByTestId('avatar-uploader');
    await expect(uploader).toBeVisible({ timeout: 15_000 });

    // Once green, Plan 05 fills in: pick a file → crop → upload → fill alt → Save →
    // Publish, then assert the public page renders an <img> whose src is on the
    // Storage origin (the D-08 host-lock only renders Storage URLs).
    const fixture = path.join(__dirname, 'fixtures', 'avatar.png');
    await uploader.setInputFiles(fixture);

    await page.getByRole('button', { name: /save/i }).click();
    await page.getByRole('button', { name: /^publish$/i }).click();

    await waitForPublicState(page, `/${owner.username}`, { status: 200 });
    const res = await page.context().request.get(`/${owner.username}`);
    const body = await res.text();
    expect(body).toContain('/storage/v1/object/public/avatars/');
  });
});
