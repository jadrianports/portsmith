/**
 * Phase-3 closing E2E gate — the public portfolio render (TMPL-03 / TMPL-07 / D-24;
 * Plan 03-09 Task 2; RESEARCH "Validation Architecture" e2e rows + Wave-0 Gaps
 * "e2e/portfolio-render.spec.ts"). This is the holistic, anonymous-visitor proof
 * that the walking skeleton composes end-to-end against the REAL local stack:
 *
 *   1) RENDER — the seeded `/jadrianports` page renders the full single-scroll with
 *      every real section present, Hero through Contact, in the D-05 order.
 *   2) TESTIMONIALS ABSENT (D-06) — Testimonials is seeded `visible=false`, so the
 *      `public_sections` view excludes it and the `06 / words` block never renders.
 *   3) NO PLATFORM BRANDING (TMPL-07 / D-23) — the rendered page carries NO
 *      "Portsmith" / "Built with" text; the URL is the only attribution.
 *   4) UNKNOWN HANDLE 404 (D-24) — a non-existent username returns HTTP 404 and a
 *      detail-free not-found body, leaking no portfolio content.
 *
 * ── PRECONDITION (LOAD-BEARING) ───────────────────────────────────────────────
 * This spec runs against the LIVE dev server (playwright.config.ts `webServer:
 * npm run dev`, baseURL http://127.0.0.1:3000) + the LOCAL Supabase stack, and it
 * reads the SEEDED published founder portfolio. Before running, the seed must have
 * populated `jadrianports`:
 *
 *     supabase start          # the local stack (DB/API)
 *     npm run seed:founder    # idempotent — populates the published founder portfolio
 *
 * The seeded fixture currently ships SHAPE-VALID PLACEHOLDER content (03-03 Known
 * Stubs: the gitignored founder-content.ts is a verbatim copy of the example, so
 * the display name/headings are `REPLACE:`-prefixed). Therefore this spec asserts
 * the STABLE, HARDCODED structural markers the template itself emits — the mono
 * section labels (`01 / intro` … `07 / contact`) and the LOCKED copy ("Work with
 * me" CTA — D-12; "Have an idea in mind? Let's talk" contact subhead — D-12) —
 * NOT the placeholder content text. Those markers are exactly what proves each
 * section component rendered, and they survive the real-content fill-in.
 *
 * If the page 404s, the seed has not been run — the spec FAILS LOUDLY with that
 * hint rather than silently skipping (a missing seed must not false-green the
 * phase gate).
 *
 * ORIGIN — like the 02-06 signup smoke, the run is on 127.0.0.1:3000 (the
 * config.toml site_url origin / playwright baseURL). No auth/cookies are involved
 * here (the public read is cookie-less by construction — TMPL-04).
 *
 * CLEANUP — this spec creates NO users (it only reads the pre-seeded founder
 * portfolio), so there is nothing to tear down. The seed is idempotent and owned
 * by `npm run seed:founder`.
 */
import { expect, test } from '@playwright/test';

/** The seeded founder public slug (D-27 / 03-03 — MUST match generateStaticParams). */
const SEEDED_USERNAME = 'jadrianports';

/**
 * The mono section labels the template hardcodes, in D-05 order. Each label proves
 * its section component rendered. `06 / words` (Testimonials) is DELIBERATELY
 * EXCLUDED — it is seeded hidden and must be ABSENT (asserted separately).
 */
const PRESENT_SECTION_LABELS = [
  '01 / intro', // Hero
  '02 / about', // About
  '03 / skills', // Skills
  '04 / work', // Projects
  '05 / experience', // Experience
  '07 / contact', // Contact
] as const;

/** The Testimonials label — seeded hidden (D-06), so it must NOT appear. */
const TESTIMONIALS_LABEL = '06 / words';

/** Platform-branding strings that must NEVER appear on the public page (TMPL-07). */
const FORBIDDEN_BRANDING = ['Portsmith', 'Built with'] as const;

