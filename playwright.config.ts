import { defineConfig } from '@playwright/test';

/**
 * Playwright SCAFFOLD ONLY (CONTEXT D-11).
 *
 * This is a valid, runnable config with NO specs yet. Real end-to-end smoke
 * flows are deferred:
 *   - P2 (auth):   sign up -> confirm -> land on dashboard.
 *   - P3 (public): publish toggle -> public `/[username]` page renders.
 * (See handoff docs/07-testing.md "Layer 3 — Smoke tests" for the full list.)
 *
 * NOTE: intentionally NO `webServer` block. Adding one that boots `next dev`/
 * `next start` would make CI hang/fail on a server that has nothing to test yet.
 * Whichever later plan adds the first spec also adds the matching `webServer`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Absolute URLs are driven by NEXT_PUBLIC_SITE_URL everywhere (repo CLAUDE.md
  // relocatable-rendering constraint); the E2E baseURL follows the same source.
  use: {
    baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  },
});
