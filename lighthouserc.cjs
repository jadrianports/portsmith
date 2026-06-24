/**
 * lighthouserc.cjs — the LOCAL ~40-image atelier perf-proof LHCI config (Plan 36-04,
 * CTPL-03 / D-15). SEPARATE from `lighthouserc.json` (which Lighthouses the four ALREADY-LIVE
 * prod demo pages with NO startServerCommand — a deploy-time gate). THIS config proves the
 * headline CTPL-03 criterion against the NET-NEW heavy gallery, which lives ONLY on the LOCAL
 * Supabase stack (`scripts/seed-atelier-demo.ts` publishes `/atelier-demo` with a ~40-image
 * gallery + hero). Because that page is not live in prod, this config OWNS its own server:
 * it serves the local `next build` output via `next start` and Lighthouses the seeded route.
 *
 * D-15 — the perf proof exercises ~40 images (top of the 20–50 range) so a real heavy creative
 * gallery can't surprise us post-launch. The atelier renderer makes every gallery image a lazy
 * `next/image unoptimized loading="lazy"` inside a CLS-safe aspect box and the hero is the LCP;
 * so First-Load stays tiny regardless of image count and mobile performance must hold ≥ 0.90.
 *
 * PREREQUISITES (run before `npm run lighthouse:atelier`):
 *   1. local Supabase stack UP + migration 032 applied (atelier row live)
 *   2. `npx tsx scripts/seed-atelier-demo.ts` (publishes /atelier-demo, ~40 images)
 *   3. `npx next build` (this config runs `next start` over that build — NO rebuild)
 *
 * The `categories:performance` assertion IS the gate: a sub-0.90 mobile run exits non-zero.
 * Output to `.lighthouseci` (gitignored). Run: `npm run lighthouse:atelier`.
 *
 * NOTE: the four `lighthouserc.json` prod URLs are the deploy-time perf re-verification
 * (lighthouse-deploy-reverify) — a DIFFERENT, pre-existing concern. This file does not touch them.
 */
module.exports = {
  ci: {
    collect: {
      // `next start` over the existing `next build` output (NO `next build` here — the build
      // is a documented prerequisite, mirroring the umbrella's --skip-build discipline). LHCI
      // waits for the pattern below before collecting.
      startServerCommand: 'npx next start',
      startServerReadyPattern: 'Ready in|started server on|Local:',
      startServerReadyTimeout: 120000,
      url: ['http://localhost:3000/atelier-demo'],
      numberOfRuns: 3,
      settings: {
        formFactor: 'mobile',
        screenEmulation: { mobile: true },
      },
    },
    assert: {
      assertions: {
        // CTPL-03 / D-15 — the headline gate. A sub-0.90 mobile performance run exits non-zero.
        'categories:performance': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};