test.describe('public portfolio render (TMPL-03 / TMPL-07 / D-06 / D-24)', () => {
  // `next dev` cold-compiles `/[username]` on first hit (Windows, Next 16); give
  // generous headroom so the first navigation's route compilation fits the budget.
  test.beforeEach(({}, testInfo) => {
    testInfo.setTimeout(120_000);
  });

  test('seeded /[username] renders the full single-scroll (Hero…Contact present)', async ({
    page,
  }) => {
    const response = await page.goto(`/${SEEDED_USERNAME}`);

    // Precondition guard: a 404 means the founder portfolio was not seeded. Fail
    // loudly with the fix rather than silently skipping — a missing seed must not
    // false-green the phase gate.
    expect(
      response?.status(),
      `GET /${SEEDED_USERNAME} returned ${response?.status()}. The founder portfolio is ` +
        'not seeded — run `supabase start` then `npm run seed:founder` against the local stack.',
    ).toBe(200);

    // The scoped template root rendered (proves the lazy `minimal` template loaded).
    await expect(page.locator('.tmpl-minimal')).toBeVisible();

    // Every real section's mono label is present (proves each section component
    // rendered) — Hero through Contact, in the D-05 order.
    for (const label of PRESENT_SECTION_LABELS) {
      await expect(
        page.getByText(label, { exact: true }),
        `expected the "${label}" section label to render`,
      ).toBeVisible();
    }

    // The Hero's LOCKED "Work with me" CTA (D-12) — an anchor to #contact.
    await expect(
      page.getByRole('link', { name: 'Work with me' }),
      'expected the locked "Work with me" hero CTA (D-12)',
    ).toBeVisible();

    // The Contact section's LOCKED subhead copy (D-12).
    await expect(
      page.getByText("Have an idea in mind? Let's talk", { exact: false }),
      'expected the locked Contact subhead copy (D-12)',
    ).toBeVisible();

    // A footer renders (the no-branding attribution surface — content checked below).
    await expect(page.locator('footer')).toBeVisible();
  });

  test('Testimonials is ABSENT (seeded visible=false — D-06)', async ({ page }) => {
    await page.goto(`/${SEEDED_USERNAME}`);
    await expect(page.locator('.tmpl-minimal')).toBeVisible();

    // The `06 / words` Testimonials label must NOT be in the rendered DOM: the
    // section is seeded hidden, so the public_sections view excludes the row and
    // the component never renders (belt-and-suspenders hide-if-empty also applies).
    await expect(
      page.getByText(TESTIMONIALS_LABEL, { exact: true }),
      'Testimonials (06 / words) must be absent — seeded visible=false (D-06)',
    ).toHaveCount(0);
  });

  test('the page carries NO platform branding (TMPL-07 / D-23)', async ({ page }) => {
    await page.goto(`/${SEEDED_USERNAME}`);
    await expect(page.locator('.tmpl-minimal')).toBeVisible();

    // Text-absence on the rendered body: no "Portsmith", no "Built with" anywhere.
    // The URL is the only attribution; the footer shows the owner's name/handle +
    // socials only.
    const bodyText = (await page.locator('body').innerText()) ?? '';
    for (const needle of FORBIDDEN_BRANDING) {
      expect(
        bodyText,
        `the public page must contain NO platform branding — found "${needle}" (TMPL-07/D-23)`,
      ).not.toContain(needle);
    }
  });

  test('an unknown handle returns 404 with the generic on-brand "not live" body (D-24 / D-09)', async ({
    page,
  }) => {
    // A username that does not exist (and is not the seeded one) must 404 — the
    // page calls notFound() for missing/unpublished handles.
    const unknown = `definitely-not-a-real-user-${Date.now().toString(36)}`;
    const response = await page.goto(`/${unknown}`);

    expect(
      response?.status(),
      `an unknown handle /${unknown} must return HTTP 404 (D-24), got ${response?.status()}`,
    ).toBe(404);

    // D-09 (supersedes TMPL-07): the not-found page is now the warm, on-brand
    // "this page isn't live" page (Surface 7) — the Portsmith wordmark + the
    // generic headline/support/CTA, shown IDENTICALLY for unpublished AND
    // nonexistent (enumeration-safe; the byte-identity is pinned by
    // not-found-enum.spec.ts). It still renders NO portfolio template tree and
    // leaks no portfolio detail (T-03-14 / T-17-09A). NOTE: the old assertions
    // ("404" / "This page could not be found." / no-Portsmith-branding) were
    // superseded by D-09 — the not-found page is the ONE public surface that now
    // consciously carries the platform wordmark.
    // The headline renders with a CURLY apostrophe (&rsquo;) — match either glyph.
    await expect(page.getByText(/This page isn[’']t live yet/)).toBeVisible();
    await expect(page.getByText('Nothing to see here for now.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Make your own with Portsmith/ })).toBeVisible();
    await expect(page.locator('.tmpl-minimal')).toHaveCount(0);
  });
});
