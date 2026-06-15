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
 *   3. have NO `vercel.json` / `vercel.ts` at the repo root (D-03 — headers stay in
 *      `next.config.ts`).
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

  // Test 3 — D-03: no vercel.json / vercel.ts (headers live in next.config.ts).
  it('has NO vercel.json / vercel.ts at the repo root (D-03)', () => {
    expect(existsSync(join(ROOT, 'vercel.json'))).toBe(false);
    expect(existsSync(join(ROOT, 'vercel.ts'))).toBe(false);
  });
});
