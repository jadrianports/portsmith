/**
 * D-22 — the SSG build-route INVARIANT assertion (Wave 0, Plan 06-01).
 * KEPT GREEN BY 06-03-T3 (metadata robots gate) + 06-04-T2 (the modal island).
 * EXTENDED 13.2-08-T2 (D-21/D-22) to the three dedicated sub-routes (/blog, /blog/[slug],
 * /services) — the multi-page portfolio MUST stay ● (SSG)/ISR exactly like the root page.
 *
 * The public `/[username]` route MUST be `● (SSG)`/ISR, NOT `ƒ` (dynamic). Three
 * Phase-6 features touch this page (SEO metadata, footer report link, deep-link
 * modal); ANY accidental server-side `searchParams`/`cookies()`/`headers()`/
 * `no-store`/request-host read silently flips it to dynamic and breaks the
 * load-bearing perf budget. This test is the regression guard the modal slice
 * re-runs to prove it stayed static.
 *
 * The SAME invariant applies to the dedicated-page template class (D-14/D-21): the
 * exclusive-lane sub-pages (`/[username]/blog`, `/[username]/blog/[slug]`,
 * `/[username]/services`) render server-side from the cookie-less anon read + the DB-
 * Markdown blog engine (Shiki highlighting runs at BUILD time, server-only — it must NOT
 * leak onto a client bundle, asserted separately by `check:bundle`). Each must prerender a
 * concrete ISR instance; a dynamic flip would break the same perf budget. T-13.2-22.
 *
 * EXTENDED 20-03-T2 (SHARE-02) — the dynamic share-card GENERATOR segment
 * (`/[username]/opengraph-image`, Plan 02's option-(b) Route Handler) must ITSELF
 * prerender as ISR. This proves SHARE-02's POSITIVE half: the OG route prerendered
 * (not dynamic), so the founder's card is built and ISR-cached on the same
 * `revalidate=3600` posture as the page. The negative half — the page did NOT flip
 * dynamic — is proved by the EXISTING `/[username]` + sub-route assertions staying
 * green UNCHANGED (the page is untouched by Phase 20). The build emits the instance
 * `/jadrianports/opengraph-image` with `srcRoute === '/[username]/opengraph-image'`
 * and `initialRevalidateSeconds === 3600` (VERIFIED against the real prerender
 * manifest — RESEARCH §7.2).
 *
 * It reads the SAME authoritative build artifact `scripts/check-bundle-budget.ts`
 * uses — `.next/prerender-manifest.json` — and asserts the concrete prerendered
 * instance (`/jadrianports`, produced by `generateStaticParams`) exists with the
 * matching `srcRoute` and a positive ISR `initialRevalidateSeconds`. The PRESENCE
 * of that prerendered instance is the deterministic SSG/ISR proof: a dynamic route
 * would not yield it.
 *
 * ── RED-TOLERANT NOW ──────────────────────────────────────────────────────────
 * This SHOULD pass on the current SSG route once a production build exists. When
 * `.next/prerender-manifest.json` is ABSENT (no build has been run in this env),
 * the test FAILS with a clear "run `npm run build` first" hint rather than
 * silently passing — it is the binding assertion, so a missing build must not
 * false-green it. Run `npm run build` (or `npm run check:bundle`) before this in CI.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/** The parameterized public page + the concrete seeded instance it prerenders. */
const ROUTE_SRC = '/[username]';
const ROUTE_INSTANCE = '/jadrianports';

/**
 * The dedicated-page sub-routes (D-14/D-21, 13.2). Each row is `[srcRoute, instance]`:
 * the parameterized page and a concrete prerendered instance `generateStaticParams`
 * yields for the seeded founder. `/blog/[slug]` uses a REAL seeded post slug
 * (`shipping-on-the-edge`, the 017 reconcile seed) so the instance genuinely exists in
 * the manifest — a non-existent slug would (correctly) be absent and false-fail. The
 * presence of each prerendered instance is the deterministic ● (SSG)/ISR proof.
 */
