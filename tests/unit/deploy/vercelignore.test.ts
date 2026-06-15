/**
 * LAUNCH-01 / LAUNCH-10 / D-02 / D-03 — the committed `.vercelignore` membership gate.
 *
 * When a `.vercelignore` exists, the Vercel CLI uses it INSTEAD of `.gitignore` (the two are
 * NOT merged — orchestrator-confirmed Vercel CLI precedence finding). So the committed file
 * must be self-sufficient: it explicitly re-covers `.env.local`/`.env.*.local` so a prod
 * deploy never leaks a secret (T-23-04), AND it must NOT exclude anything the build or runtime
 * needs (the build/`prebuild` runs `scripts/check-env.mjs`; `public/` serves `og-default.png`
 * + the Inter `.ttf` fonts + the landing showcase `webp`).
 *
 * This test parses the committed `.vercelignore` into its effective glob set (stripping comment
 * and blank lines so header prose never self-invalidates an assertion) and asserts:
 *   1. the leak-safety / lean-upload INCLUDE set is present;
 *   2. the must-ship set is ABSENT (never excluded);
 *   3. no `vercel.json` / `vercel.ts` exists at the repo root (D-03 — headers stay in
 *      `next.config.ts`; a `vercel.json` would duplicate/diverge).
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

  // Test 1 — the INCLUDE set (planning/docs/db/tests + the re-covered secrets/local caches).
  it('EXCLUDES planning, docs, db migrations, tests, local env + caches (leak-safe, lean)', () => {
    const lines = parseVercelIgnore();
    const mustExclude = [
      '.planning/',
      'docs/',
      'supabase/',
      'tests/',
      'e2e/',
      '.env.local',
      '.env.*.local',
      '*.log',
      '.lighthouseci/',
    ];
    for (const entry of mustExclude) {
      expect(lines, `.vercelignore must list "${entry}"`).toContain(entry);
    }
  });

  // Test 2 — the MUST-SHIP set: anything the build/runtime needs must NOT be excluded.
  it('does NOT exclude anything the build or runtime needs to ship', () => {
    const lines = parseVercelIgnore();
    const mustShip = [
      'scripts/', // the build/prebuild runs scripts/check-env.mjs
      'src/',
      'public/', // serves og-default.png + Inter .ttf + landing showcase *.webp
      'next.config.ts',
      'package.json',
      '.env.example',
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
