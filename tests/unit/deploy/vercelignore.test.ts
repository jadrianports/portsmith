/**
 * LAUNCH-01 / LAUNCH-10 / D-02 / D-03 — the committed `.vercelignore` membership gate.
 *
 * When a `.vercelignore` exists, the Vercel CLI uses it INSTEAD of `.gitignore` (the two are
 * NOT merged). Vercel uploads the WORKING TREE and then runs `next build`, which TYPE-CHECKS
 * the whole tsconfig project. So the committed file must:
 *   1. exclude the large local-only `.planning/` corpus (gitignored locally, but the
 *      working-tree upload would otherwise ship it) and re-cover local env/caches so a prod
 *      deploy never leaks a secret (T-23-04);
 *   2. NOT exclude any directory that type-checked code references. This is load-bearing and
 *      was learned the hard way at launch — two Vercel-only build breaks the local build can
 *      never catch (because nothing is excluded locally):
 *        (a) an unanchored `supabase/` recursively matched `src/lib/supabase/`;
 *        (b) excluding `e2e/` broke the type-check because the shipped `scripts/` (needed for
 *            the `prebuild` `check-env.mjs`) imports from `e2e/` (preview-template.ts).
 *      So the policy is: exclude ONLY `.planning/` + local env/caches; ship everything else
 *      tracked in git (src/, scripts/, public/, docs/, supabase/, tests/, e2e/).
 *   3. carry NO `vercel.ts`, and any `vercel.json` may ONLY hold deploy-control `git`
 *      settings (DEPLOY-01: `git.deploymentEnabled.main=false` makes the CI `deploy` job
 *      the sole, gated deploy path). Headers / rewrites / redirects / routes still live in
 *      `next.config.ts` — D-03's actual intent (no header/routing config drift into a
 *      platform file), which a git-only vercel.json preserves.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const VERCELIGNORE = join(ROOT, '.vercelignore');

/** Parse the file into its effective glob lines — drop `#` comments + blank lines. */
function parseVercelIgnore(): string[] {
  const raw = readFileSync(VERCELIGNORE, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

describe('LAUNCH-01/10 / D-02 — .vercelignore is self-sufficient + leak-safe', () => {
  it('exists at the repo root', () => {
    expect(existsSync(VERCELIGNORE)).toBe(true);
  });

  // Test 1 — excludes the local-only planning corpus + re-covers local env/caches.
  it('EXCLUDES the local-only .planning corpus + local env/caches (leak-safe)', () => {
    const lines = parseVercelIgnore();
    const mustExclude = [
      '/.planning/', // anchored to root so it can't recursively match a nested dir
      '.env.local',
      '.env.*.local',
      '*.log',
      '.lighthouseci/',
    ];
    for (const entry of mustExclude) {
      expect(lines, `.vercelignore must list "${entry}"`).toContain(entry);
    }
  });

  // Test 2 — the MUST-SHIP set: anything the build/runtime/type-check needs must NOT be
  // excluded. Includes docs/supabase/tests/e2e because shipped scripts/ type-check against
  // them (regression guard for the two launch build-breaks).
  it('does NOT exclude anything the build, runtime, or type-check needs', () => {
    const lines = parseVercelIgnore();
    const mustShip = [
      'scripts/', // the build/prebuild runs scripts/check-env.mjs
      'src/',
      'public/', // serves og-default.png + Inter .ttf + landing showcase *.webp
      'next.config.ts',
      'package.json',
      '.env.example',
      // Excluding any of these broke (or would break) the Vercel type-check because shipped
      // scripts/src files reference them — they MUST ship. Guard every spelling (bare +
      // root-anchored) so a future edit can't silently reintroduce the break.
      'docs/',
      '/docs/',
      'supabase/',
      '/supabase/',
      'tests/',
      '/tests/',
      'e2e/',
      '/e2e/',
    ];
    for (const entry of mustShip) {
      expect(lines, `.vercelignore must NOT exclude "${entry}"`).not.toContain(entry);
    }
  });

  // Test 3 — D-03 (narrowed for DEPLOY-01): vercel.ts stays banned; a vercel.json is
  // permitted ONLY to carry deploy-control `git` settings. Headers/routes/rewrites must
  // NOT appear here — they live in next.config.ts (D-03's intent: no config drift).
  it('vercel.ts is absent; vercel.json (if present) carries ONLY $schema + git (D-03)', () => {
    expect(existsSync(join(ROOT, 'vercel.ts'))).toBe(false);

    const vercelJson = join(ROOT, 'vercel.json');
    if (!existsSync(vercelJson)) return; // absent is still fine

    const cfg = JSON.parse(readFileSync(vercelJson, 'utf8')) as Record<string, unknown>;
    // The header/routing keys that MUST stay in next.config.ts (the D-03 hazard).
    const forbidden = [
      'headers',
      'rewrites',
      'redirects',
      'routes',
      'cleanUrls',
      'trailingSlash',
      'buildCommand',
      'functions',
    ];
    for (const key of forbidden) {
      expect(cfg, `vercel.json must NOT carry "${key}" (lives in next.config.ts — D-03)`).not.toHaveProperty(
        key,
      );
    }
    // Allowlist: only the schema pointer + the git deploy-control block.
    for (const key of Object.keys(cfg)) {
      expect(['$schema', 'git'], `vercel.json may only carry $schema + git (found "${key}")`).toContain(key);
    }
  });
});