const SUB_ROUTES: ReadonlyArray<readonly [srcRoute: string, instance: string]> = [
  ['/[username]/blog', '/jadrianports/blog'],
  ['/[username]/blog/[slug]', '/jadrianports/blog/shipping-on-the-edge'],
  ['/[username]/services', '/jadrianports/services'],
];

const NEXT_DIR = path.resolve('.next');
const PRERENDER_MANIFEST = path.join(NEXT_DIR, 'prerender-manifest.json');

interface PrerenderManifest {
  routes: Record<
    string,
    { srcRoute?: string | null; initialRevalidateSeconds?: number | false }
  >;
  dynamicRoutes: Record<string, unknown>;
}

function readPrerenderManifest(): PrerenderManifest {
  if (!existsSync(PRERENDER_MANIFEST)) {
    throw new Error(
      `expected build artifact not found: ${PRERENDER_MANIFEST}\n` +
        '  Run `npm run build` (or `npm run check:bundle`) first — this SSG-invariant ' +
        'assertion reads the production prerender manifest and must not false-green ' +
        'on a missing build.',
    );
  }
  return JSON.parse(readFileSync(PRERENDER_MANIFEST, 'utf8')) as PrerenderManifest;
}

describe('D-22 — /[username] stays ● (SSG)/ISR, never ƒ (dynamic)', () => {
  it('has a concrete prerendered instance in the prerender manifest (SSG/ISR proof)', () => {
    const pm = readPrerenderManifest();
    const instance = pm.routes?.[ROUTE_INSTANCE];
    expect(
      instance,
      `${ROUTE_SRC} is NOT ISR/static — no prerendered instance "${ROUTE_INSTANCE}" in ` +
        'prerender-manifest.routes. The route likely went DYNAMIC (ƒ): an accidental ' +
        'searchParams/cookies()/headers()/no-store/request-host read flips it to dynamic ' +
        'and breaks the D-22 perf budget.',
    ).toBeTruthy();
  });

  it('maps the prerendered instance back to the /[username] source route', () => {
    const pm = readPrerenderManifest();
    const instance = pm.routes?.[ROUTE_INSTANCE];
    expect(instance?.srcRoute).toBe(ROUTE_SRC);
  });

  it('carries a positive ISR revalidate (the D-21 backstop), confirming ISR not dynamic', () => {
    const pm = readPrerenderManifest();
    const revalidate = pm.routes?.[ROUTE_INSTANCE]?.initialRevalidateSeconds;
    expect(typeof revalidate).toBe('number');
    expect(revalidate as number).toBeGreaterThan(0);
  });
});

describe('D-21/D-22 — the dedicated sub-routes (/blog, /blog/[slug], /services) stay ● (SSG)/ISR', () => {
  for (const [srcRoute, instance] of SUB_ROUTES) {
    describe(`${srcRoute} → ${instance}`, () => {
      it('has a concrete prerendered instance in the prerender manifest (SSG/ISR proof)', () => {
        const pm = readPrerenderManifest();
        expect(
          pm.routes?.[instance],
          `${srcRoute} is NOT ISR/static — no prerendered instance "${instance}" in ` +
            'prerender-manifest.routes. The dedicated sub-page likely went DYNAMIC (ƒ): an ' +
            'accidental searchParams/cookies()/headers()/no-store/request-host read flips it ' +
            'to dynamic and breaks the D-22 perf budget (T-13.2-22).',
        ).toBeTruthy();
      });

      it(`maps the prerendered instance back to the ${srcRoute} source route`, () => {
        const pm = readPrerenderManifest();
        expect(pm.routes?.[instance]?.srcRoute).toBe(srcRoute);
      });

      it('carries a positive ISR revalidate (the D-21 backstop), confirming ISR not dynamic', () => {
        const pm = readPrerenderManifest();
        const revalidate = pm.routes?.[instance]?.initialRevalidateSeconds;
        expect(typeof revalidate).toBe('number');
        expect(revalidate as number).toBeGreaterThan(0);
      });
    });
  }
});

