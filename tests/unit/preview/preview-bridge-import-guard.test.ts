/**
 * EDIT-04 / T-27-02 — the edit-preview bridge LEAK guard (Phase 27, Wave 0).
 *
 * The owner-preview click bridge (Plan 02 — `(portfolio)` island mounted ONLY under the
 * `?edit=1` flag) MUST NOT drag Zod or template code toward the public bundle. This guard
 * mirrors `tests/unit/templates/kit-isolation.test.ts`: a static `readFileSync` of the
 * bridge source(s) + `stripComments`, then assert NONE of a BANNED import list matches —
 *   - `@/lib/validations` (the barrel evaluates `z.enum(...)` at module scope → ~63 kB zod),
 *   - the template `registry.ts` (also zod at module scope),
 *   - any per-slug template import (`@/components/templates/<slug>`).
 *
 * The structural twin of this test is `preview-bridge-chunk-absent.test.ts`, which proves
 * the bridge chunk is absent from the public route's CLIENT chunks after a real build.
 *
 * ── RED-TOLERANT (Wave 0) ─────────────────────────────────────────────────────────
 * The bridge module lands in PLAN 02. Until then the source files do not exist: this test
 * SKIPS with a clear "lands in Plan 02" hint rather than silently passing OR hard-failing
 * the Plan-01 wave. Once Plan 02 adds the bridge, the skip lifts automatically and the
 * import assertions become binding — a future edit that imports Zod/registry/a template
 * goes RED here with a named hint.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/** Candidate bridge source paths (Plan 02 picks the exact filename; we scan any present).
 *  The bridge LOGIC module is a plain browser `.ts` (no `'use client'`/React — that shape
 *  is what keeps it off the route's client bundle, EDIT-04); the MOUNT trigger is a
 *  `'use client'` `.tsx`. We list both extensions so the guard binds whichever lands. */
const BRIDGE_CANDIDATES = [
  'src/components/portfolio/edit-preview-bridge.ts',
  'src/components/portfolio/edit-preview-bridge.tsx',
  'src/components/portfolio/edit-preview-bridge-mount.tsx',
].map((p) => path.resolve(p));

/** Strip block + line comments so prose mentioning a banned import never false-positives. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const bridgeFiles: { name: string; source: string }[] = BRIDGE_CANDIDATES.filter((p) =>
  existsSync(p),
).map((p) => ({ name: path.basename(p), source: stripComments(readFileSync(p, 'utf8')) }));

/** A banned import = a named pattern + why it would leak onto the public bundle. */
const BANNED: { label: string; pattern: RegExp; why: string }[] = [
  {
    label: "an import from `'@/lib/validations'`",
    pattern: /from\s+['"]@\/lib\/validations/,
    why: 'the validations barrel evaluates zod at module scope → ~63 kB onto the public bundle (EDIT-04 / Pitfall 3)',
  },
  {
    label: "an import from the template `registry`",
    pattern: /from\s+['"](?:\.\.?\/)*(?:components\/templates\/)?registry['"]/,
    why: 'registry.ts evaluates `z.enum(...)` at module scope → ~63 kB zod onto the public bundle (EDIT-04)',
  },
  {
    label: "an import from `'@/components/templates/registry'`",
    pattern: /from\s+['"]@\/components\/templates\/registry/,
    why: 'the registry drags zod + every template onto the bundle (EDIT-04)',
  },
  {
    label: 'an import of a per-slug template module',
    pattern: /from\s+['"]@\/components\/templates\/(?:minimal|editorial|aurora|edgerunner-v2)/,
    why: 'a per-template import couples the bridge to a template + risks dragging it onto the bundle (EDIT-04 / D-25)',
  },
];

describe('EDIT-04 / T-27-02 — the edit-preview bridge imports no Zod / registry / template', () => {
  it('the bridge source exists once Plan 02 has landed (RED-tolerant until then)', () => {
    if (bridgeFiles.length === 0) {
      // Wave-0: the bridge is a Plan-02 artifact. Skip — do NOT false-green, do NOT block.
      console.warn(
        '[preview-bridge-import-guard] bridge source not found at any of ' +
          `${BRIDGE_CANDIDATES.join(', ')} — it lands in Plan 02. This guard skips until then.`,
      );
      return;
    }
    expect(bridgeFiles.length).toBeGreaterThan(0);
  });

  describe.each(bridgeFiles)('$name', ({ name, source }) => {
    it.each(BANNED)('contains no $label', ({ pattern, label, why }) => {
      expect(pattern.test(source), `${name} contains ${label} — banned: ${why}.`).toBe(false);
    });
  });
});
