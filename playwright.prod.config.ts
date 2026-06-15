import { defineConfig } from '@playwright/test';

/**
 * Production public-smoke Playwright config (D-13 / LAUNCH-08 public half, plan 23-04).
 *
 * SIBLING — NOT a replacement — of the local `playwright.config.ts`. The local
 * config hardcodes `baseURL: http://127.0.0.1:3000` AND a `webServer: { command:
 * 'npm run dev' }` block (it boots `next dev` for the local E2E + visual-baseline
 * suite). This prod config does the OPPOSITE:
 *
 *   - `use.baseURL = process.env.BASE_URL` — the live origin is injected at run
 *     time (`BASE_URL=https://portsmith.vercel.app npm run smoke:prod`). It never
 *     points at localhost.
 *   - NO `webServer` block (Pitfall 4 / T-23-12) — the prod smoke MUST hit the
 *     already-deployed origin, never boot a dev server. A `webServer` here would
 *     spin up `next dev` and silently test the wrong target.
 *   - NO visual-snapshot defaults — the prod smoke is content/status assertions,
 *     not pixel-diff baselines (those live in the local config + `__screenshots__`).
 *   - `testMatch` targets ONLY `e2e/prod-smoke.spec.ts`, so the local E2E specs
 *     (which DO need a dev server) never run under this config.
 *
 * The two configs never interfere: the local one is untouched by this plan.
 *
 * DEPLOY-GATED: `--list` works with no `BASE_URL` (it only enumerates tests). The
 * actual RUN needs a live `BASE_URL` and is a post-deploy step (recorded in the
 * phase HUMAN-UAT), not a pre-merge gate.
 */
export default defineConfig({
  testDir: './e2e',
  // ONLY the prod smoke runs under this config — the dev-server-booting local
  // specs (auth-signup, portfolio-render, …) are excluded.
  testMatch: 'prod-smoke.spec.ts',
  use: {
    // The live origin, injected at run time. NO localhost fallback — a missing
    // BASE_URL surfaces as an explicit failure in the spec's beforeAll guard.
    baseURL: process.env.BASE_URL,
  },
  // NO `webServer` — the prod smoke hits the live deployed origin (Pitfall 4).
  // NO visual-snapshot `expect.toHaveScreenshot` defaults — content assertions only.
});
