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

export default defineConfig({
  test: {
    projects: [
      {
        // --- Unit: fast, no I/O (Zod schemas, pure helpers) ---
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        // --- Integration: RLS against local Supabase, strictly sequential ---
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
