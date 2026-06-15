/**
 * T-21-01 — RESEND_API_KEY client-bundle secret-wall assertion (Plan 21-01).
 *
 * Extends the existing service-role-key `.next/static` grep to the Resend secret
 * (RESEARCH:533 / :560). Phase 21 wires `notifyOwnerOfMessage` to Resend via a new
 * `src/lib/trust/resend.ts` whose FIRST line is `import 'server-only'` (the compile-
 * time wall that turns any client-component import into a build error). This test is
 * the REGRESSION BACKSTOP for that wall: it scans every emitted client chunk under
 * `.next/static` and asserts NO Resend secret leaked into a browser bundle.
 *
 * Resend API keys are `re_`-prefixed (verified against the Resend Node SDK docs:
 * `new Resend('re_xxxxxxxxx')`). The assertion is two-pronged:
 *   1. If `RESEND_API_KEY` is set in the env at test time, its LITERAL value must
 *      not appear in any client chunk (the exact secret never ships).
 *   2. Unconditionally, no `re_`-prefixed secret-shaped token appears in any client
 *      chunk (catches a hardcoded/derived key even when the env is unset here).
 *
 * ── RED-TOLERANT / SKIP-WHEN-NO-BUILD ─────────────────────────────────────────
 * The scan needs a production build. When `.next/static` is ABSENT (no `npm run
 * build` has run in this env), the test SKIPS with a clear message rather than
 * false-passing or false-failing — mirroring the build-test posture
 * (`tests/build/route-table-ssg.test.ts`). Run `npm run build` (or
 * `npm run check:bundle`) before this in CI to exercise the real assertion.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const STATIC_DIR = path.resolve(process.cwd(), '.next', 'static');

/** Recursively collect every `.js` file under a directory. */
function collectJsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectJsFiles(full));
    } else if (entry.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

// A `re_`-prefixed Resend-secret shape: `re_` + ≥16 base62-ish chars. Deliberately
// narrow so it matches a real key but not arbitrary identifiers that happen to start
// with "re" (e.g. `require`, `result`) — those lack the `re_<long-token>` shape.
const RESEND_SECRET_SHAPE = /\bre_[A-Za-z0-9]{16,}\b/;

describe('T-21-01 — RESEND_API_KEY is absent from the client bundle (.next/static)', () => {
  const hasBuild = existsSync(STATIC_DIR);

  it.skipIf(!hasBuild)(
    'no client chunk contains the RESEND_API_KEY value or a re_-prefixed secret',
    () => {
      const files = collectJsFiles(STATIC_DIR);
      // A build with zero client JS would make this vacuous — guard against that.
      expect(files.length).toBeGreaterThan(0);

      const literalKey = process.env.RESEND_API_KEY?.trim();

      for (const file of files) {
        const text = readFileSync(file, 'utf8');

        // (1) The exact secret value (when known) must never appear.
        if (literalKey && literalKey.length > 0) {
          expect(
            text.includes(literalKey),
            `RESEND_API_KEY value leaked into client chunk: ${path.relative(process.cwd(), file)}`,
          ).toBe(false);
        }

        // (2) No re_-prefixed secret-shaped token in any client chunk.
        const m = text.match(RESEND_SECRET_SHAPE);
        expect(
          m,
          `A Resend re_-prefixed secret leaked into client chunk ${path.relative(
            process.cwd(),
            file,
          )}: ${m?.[0] ?? ''}`,
        ).toBeNull();
      }
    },
  );

  it('documents the skip condition when no production build exists', () => {
    if (!hasBuild) {
      // Not a failure — the binding assertion above is skipped until a build exists.
      // Run `npm run build` (or `npm run check:bundle`) first to exercise the real grep.
      expect(existsSync(STATIC_DIR)).toBe(false);
    } else {
      expect(existsSync(STATIC_DIR)).toBe(true);
    }
  });
});