/**
 * SHARE-02 (20-03) — the dynamic share-card GENERATOR route prerenders as ISR.
 *
 * The Plan-02 `opengraph-image/route.tsx` Route Handler (option b) mirrors page.tsx's
 * `revalidate`/`dynamicParams`/`generateStaticParams`, so the founder's card prebuilds
 * into the manifest as `/jadrianports/opengraph-image` (srcRoute `/[username]/opengraph-image`,
 * `initialRevalidateSeconds === 3600`). Asserting its PRESENCE is the deterministic
 * proof the generator is ISR/static, not dynamic (Pitfall 6 — generateStaticParams
 * drift would absent the instance). This is a NEW, additive case — it does not touch
 * the `/[username]` or SUB_ROUTES assertions above (whose staying-green is SHARE-02's
 * regression half).
 */
const OG_ROUTE_SRC = '/[username]/opengraph-image';
const OG_ROUTE_INSTANCE = '/jadrianports/opengraph-image';

describe('SHARE-02 — the opengraph-image generator route prerenders ● (SSG)/ISR, never ƒ (dynamic)', () => {
  it('has a concrete prerendered instance in the prerender manifest (the OG card prebuilt)', () => {
    const pm = readPrerenderManifest();
    expect(
      pm.routes?.[OG_ROUTE_INSTANCE],
      `${OG_ROUTE_SRC} is NOT ISR/static — no prerendered instance "${OG_ROUTE_INSTANCE}" in ` +
        'prerender-manifest.routes. The generator likely went DYNAMIC (ƒ) or its ' +
        'generateStaticParams drifted from page.tsx (Pitfall 6), so the founder card ' +
        'is not prebuilt — breaking the SHARE-02 positive proof.',
    ).toBeTruthy();
  });

  it('maps the prerendered instance back to the /[username]/opengraph-image source route', () => {
    const pm = readPrerenderManifest();
    expect(pm.routes?.[OG_ROUTE_INSTANCE]?.srcRoute).toBe(OG_ROUTE_SRC);
  });

  it('carries a positive ISR revalidate (mirrors page.tsx revalidate=3600), confirming ISR not dynamic', () => {
    const pm = readPrerenderManifest();
    const revalidate = pm.routes?.[OG_ROUTE_INSTANCE]?.initialRevalidateSeconds;
    expect(typeof revalidate).toBe('number');
    expect(revalidate as number).toBeGreaterThan(0);
  });
});

/**
 * HANDLE-02 (Phase 30) — the old-handle redirect injection must NOT flip the 4 public
 * routes dynamic.
 *
 * Plan 04 injects `await redirectIfRenamedHandle(username, subPath)` at the post-read
 * `notFound()` site of `/[username]`, `/[username]/blog`, `/[username]/blog/[slug]`, and
 * `/[username]/services`. The helper reads `public_username_redirects` via a COOKIE-LESS
 * anon NEXT_PUBLIC_* client (get-portfolio.ts posture, 30-RESEARCH.md Pitfall 4) so the
 * lookup does NOT introduce `cookies()`/`headers()`/`no-store`/request-host reads — the
 * routes stay `● (SSG)`/ISR (D-22). If a future edit reaches for the cookie-reading
 * server client inside the redirect path, these routes flip `ƒ` (dynamic) and the
 * prerendered instances vanish from the manifest — this block is the regression guard
 * that locks the invariant against that drift (key_links: route-table → page.tsx, D-22).
 *
 * This re-pins the SAME 4 routes the blocks above assert, but FRAMED as the redirect-
 * injection invariant so the Plan 04 change re-runs it as its dedicated gate. It passes
 * today (the routes are already SSG) — the value is locking it so Plan 04 cannot regress
 * it silently.
 */
