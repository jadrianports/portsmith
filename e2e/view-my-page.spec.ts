/**
 * D-08 (UX-01, 17-08) — the persistent "View my page" header control (Surface 6).
 * The everyday "edit → see what visitors see" loop: a NEW header affordance,
 * distinct from the same-tab "Preview" link, that ALWAYS opens the public page in a
 * NEW tab — the banner-wrapped draft while unpublished, the live page once published.
 *
 * WHAT IT PROVES (17-VALIDATION.md § Per-Requirement — D-08 row; 17-UI-SPEC Surface 6):
 *   1. UNPUBLISHED → "View my page" routes through the draft-enable path
 *      (`/api/preview/enable`, full nav, `prefetch={false}`) and opens in a NEW tab;
 *      the opened tab lands on the owner's slug showing the banner-wrapped private
 *      draft ("Draft · only you can see this page").
 *   2. PUBLISHED → "View my page" points DIRECTLY at `siteUrl('/' + username)` in a
 *      new tab — the host-independent URL whose ORIGIN is NEXT_PUBLIC_SITE_URL, NOT
 *      the request host (the D-08 / D-22 invariant: the public branch gains no
 *      dynamic read; the origin never comes from the `127.0.0.1` baseURL host).
 *   3. BOTH states use `target="_blank"` + `rel="noopener noreferrer"` and an
 *      `aria-label` that names the destination + the new-tab behavior.
 *
 * NOTE: the public branch staying `● SSG` (the D-22 half of D-08) is asserted by the
 * deterministic build gate `npm run check:bundle` + `tests/build/route-table-ssg.test.ts`,
 * which Plan 08 runs alongside this spec — it is not re-asserted at runtime here.
 *
 * AUTH: a CONFIRMED owner bootstrapped with the real `initialize_portfolio` RPC; the
 * spec flips `published` via the admin API (`setOwnerPublished`) to reach the
 * published state without driving the publish button. See cms-auth.ts.
 *
 * Run command: `npx playwright test e2e/view-my-page.spec.ts`.
 */
import { expect, test } from '@playwright/test';

import {
  createConfirmedOwner,
  deleteOwner,
  setOwnerPublished,
  signInAsOwner,
  type TestOwner,
} from './helpers/cms-auth';

/** The configured site origin (NEXT_PUBLIC_SITE_URL) — the host-INDEPENDENT origin
 *  siteUrl() derives from. Distinct from the Playwright baseURL host (127.0.0.1): the
 *  D-08 invariant is that the live URL's origin is THIS, never the request host. */
const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

test.describe('D-08 (UX-01) — the persistent "View my page" header control', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('viewpage');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('unpublished opens the banner-wrapped draft; published targets siteUrl(); both new-tab', async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);

    // ── UNPUBLISHED (the fresh account default) ─────────────────────────────────
    await signInAsOwner(page, owner);

    const viewUnpublished = page.getByRole('link', {
      name: 'View a private preview of my page (opens in a new tab)',
    });
    await expect(viewUnpublished).toBeVisible();
    // New-tab + safe-rel + the draft-enable path (prefetch={false} is a runtime nav
    // hint, not a DOM attribute — its effect is the full-nav draft cookie, asserted
    // by the opened tab landing on the banner-wrapped draft below).
    await expect(viewUnpublished).toHaveAttribute('target', '_blank');
    await expect(viewUnpublished).toHaveAttribute('rel', /noopener/);
    await expect(viewUnpublished).toHaveAttribute('href', /\/api\/preview\/enable/);

    // Drive the new tab: clicking opens a popup that runs the draft-enable redirect to
    // the owner's own slug with the draft cookie → the banner-wrapped private draft.
    const popupPromise = context.waitForEvent('page');
    await viewUnpublished.click();
    const draftTab = await popupPromise;
    await draftTab.waitForLoadState('domcontentloaded');
    await expect(draftTab).toHaveURL(new RegExp(`/${owner.username}(\\b|/|\\?|$)`), {
      timeout: 30_000,
    });
    // The PreviewBanner (the one chrome element over the template surface) confirms the
    // owner is seeing the PRIVATE draft (D-07 confident base shape).
    await expect(
      draftTab.getByText('Draft · only you can see this page'),
    ).toBeVisible({ timeout: 30_000 });
    await draftTab.close();

    // ── PUBLISHED ───────────────────────────────────────────────────────────────
    // Flip published via the admin API, then reload the dashboard so the control
    // re-renders in its published state (the live-URL target).
    await setOwnerPublished(owner, true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your portfolio' })).toBeVisible({
      timeout: 30_000,
    });

    const viewPublished = page.getByRole('link', {
      name: 'View my published page (opens in a new tab)',
    });
    await expect(viewPublished).toBeVisible();
    await expect(viewPublished).toHaveAttribute('target', '_blank');
    await expect(viewPublished).toHaveAttribute('rel', /noopener/);

    // THE D-08 INVARIANT: the published href is siteUrl('/' + username) — its ORIGIN is
    // NEXT_PUBLIC_SITE_URL, NOT the request host. Assert the exact host-independent URL.
    const publishedHref = await viewPublished.getAttribute('href');
    expect(publishedHref).toBe(`${SITE_ORIGIN}/${owner.username}`);
    // Defense-in-depth: the origin is the configured site origin, never the
    // 127.0.0.1 baseURL the dashboard is actually served from.
    expect(new URL(publishedHref!).origin).toBe(SITE_ORIGIN);
    expect(new URL(publishedHref!).origin).not.toBe('http://127.0.0.1:3000');
  });
});
