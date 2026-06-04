/**
 * PIPE-01 / D-02 + Pitfall 3 — the kit-isolation static guard (Wave-0 gate).
 *
 * Statically proves the shared template kit (`src/components/templates/_kit/**`) is:
 *   1. SLUG-AGNOSTIC — contains no `.tmpl-minimal` / `.tmpl-editorial` literal (it must
 *      target the generic `[data-template-root]` attribute, never a slug class). NOTE the
 *      slug-AGNOSTIC class hooks the islands emit (`tmpl-theme-toggle`, `tmpl-reveal`,
 *      `tmpl-load-reveal`) ARE allowed — they carry no slug; only the two `.tmpl-<slug>`
 *      strings are banned.
 *   2. CHROME-FREE — no chrome `--color-*` design token, no Tailwind `@theme` block, no
 *      hardcoded hex colour, no chrome `Inter` font reference (two-layer UI isolation,
 *      D-17). The kit islands emit only class names; the STYLING lives in each template's
 *      scoped `theme.css`.
 *   3. ZOD-FREE / one-way — imports NOTHING from a template (`../minimal` / `../editorial`)
 *      and NOTHING from `./registry` or `@/lib/validations` (both evaluate `z.enum(...)`
 *      at module scope → ~63 kB zod onto the public First Load JS — Pitfall 3). The
 *      dependency direction is one-way: templates import FROM the kit; the kit never
 *      imports a template.
 *
 * This is the regression catch the contract relies on (the bundle-split + slug-agnostic
 * guard). Mirrors the static-source-read shape of `tests/build/route-table-ssg.test.ts`
 * (`fs` read + assert with a clear failure hint). It reads the REAL on-disk `_kit/**`
 * files — a future kit edit that reintroduces a slug literal, a chrome token, or a
 * zod-dragging import goes RED here with a file-named hint.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const KIT_DIR = path.resolve('src/components/templates/_kit');

/**
 * Strip comments (block `/* … *\/` + line `// …`) before scanning. The guard asserts
 * against the kit's ACTUAL CODE — a slug literal in a `querySelector`/className, a
 * chrome token in a style, or a zod-dragging `import` is the violation. A slug name,
 * hex, or `Inter` mention in PROSE that explains what was generalized away (e.g.
 * theme-init.ts's header documents that the slug selectors became `[data-template-root]`)
 * is benign and must not false-positive. We deliberately do NOT strip string literals —
 * a slug/token/import inside a real code string IS a violation we want to catch.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (avoid eating `://` in URLs)
}

/** Every source file under `_kit/` (`.ts` / `.tsx`), read once (code-only) with its name. */
const kitFiles: { name: string; source: string }[] = readdirSync(KIT_DIR)
  .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
  .map((name) => ({
    name,
    source: stripComments(readFileSync(path.join(KIT_DIR, name), 'utf8')),
  }));

/**
 * Each guard = a named banned pattern + the rationale. A file matching it fails with a
 * hint naming the file + the banned pattern + WHY it is banned.
 */
const BANNED: { label: string; pattern: RegExp; why: string }[] = [
  {
    label: 'a `.tmpl-minimal` slug literal',
    pattern: /\.tmpl-minimal\b/,
    why: 'the kit must be slug-agnostic (D-02) — target `[data-template-root]`, never a slug class',
  },
  {
    label: 'a `.tmpl-editorial` slug literal',
    pattern: /\.tmpl-editorial\b/,
    why: 'the kit must be slug-agnostic (D-02) — target `[data-template-root]`, never a slug class',
  },
  {
    label: 'a chrome `--color-*` design token',
    pattern: /--color-/,
    why: 'the kit must be chrome-free (D-17 two-layer isolation) — no chrome design token',
  },
  {
    label: 'a Tailwind `@theme` block',
    pattern: /@theme\b/,
    why: 'the kit must be chrome-free — `@theme` is chrome-only; templates use scoped CSS custom properties',
  },
  {
    label: 'a hardcoded hex colour',
    pattern: /#[0-9a-fA-F]{3,8}\b/,
    why: 'the kit carries NO colour — all hex lives in each template’s scoped theme.css, never the kit',
  },
  {
    label: 'a chrome `Inter` font reference',
    pattern: /\bInter\b/,
    why: 'the chrome UI font is forbidden inside the kit (D-17) — fonts are per-template via next/font',
  },
  {
    label: "an import from a template (`'../minimal'`)",
    pattern: /from\s+['"]\.\.\/minimal/,
    why: 'dependency direction is one-way (D-02) — templates import the kit; the kit never imports a template',
  },
  {
    label: "an import from a template (`'../editorial'`)",
    pattern: /from\s+['"]\.\.\/editorial/,
    why: 'dependency direction is one-way (D-02) — templates import the kit; the kit never imports a template',
  },
  {
    label: "an import from `'./registry'` / `'../registry'`",
    pattern: /from\s+['"]\.\.?\/registry/,
    why: 'registry.ts evaluates `z.enum(...)` at module scope → ~63 kB zod onto the public bundle (Pitfall 3)',
  },
  {
    label: "an import from `'@/lib/validations'`",
    pattern: /from\s+['"]@\/lib\/validations/,
    why: 'the validations barrel evaluates zod at module scope → ~63 kB onto the public bundle (Pitfall 3)',
  },
];

describe('PIPE-01 / D-02 — the kit is slug-agnostic + chrome-free + zod-free', () => {
  it('finds kit source files to scan (guards against an empty/missing _kit dir)', () => {
    expect(
      kitFiles.length,
      `no .ts/.tsx files found under ${KIT_DIR} — the kit-isolation guard has nothing to assert ` +
        'against (did the _kit directory move or get emptied?).',
    ).toBeGreaterThan(0);
  });

  describe.each(kitFiles)('_kit/$name', ({ name, source }) => {
    it.each(BANNED)('contains no $label', ({ pattern, label, why }) => {
      expect(
        pattern.test(source),
        `_kit/${name} contains ${label} — banned: ${why}.`,
      ).toBe(false);
    });
  });
});
