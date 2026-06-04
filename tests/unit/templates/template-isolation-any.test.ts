/**
 * CICD-01 (isolation) — the GENERALIZED two-layer isolation guard (Phase-10 Plan 03;
 * D-17). It is `kit-isolation.test.ts`'s source-scan shape, generalized from the kit to
 * run over EVERY registered template folder (`Object.keys(templateRegistry)`) PLUS the
 * negative fixture — so a Phase-11 ingested template inherits the SAME gate with no edit.
 *
 * THE SLUG-RULE FLIP (vs kit-isolation): the KIT must be slug-AGNOSTIC (it bans
 * `.tmpl-minimal`/`.tmpl-editorial` because it must target `[data-template-root]`). A
 * TEMPLATE is the OPPOSITE — it SHOULD scope its styles under its OWN `.tmpl-<slug>`, so
 * that class is NOT banned here. What a template MUST NOT do (two-layer isolation, D-17):
 *   - reference a chrome `--color-*` design token (chrome's `@theme` palette);
 *   - declare a Tailwind `@theme` block (chrome-only — templates use scoped custom props);
 *   - reference the chrome `Inter` font (fonts are per-template via next/font).
 * (Hardcoded hex is NOT banned in a template — unlike the kit, a template's scoped
 * `theme.css` is exactly where all hex SHOULD live; only `@theme`/`--color-*`/`Inter` are
 * the unambiguous chrome-leak markers.)
 *
 * Both polarities (D-P10-02): GREEN on `minimal`+`editorial` (neither references a chrome
 * token), RED on `tests/fixtures/broken-template/` (its theme.css adds an `@theme` block +
 * a chrome `--color-brand` token — the witnessed isolation REJECT).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { templateRegistry } from '@/components/templates/registry';

const TEMPLATES_DIR = path.resolve('src/components/templates');
const BROKEN_FIXTURE_DIR = path.resolve('tests/fixtures/broken-template');

/**
 * Strip comments (block + line) before scanning — reused VERBATIM from
 * `kit-isolation.test.ts:42-46`. A chrome token / `@theme` / `Inter` in PROSE (a header
 * documenting the isolation rule) is benign; only the same in real code/CSS is a
 * violation. String literals are deliberately NOT stripped.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (avoid eating `://` in URLs)
}

/** Every `.ts`/`.tsx`/`.css` source file under a template folder, read once (code-only). */
function readTemplateSources(dir: string): { name: string; source: string }[] {
  const out: { name: string; source: string }[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const full = path.join(d, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.(tsx?|css)$/.test(entry)) {
        out.push({ name: path.relative(dir, full), source: stripComments(readFileSync(full, 'utf8')) });
      }
    }
  };
  walk(dir);
  return out;
}

/**
 * The chrome-isolation BANNED set a TEMPLATE must not contain (D-17). NOTE the deliberate
 * OMISSION of the kit's slug-literal + hex bans: a template SHOULD use `.tmpl-<slug>` and
 * SHOULD define hex in its scoped theme.css — only chrome leaks are banned here.
 */
const BANNED: { label: string; pattern: RegExp; why: string }[] = [
  {
    label: 'a chrome `--color-*` design token',
    pattern: /--color-/,
    why: 'a template must read its OWN scoped tokens, never a chrome `--color-*` design token (D-17 two-layer isolation)',
  },
  {
    label: 'a Tailwind `@theme` block',
    pattern: /@theme\b/,
    why: '`@theme` is chrome-only; a template must use scoped CSS custom properties under `.tmpl-<slug>` (D-17)',
  },
  {
    label: 'a chrome `Inter` font reference',
    pattern: /\bInter\b/,
    why: 'the chrome UI font is forbidden in a template (D-17) — fonts are per-template via next/font',
  },
];

const REGISTERED_SLUGS = Object.keys(templateRegistry);

/** A candidate = a registry slug folder. The negative fixture is scanned separately below. */
const candidates: { slug: string; files: { name: string; source: string }[] }[] = REGISTERED_SLUGS.map(
  (slug) => ({ slug, files: readTemplateSources(path.join(TEMPLATES_DIR, slug)) }),
);

describe('CICD-01 isolation — every REGISTERED template is chrome-token-free (D-17, generalized)', () => {
  it('iterates the registry (guards against zero registered templates)', () => {
    expect(
      REGISTERED_SLUGS.length,
      'no slugs in templateRegistry — the generalized isolation guard has nothing to assert against.',
    ).toBeGreaterThan(0);
  });

  describe.each(candidates)('template "$slug"', ({ slug, files }) => {
    it('has source files to scan', () => {
      expect(files.length, `no .ts/.tsx/.css files under templates/${slug}/`).toBeGreaterThan(0);
    });

    describe.each(files)('$name', ({ name, source }) => {
      it.each(BANNED)('contains no $label', ({ pattern, label, why }) => {
        expect(
          pattern.test(source),
          `templates/${slug}/${name} contains ${label} — banned: ${why}.`,
        ).toBe(false);
      });
    });
  });
});

describe('CICD-01 isolation — NEGATIVE CONTROL: the broken fixture is REJECTED (D-P10-02)', () => {
  const brokenFiles = readTemplateSources(BROKEN_FIXTURE_DIR);
  const allSource = brokenFiles.map((f) => f.source).join('\n');

  it('the negative fixture trips at least one chrome-isolation rule (proving the guard is real)', () => {
    const tripped = BANNED.filter((b) => b.pattern.test(allSource)).map((b) => b.label);
    expect(
      tripped.length,
      'the broken fixture (tests/fixtures/broken-template/theme.css adds an `@theme` block + a chrome ' +
        '`--color-brand` token) must trip the generalized isolation guard — if this is 0 the guard is a ' +
        'false-GREEN (D-P10-02).',
    ).toBeGreaterThan(0);
  });

  it('specifically REJECTS the chrome `--color-*` token and the `@theme` block', () => {
    expect(/--color-/.test(allSource), 'expected the fixture to contain a chrome `--color-*` token').toBe(true);
    expect(/@theme\b/.test(allSource), 'expected the fixture to declare a chrome `@theme` block').toBe(true);
  });
});
