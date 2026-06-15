/**
 * scripts/check-env.mjs — the LAUNCH-05 production env preflight (D-08; Plan 23-02,
 * Task 2). Mirrors the committed fail-closed structure of
 * `scripts/check-bundle-budget.ts`: a `fail(message): never` helper, an exported pure
 * unit-testable predicate, a prod-scope guard, and a `pathToFileURL` direct-run guard
 * so importing this module (e.g. the unit test) never runs `main()` / `process.exit`.
 *
 * WHAT IT DOES — runs in the Vercel build (wired via the `prebuild` npm lifecycle
 * script, so `build` stays `next build` UNCHANGED — OQ-3) with the dashboard-set
 * Production env vars injected, so it verifies the DEPLOYED environment, not just a
 * local `.env.local`. It HARD-FAILS the build (exit 1) if any REQUIRED secret is
 * missing, and WARNS-ONLY (never fails) on the degrade-open key(s).
 *
 *   • Required (hard-fail) — mirrors the `.env.example` key inventory:
 *       NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *       SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL,
 *       NEXT_PUBLIC_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY,
 *       REPORT_IP_HASH_SECRET, RESEND_API_KEY, RESEND_FROM_EMAIL.
 *   • Warn-only (degrade-open) — VERCEL_OIDC_TOKEN (BotID degrades-open on its
 *       absence; a missing token must NEVER block the build).
 *
 * SCOPED TO PRODUCTION — it NO-OPS (exit 0) unless `VERCEL_ENV === 'production'`, so
 * local `npm run build` and Vercel PREVIEW builds are never blocked. `VERCEL_ENV` is a
 * Vercel-injected system env var (`production` | `preview` | `development`); when it's
 * absent (a plain local build) the gate skips — the safe degrade.
 *
 * ── SECURITY (T-23-07) ────────────────────────────────────────────────────────
 * This script logs key NAMES + present/MISSING ONLY — it NEVER logs a secret VALUE.
 * `fail()` interpolates only key names. Build logs are visible in the Vercel
 * dashboard; echoing a value would be an information-disclosure leak (the CI also
 * greps `.next/static` for the service-role key — never let a secret reach a log).
 *
 * THIS IS NOT RUNTIME APP CODE — it is a build/CI gate, never imported by the app, so
 * it does NOT need `import 'server-only'` (it touches env presence, never a value).
 *
 * USAGE:  node scripts/check-env.mjs    (runs automatically as `prebuild` before `build`)
 */
import { pathToFileURL } from 'node:url';

/** The hard-fail required keys — mirrors the `.env.example` inventory (single source). */
export const REQUIRED_KEYS = [
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

/** Degrade-open keys — warn (never fail) if absent (BotID degrades-open). */
export const WARN_ONLY_KEYS = ['VERCEL_OIDC_TOKEN'];

/**
 * The fail-closed exit helper (mirrors `check-bundle-budget.ts` `fail()`). Interpolates
 * ONLY key names / messages — NEVER a secret VALUE (T-23-07).
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`\n[check:env] FAIL: ${message}\n`);
  process.exit(1);
}

/**
 * PURE, exported, unit-testable predicate: return the NAMES of the required keys that
 * are absent / empty / whitespace-only in `env`. Does NOT `process.exit` (so a test can
 * import + assert it). Treats undefined, '', and whitespace-only as MISSING (trimmed).
 * @param {Record<string, string | undefined>} env
 * @param {string[]} required
 * @returns {string[]}
 */
export function findMissingRequiredKeys(env, required) {
  return required.filter((k) => {
    const v = env[k];
    return v === undefined || v.trim() === '';
  });
}

/**
 * PURE, exported scope predicate: the preflight runs ONLY on a Vercel PRODUCTION build.
 * Local builds (no `VERCEL_ENV`) and PREVIEW builds skip — so `npm run build` is never
 * blocked off-prod.
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function shouldRunPreflight(env) {
  return env.VERCEL_ENV === 'production';
}

function main() {
  // Prod-scope guard — no-op (exit 0) off production so local/preview builds aren't blocked.
  if (!shouldRunPreflight(process.env)) {
    console.log(
      `[check:env] VERCEL_ENV != production (got ${process.env.VERCEL_ENV ?? 'unset'}) — ` +
        'preflight skipped (local/preview build).',
    );
    process.exit(0);
  }

  console.log('[check:env] VERCEL_ENV=production — verifying required secrets are present.');

  const missing = findMissingRequiredKeys(process.env, REQUIRED_KEYS);
  const missingSet = new Set(missing);

  // Log each required key as present / MISSING — NAME ONLY, never the value (T-23-07).
  for (const key of REQUIRED_KEYS) {
    console.log(`[check:env]   ${missingSet.has(key) ? 'MISSING ' : 'present '} ${key}`);
  }

  // Degrade-open keys: WARN only (never fail) — a missing BotID token must not block.
  for (const key of WARN_ONLY_KEYS) {
    const v = process.env[key];
    if (v === undefined || v.trim() === '') {
      console.warn(
        `[check:env]   WARN (degrade-open) ${key} is not set — BotID degrades open; not blocking.`,
      );
    } else {
      console.log(`[check:env]   present ${key}`);
    }
  }

  if (missing.length > 0) {
    // List the missing key NAMES only — never a secret VALUE.
    fail(
      `${missing.length} required env var(s) MISSING in the production build: ${missing.join(', ')}. ` +
        'Set them in the Vercel project (Settings > Environment Variables, Production) and redeploy. ' +
        'See .env.example + docs/runbooks/launch.md for where each value is obtained.',
    );
  }

  console.log(
    `\n[check:env] OK — all ${REQUIRED_KEYS.length} required production secrets are present.\n`,
  );
}

/**
 * CLI-ONLY tail. Guarded so importing this module (the unit test importing
 * `findMissingRequiredKeys` / `shouldRunPreflight`) does NOT run `main()` / `process.exit`.
 * `import.meta.url` matches the process entry only when run directly via
 * `node scripts/check-env.mjs` (the `prebuild` script).
 */
const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main();
}
