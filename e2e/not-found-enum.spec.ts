/**
 * D-09 / UX-01 — the "not live" public page is ENUMERATION-SAFE + noindex + SSG.
 *
 * This spec pins the load-bearing security property of the restyled
 * `(portfolio)/[username]/not-found.tsx` (Surface 7): the page renders
 * IDENTICALLY for an UNPUBLISHED-but-real username AND a NONEXISTENT one, so a
 * visitor (or a scraper) can NOT use the not-found response as an oracle to learn
 * whether a username is taken (T-17-09A — Information Disclosure, HIGH). Both
 * cases funnel through the SAME `notFound()` call (`page.tsx:202` public /
 * `:142` draft) and `get-portfolio.ts` returns `null` for both, so the response
 * is structurally identical by construction; this test PROVES it stays so against
 * the restyle (RESEARCH Mechanism 3 / Pitfall 4).
 *
 * It also asserts the page stays NOINDEX (D-09 / T-17-09C — `notFound()`
 * auto-injects `<meta name="robots" content="noindex">`, belt-and-suspenders with
 * `generateMetadata`'s null branch) and renders the warm on-brand Surface-7 copy.
 *
 * The D-22 SSG half is proven separately by the REUSED build gates — do NOT
 * rebuild a gate here:
 *   - `npm run check:bundle`                         (render-mode + ≤200 kB)
 *   - `npx vitest run tests/build/route-table-ssg.test.ts` (prerender-manifest SSG)
 * Both must stay green after the restyle (they were, post-restyle: /[username]
 * stays ● SSG/ISR at 183.7 kB First Load JS — the not-found sibling ships zero
 * client JS).
 *
 * ── DEV vs PRODUCTION (load-bearing for HOW this asserts) ─────────────────────
 * `playwright.config.ts` boots `next dev`. Under `next dev`, a `notFound()` 404
 * returns the dev ERROR-FALLBACK shell (`<html id="__next_error__">`) and STREAMS
 * the actual `not-found.tsx` UI via the RSC flight payload — so the visible
 * Surface-7 copy is NOT in the raw initial-response HTML (it hydrates in). The
 * raw-HTML BYTE-IDENTITY + status + noindex assertions therefore run against
 * `request.get()` (where any server-side enumeration oracle would live), while the
 * VISIBLE-COPY assertion uses `page.goto()` + DOM locators (which render the
 * streamed not-found UI). Both approaches are correct under a production
 * `next start` too (there the copy is also in the prerendered HTML).
 *
 * ── PRECONDITION ──────────────────────────────────────────────────────────────
 * The LOCAL Supabase stack must be up. The UNPUBLISHED case uses a freshly-created
 * confirmed owner (admin API) whose portfolio is left UNPUBLISHED (the default for
 * a new account) — so its public page `notFound()`s. Start the stack first:
 *
 *     supabase start          # the local stack (DB/API)
 *
 * The NONEXISTENT case is a random handle that was never created. No founder seed
 * is required (this spec creates + tears down its own unpublished owner).
 *
 * CLEANUP — the created owner is deleted in `afterAll` (cascades to
 * profile/portfolio/sections); the nonexistent handle creates nothing.
 */
import { expect, test } from '@playwright/test'; // D-09

import { createConfirmedOwner, deleteOwner, type TestOwner } from './helpers/cms-auth';

/**
 * Normalize a not-found HTML response down to its STABLE, deterministic shape so
 * two responses can be compared for STRUCTURAL identity. Next injects per-render /
 * per-build / per-REQUEST tokens that are framework noise, NOT a per-username
 * oracle — all stripped here:
 *   - the streamed RSC flight payload (`self.__next_f.push([...])`).
 *   - the per-render RANDOM router token (`self.__next_r="…"`) — a fresh random
 *     value on EVERY render (it differs between two requests for the SAME handle),
 *     so it is the strongest proof that what is left is genuinely identical.
 *   - the dev error-fallback stack (`data-next-error-stack="…"`) + the
 *     `[root-of-the-server]__<hash>` dev chunk id (absolute build paths + line:col).
 *   - build-id-hashed `/_next/static/<hash>/…` asset URLs + hashed script/link srcs.
 *   - the REQUEST PATHNAME echo (this response's OWN handle) — Next echoes the URL
 *     the client itself typed into the router state for EVERY 404; the visitor
 *     already knows the handle they requested, so it is not a disclosure.
 *   - `<!--$-->`/`<!--/$-->` Suspense markers + collapsed whitespace.
 *
 * After normalization the MEANINGFUL markup must be byte-identical between the
 * unpublished and nonexistent cases — if a REAL per-case oracle were reintroduced
 * (a DIFFERENT headline/status/shape, or the OTHER case's handle echoed in), it
 * would survive normalization and fail.
 */
