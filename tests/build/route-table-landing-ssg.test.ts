/**
 * LAND-05 (Phase 22, Plan 22-01, Wave 0) — the SSG build-route assertion for the public
 * landing page `/`.
 *
 * The landing page (`src/app/(chrome)/page.tsx`) MUST be `● (SSG)`, NOT `ƒ` (dynamic):
 * D-07/D-12 forbid any session/DB/host read on `/` precisely so it stays statically
 * prerendered (best perf, the LAND-05 "no public-route regression" posture). ANY accidental
 * `cookies()`/`headers()`/`searchParams`/request-host read on a future edit silently flips
 * it to dynamic — this test is the regression guard that catches that flip.
 *
 * MIRRORS `tests/build/route-table-ssg.test.ts` (the D-22 `/[username]` guard): same
 * `.next/prerender-manifest.json` read mechanism, same absent-build hard-fail (so a missing
 * `npm run build` never false-greens this binding assertion). The new instance key is exactly
 * `'/'` (VERIFIED against a prior prod build — RESEARCH OQ-3; the chrome root `/` is keyed
 * `'/'` alongside `/legal`, `/signup`).
 *
 * PRESENCE ONLY — unlike the `/[username]` analog, `/` is pure SSG, not ISR: it carries NO
 * `revalidate`, so this test deliberately does NOT copy the analog's `initialRevalidateSeconds
 * > 0` assertion (that is ISR-specific and would false-FAIL on a static route).
 *
 * The existing `tests/build/route-table-ssg.test.ts` (the D-22 public-route guard) is NOT
 * modified by this plan — its staying-green UNCHANGED is the no-public-route-regression half
 * of LAND-05.
 *
 * ── RED-TOLERANT NOW ──────────────────────────────────────────────────────────
 * This goes GREEN once `/` is built (Plan 03) AND a production build exists. When
 * `.next/prerender-manifest.json` is ABSENT (no build has been run in this env), the test
 * FAILS with a clear "run `npm run build` first" hint rather than silently passing — it is the
 * binding assertion, so a missing build must not false-green it. Run `npm run build` (or
 * `npm run check:bundle`) before this in CI. T-22-01.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/** The public landing-page route, keyed exactly `'/'` in the prerender manifest. */
const ROUTE_INSTANCE = '/';

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

describe('LAND-05 — / (the public landing page) stays ● (SSG), never ƒ (dynamic)', () => {
  it('has a prerendered instance "/" in the prerender manifest (SSG proof)', () => {
    const pm = readPrerenderManifest();
    expect(
      pm.routes?.[ROUTE_INSTANCE],
      "'/' is not prerendered — a dynamic read likely flipped it to ƒ. The landing page " +
        'MUST be statically generated (D-07/D-12): an accidental cookies()/headers()/' +
        'searchParams/request-host read flips it to dynamic and breaks the LAND-05 perf budget.',
    ).toBeTruthy();
  });
});
