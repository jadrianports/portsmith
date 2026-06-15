/**
 * Production public-surface smoke (D-13 / LAUNCH-08 public half, plan 23-04).
 *
 * The committed, RE-RUNNABLE regression that verifies the LIVE deploy's
 * deterministic public/no-auth surface on every redeploy. Run via the prod
 * config (no dev server, BASE_URL-driven origin):
 *
 *     BASE_URL=https://portsmith.vercel.app npm run smoke:prod
 *
 * It generalizes `e2e/portfolio-render.spec.ts` (the local single-template render
 * + no-branding + 404 assertions) across all FOUR live templates and adds the
 * sitemap/robots/opengraph-image/sub-page/absolute-URL checks. Every fixture
 * username is imported from the single-source `DEMO_USERNAMES` constant (plan
 * 23-01) so a username change is one edit there.
 *
 * ── WHAT THIS ASSERTS (the deterministic public surface) ──────────────────────
 *   1. 4-template render — each demo username renders its scoped template root.
 *   2. /blog + /services — the edgerunner-v2 (founder) dedicated sub-pages render.
 *   3. opengraph-image — the founder's OG route returns a real image/png.
 *   4. sitemap + robots — robots disallows the private surfaces + points at the
 *      absolute sitemap; sitemap.xml carries the absolute demo URLs.
 *   5. 404 — an unknown handle 404s with the on-brand "not live" body + NO template.
 *   6. No-platform-branding leak — portfolio bodies carry no "Portsmith"/"Built with"
 *      (the 404 page is the ONE sanctioned wordmark exception — NOT asserted there).
 *   7. Absolute URLs from siteUrl() — canonical/OG/sitemap URLs are absolute
 *      https://portsmith.vercel.app (never localhost / a request host) — D-04/PUB-03.
 *
 * ── WHAT THIS DELIBERATELY DOES *NOT* DO (D-14, the manual-gated boundary) ─────
 * The signup → Turnstile → email-confirm → onboard → publish flow stays a MANUAL
 * checklist in plan 23-05's launch runbook, precisely so it exercises REAL prod
 * Turnstile (LAUNCH-03) + REAL email (LAUNCH-04). This spec imports NO Mailpit URL
 * and NO Turnstile test key — automating that half with stubs would false-green
 * LAUNCH-03/04 (Pitfall 5 / T-23-11).
 *
 * ── PRECONDITION ──────────────────────────────────────────────────────────────
 * The four demo portfolios must be SEEDED + PUBLISHED on the target origin
 * (npm run seed:minimal / seed:editorial / seed:founder / seed:aurora against the
 * prod stack — plan 23-05 runbook). A 404 on a demo username means the seed was
 * not run; the spec fails LOUDLY with that hint rather than silently green.
 */
import { expect, test } from '@playwright/test';

import { DEMO_USERNAMES } from '../scripts/seed/demo-usernames';

/** The expected origin (D-04/PUB-03 — env-driven via siteUrl(), never a request host). */
const EXPECTED_ORIGIN = 'https://portsmith.vercel.app';

/** Platform-branding strings that must NEVER appear on a public PORTFOLIO body (TMPL-07/D-23). */
const FORBIDDEN_BRANDING = ['Portsmith', 'Built with'] as const;

/**
 * The four live templates → their demo username (from the 23-01 constant) and the
 * scoped template-root selector each renders. A visible root proves the lazy
 * template loaded AND the page is not a 404 (the 404 page renders NO `.tmpl-*`).
 */
const TEMPLATE_FIXTURES = [
  { slug: 'minimal', username: DEMO_USERNAMES.minimal, root: '.tmpl-minimal' },
  { slug: 'editorial', username: DEMO_USERNAMES.editorial, root: '.tmpl-editorial' },
  { slug: 'edgerunner-v2', username: DEMO_USERNAMES['edgerunner-v2'], root: '.tmpl-edgerunner-v2' },
  { slug: 'aurora', username: DEMO_USERNAMES.aurora, root: '.tmpl-aurora' },
] as const;

/** The edgerunner-v2 (founder) demo — the ONE template with dedicated /blog + /services sub-pages. */
const SUBPAGE_USERNAME = DEMO_USERNAMES['edgerunner-v2'];