const REDIRECT_INJECTED_ROUTES: ReadonlyArray<readonly [srcRoute: string, instance: string]> = [
  [ROUTE_SRC, ROUTE_INSTANCE],
  ...SUB_ROUTES,
];

describe('HANDLE-02 / D-22 — the redirect injection keeps all 4 public routes ● (SSG)/ISR', () => {
  for (const [srcRoute, instance] of REDIRECT_INJECTED_ROUTES) {
    it(`${srcRoute} stays SSG/ISR after the cookie-less redirect injection (instance ${instance} prerendered)`, () => {
      const pm = readPrerenderManifest();
      const route = pm.routes?.[instance];
      expect(
        route,
        `${srcRoute} is NOT ISR/static — no prerendered instance "${instance}" in ` +
          'prerender-manifest.routes. The Phase-30 redirect helper must stay cookie-LESS ' +
          '(anon NEXT_PUBLIC_* client, persistSession:false); a cookie()/header() read in ' +
          'the redirect path flips the route dynamic (ƒ) and breaks the D-22 perf budget.',
      ).toBeTruthy();
      expect(route?.srcRoute).toBe(srcRoute);
      expect(typeof route?.initialRevalidateSeconds).toBe('number');
      expect(route?.initialRevalidateSeconds as number).toBeGreaterThan(0);
    });
  }
});

/**
 * SHOW-04 (Phase 31, Wave-0 RED) — the NEW `/explore` gallery route prerenders
 * ● (SSG)/ISR, never ƒ (dynamic).
 *
 * Plan 31-05 adds `src/app/(portfolio)/explore/page.tsx` — a cookie-less ISR
 * route (`export const revalidate = 3600`) under the `(portfolio)` root that
 * reads the public showcase views with NO cookies()/headers()/host read, so it
 * stays static like every other `(portfolio)` route. `/explore` is a NON-dynamic
 * route (no `[param]`), so the `(portfolio)` group strips its prefix and it keys
 * in the prerender manifest as the literal `/explore`, with `srcRoute` ===
 * `/explore` (mirroring how `/` keys as `/` for the chrome group — 31-RESEARCH
 * Q4 / Assumption A2). Asserting its PRESENCE + positive ISR revalidate is the
 * deterministic SSG/ISR proof: a dynamic route would not yield a prerendered
 * instance.
 *
 * This is a NEW, ADDITIVE block — it does NOT touch the `/[username]`, SUB_ROUTES,
 * SHARE-02 og-route, or HANDLE-02 assertions above. Their staying-green is the
 * SHOW-04 no-public-route-regression half. RED until 31-05 lands the route AND a
 * production build emits the instance (the read-tolerant missing-build hard-fail
 * in `readPrerenderManifest()` prevents a false green when no build exists).
 */
const EXPLORE_INSTANCE = '/explore';
const EXPLORE_SRC = '/explore';

describe('SHOW-04 — /explore stays ● (SSG)/ISR, never ƒ (dynamic)', () => {
  it('has a concrete prerendered instance in the prerender manifest (SSG/ISR proof)', () => {
    const pm = readPrerenderManifest();
    expect(
      pm.routes?.[EXPLORE_INSTANCE],
      `${EXPLORE_SRC} is NOT ISR/static — no prerendered instance "${EXPLORE_INSTANCE}" in ` +
        'prerender-manifest.routes. The new Explore gallery likely went DYNAMIC (ƒ): an ' +
        'accidental cookies()/headers()/host read in the candidate read flips it dynamic ' +
        'and breaks the SHOW-04 perf budget. It MUST use the cookie-less anon client.',
    ).toBeTruthy();
  });

  it('maps the prerendered instance back to the /explore source route', () => {
    const pm = readPrerenderManifest();
    expect(pm.routes?.[EXPLORE_INSTANCE]?.srcRoute).toBe(EXPLORE_SRC);
  });

  it('carries a positive ISR revalidate (the D-12 backstop), confirming ISR not dynamic', () => {
    const pm = readPrerenderManifest();
    const revalidate = pm.routes?.[EXPLORE_INSTANCE]?.initialRevalidateSeconds;
    expect(typeof revalidate).toBe('number');
    expect(revalidate as number).toBeGreaterThan(0);
  });
});

