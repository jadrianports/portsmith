import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

/**
 * Vitest 4 two-project config (verified against the installed vitest@4.1.7 type
 * definitions — see the API note below).
 *
 *   - `unit`        — fast, no I/O. Zod schemas + pure helpers. `node` env.
 *   - `integration` — RLS tests against a real local Supabase stack. `node` env
 *                     (NOT jsdom — 01-RESEARCH.md Pitfall 4), forced sequential
 *                     so concurrent files can't collide on FK/unique constraints
 *                     or bleed auth sessions against the single shared DB.
 *
 * VITEST 4 API NOTE (breaking change vs v2/v3):
 *   The old per-pool knob `poolOptions.threads.singleThread` was REMOVED in
 *   Vitest 4 — it does not exist in the v4 config types. The v4-correct way to
 *   force fully-sequential execution is:
 *     - `fileParallelism: false` — runs test FILES one at a time. Per the v4
 *       types this also overrides `maxWorkers` to 1.
 *     - `sequence.concurrent: false` — keeps tests WITHIN a file sequential
 *       (the default, set explicitly here for intent).
 *     - `maxWorkers: 1` — belt-and-suspenders single worker.
 *   Together these are the v4 replacement for `singleThread: true`.
 *
 * LOCAL-STACK ENV (chosen source: dotenv):
 *   The integration project reads SUPABASE_URL / SUPABASE_ANON_KEY /
 *   SUPABASE_SERVICE_ROLE_KEY from the process env. Locally those come from
 *   `supabase start` output (export them, or drop them in `.env.test` /
 *   `.env.local`); in CI they're exported from `supabase status -o env`. We load
 *   `.env.local` here via dotenv so a developer who has the local stack running
 *   doesn't need to re-export by hand. `tests/integration/_setup.ts` reads the
 *   same variables — keep the two in sync.
 */
loadEnv({ path: '.env.local' });

/**
 * Mirror the tsconfig `@/*` -> `./src/*` path alias so tests can import via the
 * same `@/lib/...` surface the app uses. Vitest does NOT read tsconfig `paths`
 * automatically. With `test.projects`, each inline project is its OWN Vite config
 * and does NOT inherit a root-level `resolve.alias` — so the alias is applied
 * inside every project (see https://vitest.dev/guide/projects).
 */
const resolve = {
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
    // `server-only` resolves to a client-throwing guard under Vitest's `node`
    // environment (no `react-server` export condition), which would break importing
    // any server module (e.g. `get-portfolio-owner.ts`) to assert its RUNTIME
    // behavior. Alias it to a no-op stub for tests only — the production import
    // guard and the FND-05 `.next/static` secret grep are unaffected.
    'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
  },
};

export default defineConfig({
  resolve,
  test: {
    projects: [
      {
        // --- Unit: fast, no I/O (Zod schemas, pure helpers) ---
        // Also runs the `tests/build/**` SSG build-route assertion (D-22): a
        // node-env, no-network test that reads the production `.next` prerender
        // manifest (06-01, Task 3). It lives under tests/build for discoverability
        // (mirrors the 04-01 e2e-in-./e2e decision) and shares the unit project's
        // fast node env + the @/* alias.
        resolve,
        test: {
          name: 'unit',
          environment: 'node',
          // `.test.tsx` is collected too (13-06): the skills-`level` editor's pure
          // save helpers live in a `.tsx` client module; the render-FREE test imports
          // them (the storage-meter precedent — no DOM, the `node` env stands, no
          // jsdom/testing-library dependency added). esbuild transpiles the `.tsx`.
          include: [
            'tests/unit/**/*.test.ts',
            'tests/unit/**/*.test.tsx',
            // 25-01: colocated pure-render template helper specs (the shared
            // SocialIcon module lives beside the components it serves). Same fast
            // `node` env + @/* alias; exercised render-free via react-dom/server
            // `renderToStaticMarkup` (NO jsdom/testing-library — the project
            // convention). esbuild transpiles the `.tsx`.
            'src/components/templates/**/*.test.tsx',
            'tests/build/**/*.test.ts',
            // 20-01: the dynamic-share-image unit tests (pure accent map + D-06 URL
            // builder) — same fast node env + @/* alias as tests/unit (no I/O, no DOM).
            'tests/og/**/*.test.ts',
            'tests/og/**/*.test.tsx',
            // 20-03: the public-metadata image-ladder + Twitter-card unit test
            // (SHARE-03/D-06) — pure, env-pinned, same fast node env + @/* alias.
            'tests/seo/**/*.test.ts',
          ],
        },
      },
      {
        // --- Integration: RLS against local Supabase, strictly sequential ---
        resolve,
        test: {
          name: 'integration',
          environment: 'node', // NOT jsdom (Pitfall 4)
          include: ['tests/integration/**/*.test.ts'],
          // _setup.ts is a helper module, not a spec — never run it as a test file.
          exclude: ['tests/integration/_setup.ts'],
          // Sequential execution (Vitest 4 spelling — see API NOTE above).
          fileParallelism: false,
          maxWorkers: 1,
          sequence: {
            concurrent: false,
          },
        },
      },
    ],
  },
});
