/**
 * EDIT-04 / T-27-03 — the "no NEW XSS surface" guard (Phase 27, Wave 0).
 *
 * Phase 27 is explicitly NOT WYSIWYG: writes flow ONLY through the structured save path,
 * with NO inline `contenteditable` and NO new `dangerouslySetInnerHTML`. The single
 * sanctioned `dangerouslySetInnerHTML` in the codebase is the sanitized blog-Markdown
 * path — this phase must add NONE. This guard greps every Phase-27 module (the
 * `src/lib/preview/*` contract + resolver, and the Plan-02 `(portfolio)` bridge once it
 * lands) for both tokens and asserts ZERO matches. `stripComments` first so a doc comment
 * NAMING the banned token (this header included) never false-positives.
 *
 * Green NOW over the existing preview modules; stays binding as Plan 02/03 add the bridge.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/** Strip block + line comments so prose naming a banned token never false-positives. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** The Phase-27 module set: the preview lib dir + the (portfolio) bridge candidates. */
function collectPhase27Sources(): { name: string; source: string }[] {
  const files: string[] = [];

  // The src/lib/preview/* contract + resolver (exist as of Plan 01).
  const previewDir = path.resolve('src/lib/preview');
  if (existsSync(previewDir)) {
    for (const f of readdirSync(previewDir)) {
      if (f.endsWith('.ts') || f.endsWith('.tsx')) files.push(path.join(previewDir, f));
    }
  }

  // The Plan-02 (portfolio) bridge island(s) — globbed loosely so the exact filename is
  // Plan 02's discretion; absent until then.
  const portfolioDir = path.resolve('src/components/portfolio');
  if (existsSync(portfolioDir)) {
    for (const f of readdirSync(portfolioDir)) {
      if (/^edit-preview-bridge.*\.(ts|tsx)$/.test(f)) files.push(path.join(portfolioDir, f));
    }
  }

  return files
    .filter((p) => existsSync(p) && statSync(p).isFile())
    .map((p) => ({ name: path.relative(process.cwd(), p), source: stripComments(readFileSync(p, 'utf8')) }));
}

const BANNED: { label: string; pattern: RegExp; why: string }[] = [
  {
    label: '`dangerouslySetInnerHTML`',
    pattern: /dangerouslySetInnerHTML/,
    why: 'Phase 27 adds NO new HTML-injection surface; the only sanctioned use is the sanitized blog path (EDIT-04)',
  },
  {
    label: '`contenteditable`',
    pattern: /content[Ee]ditable/,
    why: 'Phase 27 is NOT WYSIWYG — no inline-editable user content on the shared multi-tenant domain (EDIT-04)',
  },
];

const sources = collectPhase27Sources();

describe('EDIT-04 / T-27-03 — Phase-27 modules introduce no new XSS surface', () => {
  it('finds Phase-27 source files to scan (the preview lib dir at minimum)', () => {
    expect(
      sources.length,
      'no Phase-27 sources found to scan — expected at least src/lib/preview/*.ts.',
    ).toBeGreaterThan(0);
  });

  describe.each(sources)('$name', ({ name, source }) => {
    it.each(BANNED)('contains no $label', ({ pattern, label, why }) => {
      expect(pattern.test(source), `${name} contains ${label} — banned: ${why}.`).toBe(false);
    });
  });
});
