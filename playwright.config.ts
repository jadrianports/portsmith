import { config as loadEnv } from 'dotenv';

import { defineConfig } from '@playwright/test';

// Load `.env.local` so the spec's admin-API cleanup (service-role key) and the
// Supabase/Mailpit hosts resolve from the same source the rest of the project
// uses (vitest does the same). `next dev` loads `.env.local` itself.
loadEnv({ path: '.env.local' });

/**
 * Playwright config — first real smoke flow (02-06).
 *
 * The scaffold (CONTEXT D-11) intentionally shipped with NO `webServer` block
 * and a comment stating that "whichever later plan adds the first spec also adds
 * the matching `webServer`." This plan (02-06) is that plan: it adds the first
 * E2E spec (`e2e/auth-signup.spec.ts` — the signup -> confirm -> dashboard
 * phase-gate flow), so it also wires the `webServer` + `baseURL` the spec needs.
 *
 * ORIGIN NOTE (load-bearing): `baseURL` is `http://127.0.0.1:3000`, NOT
 * `localhost`. The confirmation email link is rendered from Supabase's
 * `config.toml` `site_url = http://127.0.0.1:3000` (see 02-02-SUMMARY: the
 * verified link shape is `http://127.0.0.1:3000/auth/confirm?token_hash=...`).
 * `127.0.0.1` and `localhost` are DISTINCT cookie origins, so the whole
 * session-bearing flow (signup -> confirm) must run on the SAME origin the
 * email link carries. Running the spec on `127.0.0.1:3000` keeps the signup
 * page, the confirm navigation, and the auth-token cookie all on one origin.
 */
export default defineConfig({
  testDir: './e2e',
  // Single-origin consistency with the email link (config.toml site_url).
  use: {
    baseURL: 'http://127.0.0.1:3000',
  },
  // Boot `next dev` for the run; reuse a hand-started dev server locally. A
  // generous timeout covers a cold Next 16 compile on Windows (first request
  // triggers route compilation).
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