test.describe('production public smoke (D-13 / LAUNCH-08 public half)', () => {
  // Cold ISR/edge hits on the live origin can be slow on a first request; give
  // generous headroom so a cold page does not flake the gate.
  test.beforeEach(({}, testInfo) => {
    testInfo.setTimeout(120_000);
  });

  // Fail loudly if the runner forgot the live origin — this config has no localhost
  // fallback (Pitfall 4), so a missing BASE_URL must surface, not silently pass.
  test.beforeAll(() => {
    expect(
      process.env.BASE_URL,
      'BASE_URL is required for the prod smoke — run `BASE_URL=https://portsmith.vercel.app npm run smoke:prod`',
    ).toBeTruthy();
  });

  // ── 1. 4-template render ────────────────────────────────────────────────────
  for (const { slug, username, root } of TEMPLATE_FIXTURES) {
    test(`renders the ${slug} template at /${username} (scoped root visible)`, async ({ page }) => {
      const response = await page.goto(`/${username}`);

      // A 404 means the demo portfolio was not seeded/published on this origin —
      // fail loudly with the fix rather than silently skipping (a missing seed
      // must not false-green the gate).
      expect(
        response?.status(),
        `GET /${username} returned ${response?.status()}. The ${slug} demo is not ` +
          `seeded/published on ${process.env.BASE_URL} — run the demo seeds (plan 23-05 runbook).`,
      ).toBe(200);

      // The scoped template root rendered (proves the lazy template loaded).
      await expect(
        page.locator(root),
        `expected the ${slug} scoped root "${root}" to render at /${username}`,
      ).toBeVisible();
    });
  }

  // ── 2. /blog + /services (edgerunner-v2 dedicated sub-pages) ──────────────────
  test(`renders the edgerunner-v2 /blog sub-page at /${SUBPAGE_USERNAME}/blog`, async ({ page }) => {
    const response = await page.goto(`/${SUBPAGE_USERNAME}/blog`);
    expect(
      response?.status(),
      `GET /${SUBPAGE_USERNAME}/blog returned ${response?.status()} — expected the edgerunner-v2 blog sub-page.`,
    ).toBe(200);
    // The sub-page renders inside the edgerunner-v2 page shell (scoped root); a 404
    // would render NO template tree.
    await expect(page.locator('.tmpl-edgerunner-v2')).toBeVisible();
  });

  test(`renders the edgerunner-v2 /services sub-page at /${SUBPAGE_USERNAME}/services`, async ({
    page,
  }) => {
    const response = await page.goto(`/${SUBPAGE_USERNAME}/services`);
    expect(
      response?.status(),
      `GET /${SUBPAGE_USERNAME}/services returned ${response?.status()} — expected the edgerunner-v2 services sub-page.`,
    ).toBe(200);
    await expect(page.locator('.tmpl-edgerunner-v2')).toBeVisible();
  });

  // ── 3. opengraph-image (real PNG) ─────────────────────────────────────────────
  test(`GET /${SUBPAGE_USERNAME}/opengraph-image returns a real image/png (> 5000 bytes)`, async ({
    request,
  }) => {
    const res = await request.get(`/${SUBPAGE_USERNAME}/opengraph-image`);
    expect(
      res.status(),
      `the opengraph-image route for /${SUBPAGE_USERNAME} must return 200, got ${res.status()}`,
    ).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
    const body = await res.body();
    // A real card is tens of KB; a broken render is tiny or throws (mirrors
    // tests/og/opengraph-image.test.ts's > 5000-byte assertion).
    expect(body.byteLength).toBeGreaterThan(5000);
  });

  // ── 4. sitemap + robots (absolute URLs, private-surface disallow) ─────────────
  test('GET /robots.txt disallows the private surfaces + references the absolute sitemap', async ({
    request,
  }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();

    // The private surfaces are disallowed (src/app/robots.ts).
    for (const path of ['/dashboard', '/api', '/admin']) {
      expect(body, `robots.txt must Disallow ${path}`).toContain(`Disallow: ${path}`);
    }
    // The sitemap reference is the ABSOLUTE siteUrl('/sitemap.xml') (PUB-03), never
    // a request host / localhost.
    expect(body, 'robots.txt must reference the absolute sitemap URL (siteUrl, PUB-03)').toContain(
      `${EXPECTED_ORIGIN}/sitemap.xml`,
    );
  });

  test('GET /sitemap.xml is XML carrying the demo usernames as absolute https URLs', async ({
    request,
  }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('xml');
    const body = await res.text();

    // Every published demo portfolio appears as an ABSOLUTE siteUrl() URL (PUB-03) —
    // never localhost / a request host.
    for (const { username } of TEMPLATE_FIXTURES) {
      expect(
        body,
        `sitemap.xml must list the absolute URL for the seeded demo /${username}`,
      ).toContain(`${EXPECTED_ORIGIN}/${username}`);
    }
  });

  // ── 5. 404 — on-brand "not live" body, NO template tree ───────────────────────
  test('an unknown handle 404s with the on-brand "not live" body and NO template tree (D-24/D-09)', async ({
    page,
  }) => {
    const unknown = `definitely-not-a-real-user-${Date.now().toString(36)}`;
    const response = await page.goto(`/${unknown}`);

    expect(
      response?.status(),
      `an unknown handle /${unknown} must return HTTP 404 (D-24), got ${response?.status()}`,
    ).toBe(404);

    // D-09: the on-brand "this page isn't live" surface (Surface 7) — the headline
    // renders with a CURLY apostrophe (&rsquo;); match either glyph.
    await expect(page.getByText(/This page isn[’']t live yet/)).toBeVisible();
    await expect(page.getByText('Nothing to see here for now.')).toBeVisible();
    await expect(page.getByRole('link', { name: /Make your own with Portsmith/ })).toBeVisible();
    // It renders NO portfolio template tree (leaks no portfolio detail — T-03-14).
    await expect(page.locator('[class*="tmpl-"]')).toHaveCount(0);
  });

  // ── 6. No-platform-branding leak (portfolio bodies only) ──────────────────────
  for (const { slug, username, root } of TEMPLATE_FIXTURES) {
    test(`the ${slug} portfolio body carries NO platform branding (TMPL-07/D-23)`, async ({
      page,
    }) => {
      await page.goto(`/${username}`);
      await expect(page.locator(root)).toBeVisible();

      // Text-absence on the rendered body: no "Portsmith", no "Built with". The URL
      // is the only attribution. NB: this is asserted on the PORTFOLIO body — the
      // 404 page is the ONE sanctioned wordmark exception and is NOT checked here.
      const bodyText = (await page.locator('body').innerText()) ?? '';
      for (const needle of FORBIDDEN_BRANDING) {
        expect(
          bodyText,
          `the ${slug} public page (/${username}) must contain NO platform branding — found "${needle}" (TMPL-07/D-23)`,
        ).not.toContain(needle);
      }
    });
  }

  // ── 7. Absolute URLs from siteUrl() (canonical + OG) ──────────────────────────
  test(`the founder portfolio emits absolute ${EXPECTED_ORIGIN} canonical + OG URLs (D-04/PUB-03)`, async ({
    page,
  }) => {
    await page.goto(`/${SUBPAGE_USERNAME}`);
    await expect(page.locator('.tmpl-edgerunner-v2')).toBeVisible();

    // The canonical link href is the ABSOLUTE siteUrl() URL — never localhost / a
    // request host (a host-coupled deploy would regress D-04/PUB-03).
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical, 'a canonical link must be present').toBeTruthy();
    expect(
      canonical,
      `canonical must be an absolute ${EXPECTED_ORIGIN} URL (siteUrl, PUB-03), got ${canonical}`,
    ).toContain(`${EXPECTED_ORIGIN}/${SUBPAGE_USERNAME}`);

    // The og:url meta is likewise absolute (env-driven, never the request host).
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
    expect(ogUrl, 'an og:url meta must be present').toBeTruthy();
    expect(
      ogUrl,
      `og:url must be an absolute ${EXPECTED_ORIGIN} URL (siteUrl, PUB-03), got ${ogUrl}`,
    ).toContain(EXPECTED_ORIGIN);

    // The og:image is the dynamic per-portfolio card on the same absolute origin.
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage, 'an og:image meta must be present').toBeTruthy();
    expect(
      ogImage,
      `og:image must be an absolute ${EXPECTED_ORIGIN} URL (siteUrl, PUB-03), got ${ogImage}`,
    ).toContain(EXPECTED_ORIGIN);
  });
});
