/**
 * PIPE-02 / D-06 — doc-vs-reality token drift guard (Wave-0 gate).
 *
 * Proves the contract's `REQUIRED_TOKENS` (`src/components/templates/contract.ts`) is
 * not aspirational: every required token is ACTUALLY defined by BOTH live templates.
 * If `contract.ts` ever lists a token neither/one template defines, OR a template
 * drops a required token, this test goes RED with a per-token, per-file failure hint.
 *
 * Provenance split (D-06 — load-bearing):
 *   - 18 of the 19 required tokens are COLOUR/RADIUS roles defined as literal `--name:`
 *     declarations in each template's scoped `theme.css` (`.tmpl-minimal` /
 *     `.tmpl-editorial` blocks). Assert each appears as a `--name:` declaration in BOTH
 *     `theme.css` files.
 *   - 3 of the 19 are the `--font-*` TYPE roles. These are set via `next/font`
 *     `variable: '--font-…'` in each template's `fonts.ts` (NOT as literal `--name:`
 *     declarations in `theme.css` text — next/font injects them onto the root element).
 *     Assert each `--font-*` token is bound via `variable:` in BOTH templates' `fonts.ts`
 *     (the documented next/font exemption — RESEARCH § D-06).
 *
 * Mirrors the static-source-read shape of `tests/build/route-table-ssg.test.ts`
 * (`readFileSync` + assert on contents) + the import-the-const shape of
 * `tests/unit/templates/mismatch.test.ts`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { REQUIRED_TOKENS } from '@/components/templates/contract';

const TEMPLATES_DIR = path.resolve('src/components/templates');

/** Resolve a template file to its absolute path + read it once. */
function readTemplateFile(slug: string, file: string): string {
  return readFileSync(path.join(TEMPLATES_DIR, slug, file), 'utf8');
}

const MINIMAL_THEME = readTemplateFile('minimal', 'theme.css');
const EDITORIAL_THEME = readTemplateFile('editorial', 'theme.css');
const MINIMAL_FONTS = readTemplateFile('minimal', 'fonts.ts');
const EDITORIAL_FONTS = readTemplateFile('editorial', 'fonts.ts');

/** The 3 type-role tokens set via next/font `variable:` (NOT literal in theme.css). */
const FONT_TOKENS = new Set(['--font-display', '--font-body', '--font-mono']);

/** True iff `token` appears as a CSS custom-property DECLARATION (`--name:`) in `css`. */
function declaresToken(css: string, token: string): boolean {
  // A declaration is `--name:` (the colon is what distinguishes a definition from a
  // `var(--name)` reference). Escape the leading dashes for the RegExp.
  const escaped = token.replace(/[-]/g, '\\-');
  return new RegExp(`${escaped}\\s*:`).test(css);
}

/** True iff `token` is bound via `next/font` `variable: '--name'` in `fontsSrc`. */
function bindsFontVariable(fontsSrc: string, token: string): boolean {
  // next/font face: `variable: '--font-display'` (single or double quotes).
  const escaped = token.replace(/[-]/g, '\\-');
  return new RegExp(`variable:\\s*['"]${escaped}['"]`).test(fontsSrc);
}

describe('PIPE-02 / D-06 — REQUIRED_TOKENS are defined in both live templates', () => {
  it('declares exactly 18 required tokens (the minimal ∩ editorial intersection)', () => {
    // 11 colour roles + 3 type roles + 4 radius roles = 18 (the verified intersection
    // of the two live theme.css token vocabularies — D-06).
    expect(REQUIRED_TOKENS).toHaveLength(18);
    // Spot-check the load-bearing names the contract acceptance criteria call out.
    expect(REQUIRED_TOKENS).toContain('--bg');
    expect(REQUIRED_TOKENS).toContain('--fg');
    expect(REQUIRED_TOKENS).toContain('--accent');
    expect(REQUIRED_TOKENS).toContain('--ring');
    expect(REQUIRED_TOKENS).toContain('--font-display');
    expect(REQUIRED_TOKENS).toContain('--font-mono');
    expect(REQUIRED_TOKENS).toContain('--radius-full');
  });

  describe.each([...REQUIRED_TOKENS])('token %s', (token) => {
    if (FONT_TOKENS.has(token)) {
      // Type-role token: defined via next/font `variable:` in fonts.ts (D-06 exemption).
      it('is bound via next/font `variable:` in minimal/fonts.ts', () => {
        expect(
          bindsFontVariable(MINIMAL_FONTS, token),
          `REQUIRED font token "${token}" is not bound via a next/font \`variable: '${token}'\` ` +
            'declaration in src/components/templates/minimal/fonts.ts (D-06: font tokens are set ' +
            'by next/font, not as literal theme.css declarations).',
        ).toBe(true);
      });
      it('is bound via next/font `variable:` in editorial/fonts.ts', () => {
        expect(
          bindsFontVariable(EDITORIAL_FONTS, token),
          `REQUIRED font token "${token}" is not bound via a next/font \`variable: '${token}'\` ` +
            'declaration in src/components/templates/editorial/fonts.ts.',
        ).toBe(true);
      });
    } else {
      // Colour/radius role: defined as a literal `--name:` declaration in theme.css.
      it('is declared in minimal/theme.css', () => {
        expect(
          declaresToken(MINIMAL_THEME, token),
          `REQUIRED token "${token}" is not declared (\`${token}:\`) in ` +
            'src/components/templates/minimal/theme.css — a conforming template MUST define ' +
            'every REQUIRED_TOKEN in its scoped theme.css.',
        ).toBe(true);
      });
      it('is declared in editorial/theme.css', () => {
        expect(
          declaresToken(EDITORIAL_THEME, token),
          `REQUIRED token "${token}" is not declared (\`${token}:\`) in ` +
            'src/components/templates/editorial/theme.css.',
        ).toBe(true);
      });
    }
  });
});