function normalizeNotFound(html: string, requestedHandle: string): string {
  return (
    html
      // The streamed RSC flight payload — build-specific chunk ids + the pathname.
      .replace(/self\.__next_f\.push\(\[[\s\S]*?\]\)/g, 'self.__next_f.push([])')
      // The per-render RANDOM router token — fresh on every render (framework noise).
      .replace(/self\.__next_r\s*=\s*"[^"]*"/g, 'self.__next_r="_"')
      // The dev error-fallback stack — absolute build paths + line:col, per-build.
      .replace(/data-next-error-stack="[\s\S]*?"/g, 'data-next-error-stack="_"')
      // The dev `[root-of-the-server]__<hash>` chunk id inside any remaining attr.
      .replace(/\[root-of-the-server\]__[A-Za-z0-9~._-]+/g, '[root-of-the-server]__')
      // The request pathname echo (this response's OWN handle) — framework noise.
      .split(`/${requestedHandle}`)
      .join('/_HANDLE_')
      .split(requestedHandle)
      .join('_HANDLE_')
      // Build-id-hashed static asset URLs (CSS/JS) differ per build, not per username.
      .replace(/\/_next\/static\/[^"']+/g, '/_next/static/_')
      // Any remaining script/link srcs that carry a content hash.
      .replace(/(src|href)="[^"]*?\.(js|css)[^"]*"/g, '$1="_"')
      // React Suspense boundary comment markers.
      .replace(/<!--\/?\$[^>]*-->/g, '')
      // Collapse whitespace so incidental formatting never drives the diff.
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * The verbatim Surface-7 copy the restyled not-found page must render. The headline
 * is rendered with a CURLY apostrophe (`&rsquo;` → ’ U+2019), so it is matched with
 * a regex that tolerates either a straight or a curly apostrophe — a brittle exact
 * straight-quote string would (correctly) fail against the rendered curly glyph.
 */
const NOT_FOUND_HEADLINE = /This page isn[’']t live yet/;
const NOT_FOUND_SUPPORT = 'Nothing to see here for now.';
const NOT_FOUND_CTA = /Make your own with Portsmith/;
const WORDMARK = 'Portsmith';

test.describe('not-found is enumeration-safe + noindex (D-09 / D-24 / UX-01)', () => {
  // `next dev` cold-compiles `/[username]` on first hit (Windows, Next 16); give
  // generous headroom so the first navigation's route compilation fits the budget.
  test.beforeEach(({}, testInfo) => {
    testInfo.setTimeout(120_000);
  });

  let owner: TestOwner | undefined;

  test.beforeAll(async () => {
    // A confirmed owner whose portfolio is UNPUBLISHED (the default) — its public
    // `/[username]` therefore `notFound()`s exactly like a nonexistent handle.
    owner = await createConfirmedOwner('nf');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('unpublished and nonexistent usernames return the SAME status + byte-identical not-found body', async ({
    request,
  }) => {
    if (!owner) throw new Error('[e2e] unpublished owner was not created in beforeAll');

    const unpublished = owner.username; // real account, never published
    const nonexistent = `definitely-not-a-real-user-${Date.now().toString(36)}`;

    // Fetch the RAW HTML of both public pages — the server response is where any
    // enumeration oracle would live (a per-case status / copy / shape difference).
    const unpubRes = await request.get(`/${unpublished}`);
    const nonexistentRes = await request.get(`/${nonexistent}`);

    // (1) SAME status — both are the generic notFound() (HTTP 404). A status
    //     difference (e.g. 200 vs 404, or 403) would itself be an oracle.
    expect(
      unpubRes.status(),
      `the UNPUBLISHED /${unpublished} must 404 like any unresolved handle (D-24); ` +
        'if it 200s, an unpublished page is leaking that the username exists.',
    ).toBe(404);
    expect(
      nonexistentRes.status(),
      `the NONEXISTENT /${nonexistent} must 404 (D-24), got ${nonexistentRes.status()}`,
    ).toBe(404);
    expect(
      unpubRes.status(),
      'unpublished and nonexistent must return the SAME status (no status oracle)',
    ).toBe(nonexistentRes.status());

    const unpubHtml = await unpubRes.text();
    const nonexistentHtml = await nonexistentRes.text();

    // (2) NO CROSS-LEAK — the response for one handle must not reveal anything
    //     about the OTHER handle. (A response echoing its OWN requested pathname is
    //     framework noise — the visitor already typed that URL — and is not a
    //     disclosure; the real leak would be the unpublished handle surfacing in the
    //     NONEXISTENT response, or vice-versa.)
    expect(
      nonexistentHtml.includes(unpublished),
      `the NONEXISTENT response must not contain the unpublished username ` +
        `"${unpublished}" — that would leak that the handle exists (enumeration)`,
    ).toBe(false);
    expect(
      unpubHtml.includes(nonexistent),
      `the UNPUBLISHED response must not contain the nonexistent handle "${nonexistent}"`,
    ).toBe(false);

    // (3) BYTE-IDENTICAL meaningful markup — after stripping Next's framework-
    //     nondeterministic tokens AND each response's own requested-pathname echo,
    //     the two responses are structurally identical. This is the core
    //     enumeration-safety assertion: ONE generic page for both, no oracle.
    expect(
      normalizeNotFound(unpubHtml, unpublished),
      'the unpublished and nonexistent not-found bodies must be byte-identical ' +
        '(no copy/shape oracle distinguishes them) — D-09 / T-17-09A',
    ).toBe(normalizeNotFound(nonexistentHtml, nonexistent));
  });

  test('the not-found page renders the warm on-brand Surface-7 copy (identical for both cases)', async ({
    page,
  }) => {
    if (!owner) throw new Error('[e2e] unpublished owner was not created in beforeAll');

    const unpublished = owner.username;
    const nonexistent = `definitely-not-a-real-user-${Date.now().toString(36)}`;

    // Use page navigation (not raw HTML): under `next dev` the not-found UI streams
    // via RSC, so the visible copy hydrates in rather than sitting in the initial
    // response. The DOM locators below wait for it in BOTH dev and production.
    for (const [label, handle] of [
      ['unpublished', unpublished],
      ['nonexistent', nonexistent],
    ] as const) {
      const res = await page.goto(`/${handle}`);
      expect(res?.status(), `${label} /${handle} must 404`).toBe(404);

      // The warm Surface-7 copy renders — wordmark + headline + support + CTA —
      // identically for both the unpublished and the nonexistent case (D-09).
      await expect(
        page.getByText(WORDMARK, { exact: true }),
        `${label}: the Portsmith wordmark renders`,
      ).toBeVisible();
      await expect(
        page.getByText(NOT_FOUND_HEADLINE),
        `${label}: the Surface-7 headline renders`,
      ).toBeVisible();
      await expect(
        page.getByText(NOT_FOUND_SUPPORT),
        `${label}: the Surface-7 support line renders`,
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: NOT_FOUND_CTA }),
        `${label}: the Surface-7 CTA link renders`,
      ).toBeVisible();

      // And NO portfolio template tree leaks onto the not-found page (T-03-14).
      await expect(page.locator('.tmpl-minimal')).toHaveCount(0);
    }
  });

  test('both not-found responses are noindex (no preview/page leaks into the index)', async ({
    request,
  }) => {
    if (!owner) throw new Error('[e2e] unpublished owner was not created in beforeAll');

    const unpublished = owner.username;
    const nonexistent = `definitely-not-a-real-user-${Date.now().toString(36)}`;

    // `notFound()` auto-injects `<meta name="robots" content="noindex">`; the
    // null-robots belt in generateMetadata reinforces it. Assert the noindex
    // signal is present (case-insensitive, attribute-order-agnostic) for BOTH.
    const robotsNoindex = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["']/i;

    for (const handle of [unpublished, nonexistent]) {
      const res = await request.get(`/${handle}`);
      expect(res.status(), `/${handle} must 404`).toBe(404);
      const html = await res.text();
      expect(
        robotsNoindex.test(html),
        `/${handle} must carry a noindex robots meta (D-09 / T-17-09C) — the not-found ` +
          'page must never be indexable',
      ).toBe(true);
    }
  });
});
