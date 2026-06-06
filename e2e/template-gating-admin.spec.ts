/**
 * GATE-04 — /admin/templates operator surface (Phase 12, plan 12-05).
 *
 * This spec is the REGRESSION GUARD for two runtime bugs found during human-UAT that
 * tsc + the integration suite could not catch (commit cc7724e):
 *
 *   (1) getTemplateGating()'s grants embed was ambiguous (template_grants has two FKs
 *       to profiles) → PostgREST errored → the function returned [] → the panel
 *       rendered NO template cards. Guard: the panel renders the three template cards.
 *   (2) the panel's list query is cache-only (skipToken), so a grant/revoke persisted
 *       server-side but the UI never refreshed without a full reload. Guard: after a
 *       grant through the UI, the grantee appears in the card's list WITHOUT a reload.
 *
 * AUTH: cookie-injected admin session (the dev-login race is avoided exactly as the
 * other CMS specs do). The admin is a confirmed owner promoted to `admin` via the
 * service-role API; a second confirmed owner is the grantee.
 */
import { expect, test } from '@playwright/test';

import {
  createConfirmedOwner,
  deleteOwner,
  promoteToAdmin,
  signInAsOwner,
  type TestOwner,
} from './helpers/cms-auth';

const AURORA_UUID = '00000000-0000-4000-8000-000000000003'; // restricted by seed (D-P12-04)

let adminOwner: TestOwner;
let grantee: TestOwner;

test.beforeAll(async () => {
  adminOwner = await createConfirmedOwner('tgadm');
  await promoteToAdmin(adminOwner);
  grantee = await createConfirmedOwner('tggr');
});

test.afterAll(async () => {
  await deleteOwner(adminOwner);
  await deleteOwner(grantee);
});

test('admin can see the template cards and a UI grant appears without a reload', async ({
  page,
}) => {
  await signInAsOwner(page, adminOwner);

  // The is_admin() RSC serves /admin/templates; getTemplateGating() must render cards
  // (regression guard for bug 1 — the ambiguous embed previously yielded an empty list).
  await page.goto('/admin/templates');
  await expect(
    page.getByRole('heading', { name: 'Template Gating', level: 1 }),
  ).toBeVisible({ timeout: 30_000 });

  const auroraCard = page
    .getByRole('listitem')
    .filter({ hasText: 'Aurora' })
    .first();
  await expect(auroraCard).toBeVisible();
  // Aurora is restricted by seed → it shows the grant control.
  await expect(auroraCard.getByText('Restricted — granted users only')).toBeVisible();

  // Grant the grantee to Aurora through the real UI (lookupUser → grantTemplate).
  await auroraCard
    .getByRole('textbox', { name: /Grant Aurora/i })
    .fill(grantee.email);
  await auroraCard.getByRole('button', { name: 'Grant' }).click();

  // REGRESSION GUARD (bug 2): the grantee appears in Aurora's granted list WITHOUT a
  // manual reload — Playwright auto-waits for the router.refresh()-driven re-read.
  // Pre-fix (no router.refresh on a skipToken query) this never updates and times out.
  await expect(auroraCard.getByText(grantee.username)).toBeVisible({ timeout: 15_000 });
});
