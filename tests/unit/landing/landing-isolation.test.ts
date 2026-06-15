/**
 * D-01 / LAND-03 (Phase 22, Plan 22-01, Wave 0) — the two-layer-isolation guard for the
 * landing-page component folder `src/components/landing/**`.
 *
 * THE GATE GAP (RESEARCH Pitfall 4 — VERIFIED): the existing token/isolation gates scan ONLY
 * `src/components/templates` (`token-conformance.test.ts:33` hardcodes
 * `path.resolve('src/components/templates')`; `kit-isolation.test.ts:31` scans `_kit`). NONE
 * of them cover the NEW `src/components/landing/` folder. So a stray template-token leak there
 * would go unnoticed — this is the ONLY guard for it (D-01).
 *
 * The landing page is platform CHROME (it lives in the `(chrome)` route group), bound by the
 * two-layer UI identity rule: it consumes ONLY the Evergreen/Copper `@theme` tokens + Inter,
 * and imports NO portfolio-template token or component. This guard statically asserts every
 * file under `src/components/landing/**` contains NONE of:
 *   1. a `tmpl-` substring — no `.tmpl-*` template token (those belong to the scoped portfolio
 *      template layer, never chrome).
 *   2. a `#`-hex literal — no inline hex; every colour resolves through a chrome `@theme`
 *      token. (The ONLY sanctioned hex in the codebase is `globals.css`, which is OUT of this
 *      folder.)
 *   3. an import from `components/templates` — no portfolio-template component import.
 *
 * Mirrors the static-source-read + comment-strip idiom of
 * `tests/unit/templates/token-conformance.test.ts` / `kit-isolation.test.ts` (the BANNED-list
 * + `describe.each`/`it.each` per-file/per-rule shape, each with a file-named failure hint).
 *
 * ── RED-TOLERANT / GREEN-ON-ABSENT ────────────────────────────────────────────
 * When `src/components/landing/` does not exist yet (or is empty), this scans ZERO files and
 * PASSES — it goes RED only when a VIOLATING file appears. So it is safe to commit before any
 * landing UI is built (this plan), and it becomes the binding guard as Plans 03–04 populate the
 * folder. T-22-02.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const LANDING_DIR = path.resolve('src/components/landing');

/**
 * Strip comments (block `/* … *\/` + line `// …`) before scanning so a token/hex/import NAMED
 * in a COMMENT (e.g. a doc-comment that explains the two-layer rule) does not false-trip the
 * guard. Reused verbatim from `token-conformance.test.ts:43-47` / `kit-isolation.test.ts:42-46`.
 * String literals are deliberately NOT stripped — a `tmpl-`/hex/import inside a real code
 * string IS the violation we want to catch.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (avoid eating `://` in URLs)
}

/** Recursively collect every `.ts`/`.tsx`/`.css` source file under `dir` (relative names). */
function walkSourceFiles(dir: string, prefix = ''): { name: string; abs: string }[] {
  if (!existsSync(dir)) return []; // GREEN-ON-ABSENT: no landing folder yet → zero files, pass.
  const out: { name: string; abs: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkSourceFiles(abs, rel));
    } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
      out.push({ name: rel, abs });
    }
  }
  return out;
}

/** Every source file under `src/components/landing/**`, read once (comments stripped). */
const landingFiles: { name: string; source: string }[] = walkSourceFiles(LANDING_DIR).map(
  ({ name, abs }) => ({ name, source: stripComments(readFileSync(abs, 'utf8')) }),
);

/**
 * Each guard = a named banned pattern + the rationale. A file matching it fails with a hint
 * naming the file + the rule it broke + WHY it is banned (D-01 two-layer isolation).
 */
const BANNED: { label: string; pattern: RegExp; why: string }[] = [
  {
    label: 'a `tmpl-` template token',
    pattern: /tmpl-/,
    why: 'the landing page is chrome (D-01) — `.tmpl-*` tokens belong to the scoped portfolio template layer, never chrome',
  },
  {
    label: 'an inline `#`-hex colour literal',
    pattern: /#[0-9a-fA-F]{3,8}\b/,
    why: 'no inline hex (D-01) — every colour resolves through a chrome `@theme` token; the only sanctioned hex is globals.css',
  },
  {
    label: 'an import from `components/templates`',
    pattern: /from\s+['"][^'"]*components\/templates/,
    why: 'the landing page imports NO portfolio-template component (D-01 two-layer wall)',
  },
];

describe('D-01 / LAND-03 — src/components/landing/** is two-layer-isolated (no template leak)', () => {
  it('passes with zero violations when the landing folder is absent or empty (green-on-absent)', () => {
    // This guard is intentionally satisfiable before any landing UI exists: a missing/empty
    // folder yields zero files to scan. It goes RED only when a VIOLATING file appears.
    expect(Array.isArray(landingFiles)).toBe(true);
  });

  if (landingFiles.length === 0) {
    it('scans zero landing files (folder absent/empty) — nothing to violate', () => {
      expect(landingFiles.length).toBe(0);
    });
  } else {
    describe.each(landingFiles)('landing/$name', ({ name, source }) => {
      it.each(BANNED)('contains no $label', ({ pattern, label, why }) => {
        expect(
          pattern.test(source),
          `src/components/landing/${name} contains ${label} — banned: ${why}.`,
        ).toBe(false);
      });
    });
  }
});
