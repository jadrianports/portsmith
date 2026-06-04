/**
 * PIPE-02 / D-06 + CICD-01 (token) — doc-vs-reality token-conformance guard, GENERALIZED
 * (Phase-10 Plan 03; was Phase-9 Wave-0).
 *
 * Proves the contract's `REQUIRED_TOKENS` (`src/components/templates/contract.ts`) is not
 * aspirational: every required token is ACTUALLY defined by EVERY REGISTERED template
 * (`Object.keys(templateRegistry)`), not just the two original hardcoded slugs — so a
 * Phase-11 ingested template auto-enters this gate with no edit. If `contract.ts` ever
 * lists a token a registered template doesn't define, OR a template drops a required
 * token, this goes RED with a per-token, per-slug failure hint.
 *
 * Provenance split (D-06 — load-bearing, PRESERVED EXACTLY):
 *   - 15 of the 18 required tokens are COLOUR/RADIUS roles defined as literal `--name:`
 *     declarations in each template's scoped `theme.css` (`.tmpl-<slug>` block).
 *   - 3 of the 18 are the `--font-*` TYPE roles, set via `next/font` `variable: '--font-…'`
 *     in each template's `fonts.ts` (NOT literal `--name:` declarations in theme.css text —
 *     next/font injects them onto the root element). The documented next/font exemption
 *     (RESEARCH § D-06) — do NOT regress it.
 *
 * Both polarities (D-P10-02): GREEN on every registered template (each defines all 18),
 * RED on `tests/fixtures/broken-template/` (its theme.css DROPS `--ring`).
 *
 * Mirrors the static-source-read shape of `tests/build/route-table-ssg.test.ts`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { REQUIRED_TOKENS } from '@/components/templates/contract';
import { templateRegistry } from '@/components/templates/registry';

const TEMPLATES_DIR = path.resolve('src/components/templates');
const BROKEN_FIXTURE_DIR = path.resolve('tests/fixtures/broken-template');

/**
 * Strip comments (block + line) before scanning so a token NAMED in a COMMENT does not
 * count as a declaration. This matters for the negative fixture, whose theme.css documents
 * the dropped token in a comment (`/* --ring: INTENTIONALLY ABSENT *\/`) — without the
 * strip that comment would false-match `--ring:` and the gate would mis-pass. Reused from
 * `kit-isolation.test.ts:42-46`; string literals are not stripped (irrelevant for CSS).
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (avoid eating `://` in URLs)
}

/** Resolve a template file to its absolute path + read it once (comments stripped). */
function readTemplateFile(slugDir: string, file: string): string {
  return stripComments(readFileSync(path.join(slugDir, file), 'utf8'));
}

/** The 3 type-role tokens set via next/font `variable:` (NOT literal in theme.css). */
const FONT_TOKENS = new Set(['--font-display', '--font-body', '--font-mono']);

/** True iff `token` appears as a CSS custom-property DECLARATION (`--name:`) in `css`. */
function declaresToken(css: string, token: string): boolean {
  // A declaration is `--name:` (the colon distinguishes a definition from a `var(--name)`
  // reference). Escape the leading dashes for the RegExp.
  const escaped = token.replace(/[-]/g, '\\-');
  return new RegExp(`${escaped}\\s*:`).test(css);
}

/** True iff `token` is bound via `next/font` `variable: '--name'` in `fontsSrc`. */
function bindsFontVariable(fontsSrc: string, token: string): boolean {
  // next/font face: `variable: '--font-display'` (single or double quotes).
  const escaped = token.replace(/[-]/g, '\\-');
  return new RegExp(`variable:\\s*['"]${escaped}['"]`).test(fontsSrc);
}

/** True iff a template folder DEFINES `token` (theme.css literal OR fonts.ts next/font binding). */
function templateDefinesToken(slugDir: string, token: string): boolean {
  if (FONT_TOKENS.has(token)) {
    return bindsFontVariable(readTemplateFile(slugDir, 'fonts.ts'), token);
  }
  return declaresToken(readTemplateFile(slugDir, 'theme.css'), token);
}

/** The slug list is the registry keys (generalized — NOT two hardcoded slugs). */
const REGISTERED_SLUGS = Object.keys(templateRegistry);

describe('PIPE-02 / D-06 — REQUIRED_TOKENS are defined in EVERY registered template', () => {
  it('declares exactly 18 required tokens (the minimal ∩ editorial intersection)', () => {
    // 11 colour roles + 3 type roles + 4 radius roles = 18 (the verified intersection of
    // the live theme.css token vocabularies — D-06; contract.ts is the source of truth).
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

  it('iterates the registry (guards against zero registered templates)', () => {
    expect(
      REGISTERED_SLUGS.length,
      'no slugs in templateRegistry — the token-conformance guard has nothing to assert against.',
    ).toBeGreaterThan(0);
  });

  describe.each(REGISTERED_SLUGS)('template "%s"', (slug) => {
    const slugDir = path.join(TEMPLATES_DIR, slug);
    describe.each([...REQUIRED_TOKENS])('token %s', (token) => {
      if (FONT_TOKENS.has(token)) {
        // Type-role token: defined via next/font `variable:` in fonts.ts (D-06 exemption).
        it(`is bound via next/font \`variable:\` in ${slug}/fonts.ts`, () => {
          expect(
            bindsFontVariable(readTemplateFile(slugDir, 'fonts.ts'), token),
            `REQUIRED font token "${token}" is not bound via a next/font \`variable: '${token}'\` ` +
              `declaration in src/components/templates/${slug}/fonts.ts (D-06: font tokens are set ` +
              'by next/font, not as literal theme.css declarations).',
          ).toBe(true);
        });
      } else {
        // Colour/radius role: defined as a literal `--name:` declaration in theme.css.
        it(`is declared in ${slug}/theme.css`, () => {
          expect(
            declaresToken(readTemplateFile(slugDir, 'theme.css'), token),
            `REQUIRED token "${token}" is not declared (\`${token}:\`) in ` +
              `src/components/templates/${slug}/theme.css — a conforming template MUST define ` +
              'every REQUIRED_TOKEN in its scoped theme.css.',
          ).toBe(true);
        });
      }
    });
  });
});

describe('PIPE-02 / D-06 — NEGATIVE CONTROL: the broken fixture is REJECTED (D-P10-02)', () => {
  // The fixture DROPS `--ring` from its `.tmpl-broken` theme.css (its header documents this
  // is the deliberate token-conformance REJECT). Proving the guard goes RED here makes it a
  // witnessed gate, not a false-GREEN.
  it('finds at least one REQUIRED_TOKEN the broken fixture FAILS to define', () => {
    const missing = REQUIRED_TOKENS.filter((token) => !templateDefinesToken(BROKEN_FIXTURE_DIR, token));
    expect(
      missing.length,
      'the broken fixture defines every REQUIRED_TOKEN — but it is supposed to DROP at least one ' +
        '(`--ring`), so the token-conformance gate has no witnessed REJECT (false-GREEN, D-P10-02).',
    ).toBeGreaterThan(0);
  });

  it('specifically REJECTS the dropped `--ring` token', () => {
    expect(
      templateDefinesToken(BROKEN_FIXTURE_DIR, '--ring'),
      'expected the broken fixture to DROP `--ring` from theme.css (the deliberate token-conformance REJECT) ' +
        '— if it is defined, the negative fixture or the gate has drifted.',
    ).toBe(false);
  });
});
