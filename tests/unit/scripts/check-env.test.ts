/**
 * Plan 23-02 / D-08 — the production env preflight predicate is correct + fail-closed.
 *
 * `scripts/check-env.mjs` is the build-time env gate that runs ON Vercel with the prod
 * env injected (LAUNCH-05): it HARD-FAILS the build (process.exit(1)) if any required
 * secret is missing, WARNS-ONLY on degrade-open keys, and — critically — NO-OPS off
 * `VERCEL_ENV=production` so a local/preview `npm run build` is never blocked.
 *
 * This test imports only the two PURE, exported predicates the gate is built from:
 *   - `findMissingRequiredKeys(env, required)` — returns the missing-key NAMES (the
 *     hard-fail decision), treating undefined / '' / whitespace-only as MISSING.
 *   - `shouldRunPreflight(env)` — the `VERCEL_ENV === 'production'` scope guard.
 *
 * It does NOT call `main()` — the module's `pathToFileURL` direct-run guard ensures
 * importing it here never runs the gate / `process.exit`. Testing the pure predicates
 * (not by spawning a process) keeps this a fast, no-I/O unit test, and it passes only
 * PLAIN objects (never a real secret) so no value is ever logged or leaked.
 */
import { describe, expect, it } from 'vitest';

import { findMissingRequiredKeys, shouldRunPreflight } from '../../../scripts/check-env.mjs';

/** The hard-fail required list, mirrored from `.env.example` (kept in sync with the gate). */
const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  'REPORT_IP_HASH_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
];

/** A fully-present env (placeholder values — never a real secret). */
const allPresentEnv: Record<string, string> = Object.fromEntries(
  REQUIRED.map((k) => [k, `placeholder-${k}`]),
);

describe('D-08 — findMissingRequiredKeys (the hard-fail decision)', () => {
  it('Test 1: an empty env returns the FULL required list (all missing)', () => {
    const missing = findMissingRequiredKeys({}, REQUIRED);
    expect(missing).toEqual(REQUIRED);
    // A non-empty missing list is what makes main() fail (exit non-zero).
    expect(missing.length).toBeGreaterThan(0);
  });

  it('Test 2: a fully-present env returns [] (nothing missing)', () => {
    expect(findMissingRequiredKeys(allPresentEnv, REQUIRED)).toEqual([]);
  });

  it("Test 3: a key set to '' or whitespace-only counts as MISSING (trimmed)", () => {
    const env = { ...allPresentEnv, SUPABASE_SERVICE_ROLE_KEY: '', TURNSTILE_SECRET_KEY: '   ' };
    const missing = findMissingRequiredKeys(env, REQUIRED);
    expect(missing).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(missing).toContain('TURNSTILE_SECRET_KEY');
    // The other keys are still present.
    expect(missing).toHaveLength(2);
  });
});

describe('D-08 — shouldRunPreflight (the VERCEL_ENV=production scope guard)', () => {
  it('Test 4: only VERCEL_ENV === "production" runs the preflight', () => {
    expect(shouldRunPreflight({ VERCEL_ENV: 'production' })).toBe(true);
    // Local / preview / undefined all SKIP (so a local build is never blocked).
    expect(shouldRunPreflight({ VERCEL_ENV: 'preview' })).toBe(false);
    expect(shouldRunPreflight({ VERCEL_ENV: 'development' })).toBe(false);
    expect(shouldRunPreflight({})).toBe(false);
  });
});