/**
 * DIST-02 (Phase 33, Wave-0 RED) — the NEW `/draft/[token]` route is intrinsically
 * DYNAMIC (ƒ), NOT prerendered — the NEGATIVE complement to every positive SSG/ISR
 * assertion above.
 *
 * Plan 33-02 adds `src/app/(portfolio)/draft/[token]/page.tsx`: a draft-preview
 * route keyed on a secret, revocable token. Unlike `/[username]` (whose instances
 * `generateStaticParams` enumerates from public usernames), a draft token is a
 * SECRET — it MUST NOT be enumerated into `generateStaticParams`, MUST NOT cache a
 * prerendered instance (a cached draft would survive revoke — D-01), and reads
 * per-request via `supabaseAdmin` gated on the token. So in the prerender manifest
 * it appears in `dynamicRoutes` (the ƒ table) with NO concrete `/draft/<token>`
 * key in `routes` (the ● SSG/ISR table). This block is the regression guard that a
 * future edit never accidentally prerenders a draft instance.
 *
 * This is a NEW, ADDITIVE block — it does NOT touch the `/[username]`, SUB_ROUTES,
 * SHARE-02, HANDLE-02, or SHOW-04 assertions above; their staying-green is the
 * DIST-02 no-public-route-regression half.
 *
 * ── CROSS-WAVE DEPENDENCY (RED-TOLERANT, skipped now) ─────────────────────────
 * `/draft/[token]/page.tsx` does NOT exist until Plan 33-02, so a build run in THIS
 * plan's wave emits NO `/draft/[token]` entry in `dynamicRoutes` at all — a hard
 * assertion would false-FAIL here on a missing route (not on a real regression).
 * The block is therefore `describe.skip` until 33-02 lands the route AND a
 * production build regenerates the manifest with the `/draft/[token]` dynamic
 * entry. Drop `.skip` in 33-02 (the owning plan) to turn this GREEN. The assertion
 * shape is final; only its activation is deferred (documented in 33-01-SUMMARY.md).
 */
const DRAFT_ROUTE_SRC = '/draft/[token]';

describe.skip('DIST-02 — /draft/[token] is DYNAMIC (ƒ), never prerendered (RED until 33-02)', () => {
  it('does NOT prerender any concrete /draft/<token> instance (no SSG/ISR cache of a secret draft)', () => {
    const pm = readPrerenderManifest();
    const prerenderedDraftKeys = Object.keys(pm.routes ?? {}).filter((k) =>
      k.startsWith('/draft/'),
    );
    expect(
      prerenderedDraftKeys,
      `a /draft/<token> instance is prerendered (${prerenderedDraftKeys.join(', ')}) — a draft ` +
        'token is SECRET and revocable; enumerating it into generateStaticParams or caching a ' +
        'prerendered instance would survive a revoke (D-01) and leak the draft. The route MUST ' +
        'stay dynamic (ƒ) and read per-request via supabaseAdmin gated on the token.',
    ).toHaveLength(0);
  });

  it('appears in the dynamicRoutes (ƒ) table as /draft/[token]', () => {
    const pm = readPrerenderManifest();
    expect(
      Object.keys(pm.dynamicRoutes ?? {}),
      `${DRAFT_ROUTE_SRC} is absent from prerender-manifest.dynamicRoutes — the draft route is ` +
        'not registered as a dynamic route (it must NOT be a prerendered/static route).',
    ).toContain(DRAFT_ROUTE_SRC);
  });
});
