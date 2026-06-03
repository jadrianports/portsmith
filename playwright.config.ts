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
    // REDUCED-MOTION EMULATION (D-01 — load-bearing for the parity baselines).
    // Both templates wrap every below-the-fold section in a `ScrollReveal`
    // IntersectionObserver island (src/components/templates/{minimal,editorial}/
    // scroll-reveal.tsx) that, when motion is ALLOWED, hydrates to `opacity:0;
    // translateY(16px)` and only fades in on intersection. A `fullPage` capture
    // renders the whole document height at once, so off-screen sections never
    // intersect — they would freeze INVISIBLE and the baseline would show only the
    // hero + footer. Emulating `prefers-reduced-motion: reduce` drives the island's
    // `prefersReduced` branch (sections stay `revealed=true`) AND triggers the CSS
    // belt-and-suspenders fallback `.tmpl-reveal { opacity:1 !important }` (theme.css),
    // so ALL body sections render visible with ZERO entrance motion — the canonical
    // reduced-motion render, identical before and after the Plan 02 chrome strip.
    // (`reducedMotion` is a BrowserContext option in @playwright/test 1.60, so it is
    // set via `contextOptions`, not as a top-level `use` key.)
    contextOptions: {
      reducedMotion: 'reduce',
    },
  },
  // Deterministic visual-regression defaults (D-01 — Phase 08 parity harness).
  // The baseline AND the diff both run on the founder's Win11 local machine, so
  // cross-OS font rendering is NOT a flake source; the only remaining flake
  // sources are font-load timing (handled per-test via `document.fonts.ready`)
  // and animations (frozen here). These defaults make `toHaveScreenshot` stable:
  //   - animations:'disabled' freezes CSS animations/transitions at end-state
  //     (already the Playwright default; pinned explicitly for clarity).
  //   - caret:'hide' removes the blinking text caret (a non-deterministic pixel).
  //   - scale:'css' keeps DPR-independent CSS pixels on the founder's display.
  //   - maxDiffPixelRatio:0.01 caps the OVERALL diff ratio so sub-pixel
  //     anti-alias noise never fails the gate, but a real layout shift does.
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.01,
    },
  },
  // Stable baseline location under `e2e/__screenshots__/`. Playwright appends the
  // platform suffix automatically, so the founder's Win11 baselines stay isolated.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
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
