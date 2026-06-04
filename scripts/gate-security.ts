/**
 * `gate-security.ts` — the STATIC security pass over a template folder (Phase-10 Plan
 * 03; CICD-01 security; D-13 / D-14). It is the load-bearing net-new gate of the static
 * tier and the highest-false-positive-surface piece, so it uses the TypeScript COMPILER
 * API (structural matching) for the rules where context matters — NOT line-grep.
 *
 * WHY THE AST (RESEARCH Pattern 3 + Pitfall 1): machine-generated source contains the
 * banned SUBSTRINGS in legal contexts. `onClick={toggle}` is a `JsxAttribute` (legal
 * React); `onclick="…"` inside a string literal is an injected HTML inline handler. An
 * `import … from 'next/font/google'` is an `ImportDeclaration` to a sanctioned module; a
 * string literal `https://fonts.googleapis.com` is a runtime CDN origin. The structural
 * rules (`dangerouslySetInnerHTML` producer-tracing, JSX-attr vs string handler, import
 * specifiers, `eval`/`new Function`) walk the AST so these are distinguished. PURE-STRING
 * regexes layer ON TOP only for rules that are inherently text (external origins in CSS
 * `url(…)`, hardcoded-secret literal shapes).
 *
 * GREEN-on-corpus is the CANARY (Pitfall 1): this gate MUST pass `minimal`+`editorial`
 * (which legally contain `onClick={}` JSX, `next/font/google` imports, and the two
 * sanctioned `dangerouslySetInnerHTML` uses). If it ever goes RED on those it is a false
 * positive in the gate, not a real violation. The negative fixture
 * (`tests/fixtures/broken-template/`) is the witnessed REJECT (D-P10-02).
 *
 * ALLOWLIST PROVENANCE (D-P10-03): the dependency allowlist + the sanctioned-`__html`
 * producer set are imported from `scripts/template-allowlist.ts`, so a new dependency is
 * resolved by an allowlist LINE in the same diff — never a code change in this gate.
 *
 * STANDALONE CLI (mirrors `scripts/check-bundle-budget.ts:98-101,261-273`): run under
 * `tsx scripts/gate-security.ts <folder> [<folder> …]` to scan folders directly; the
 * Vitest test `tests/unit/templates/security-grep.test.ts` is the PRIMARY driver and
 * proves both polarities (GREEN corpus + RED negative).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import {
  ALLOWED_IMPORT_SPECIFIERS,
  SANCTIONED_HTML_PRODUCERS,
  isAllowedRelativeImport,
} from './template-allowlist';

/** A single security violation: which rule, which file, and a construct-naming detail. */
export interface SecurityViolation {
  /** The stable rule id (the negative-control test asserts on these). */
  rule: string;
  /** The relative-ish file path the violation was found in. */
  file: string;
  /** A human-readable detail that NAMES the banned construct (deep-work accept rule). */
  detail: string;
}

export interface SecurityScanResult {
  violations: SecurityViolation[];
}

const ALLOWED_IMPORTS = new Set<string>(ALLOWED_IMPORT_SPECIFIERS);
const SANCTIONED_HTML = new Set<string>(SANCTIONED_HTML_PRODUCERS);

/**
 * Strip comments (block + line) before the PURE-STRING regex rules so a banned substring
 * that lives only in PROSE (a header that documents what is banned) does not false-fire.
 * Reused verbatim from `kit-isolation.test.ts:42-46` — it deliberately does NOT strip
 * STRING LITERALS (a banned origin inside a real code string IS a violation we want).
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (avoid eating `://` in URLs)
}

/** Recursively collect every `.ts`/`.tsx`/`.css` source file under `dir`. */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(tsx?|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Resolve a `dangerouslySetInnerHTML` `__html` EXPRESSION to a sanctioned producer.
 * Allowed iff the value is (a) a CALL to a `SANCTIONED_HTML_PRODUCERS` member
 * (`themeInitScript(defaultMode)`), or (b) an IDENTIFIER whose same-file initializer is
 * such a call (`const personLdHtml = personLdScriptHtml(…)` then `__html: personLdHtml`).
 * Anything else (a free-form string, an un-traced identifier, an unknown call) → REJECT.
 * RESEARCH lines 475-486; T-10-03-OBFUSC (an aliased non-sanctioned `__html` is still
 * flagged because its initializer does not trace to a sanctioned call).
 */
function htmlExprIsSanctioned(expr: ts.Expression, sf: ts.SourceFile): boolean {
  // (a) a direct call to a sanctioned producer.
  if (ts.isCallExpression(expr)) {
    return calleeName(expr) !== null && SANCTIONED_HTML.has(calleeName(expr)!);
  }
  // (b) an identifier whose initializer (same file) is a sanctioned call.
  if (ts.isIdentifier(expr)) {
    const init = findIdentifierInitializer(expr.text, sf);
    if (init && ts.isCallExpression(init)) {
      const name = calleeName(init);
      return name !== null && SANCTIONED_HTML.has(name);
    }
    return false;
  }
  return false;
}

/** The simple name of a call's callee (`foo(…)` → `foo`, `a.foo(…)` → `foo`), or null. */
function calleeName(call: ts.CallExpression): string | null {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return null;
}

/** Find a `const <name> = <init>` initializer expression in the same file, or null. */
function findIdentifierInitializer(name: string, sf: ts.SourceFile): ts.Expression | null {
  let found: ts.Expression | null = null;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      found = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** The literal text of a JSX attribute's `dangerouslySetInnerHTML={{ __html: … }}` value. */
function dangerHtmlExpression(attr: ts.JsxAttribute, sf: ts.SourceFile): ts.Expression | null {
  const init = attr.initializer;
  if (!init || !ts.isJsxExpression(init) || !init.expression) return null;
  const obj = init.expression;
  if (!ts.isObjectLiteralExpression(obj)) return null;
  for (const prop of obj.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) &&
      prop.name.text === '__html'
    ) {
      return prop.initializer;
    }
  }
  // `dangerouslySetInnerHTML={someObj}` (no inline `__html`) — un-traceable → treat as
  // a violation by returning a sentinel the caller cannot prove sanctioned.
  return obj;
}

/** Apply the AST-structural rules to one parsed `.ts`/`.tsx` source file. */
function scanTsFile(file: string, src: string, violations: SecurityViolation[]): void {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, /*setParentNodes*/ true, ts.ScriptKind.TSX);

  const walk = (node: ts.Node): void => {
    // RULE danger-html: a `dangerouslySetInnerHTML` JSX attr whose `__html` does NOT
    // trace to a SANCTIONED producer (themeInitScript / personLdScriptHtml /
    // jsonLdToScriptHtml) → REJECT (D-13).
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === 'dangerouslySetInnerHTML') {
      const htmlExpr = dangerHtmlExpression(node, sf);
      if (!htmlExpr || !htmlExprIsSanctioned(htmlExpr as ts.Expression, sf)) {
        violations.push({
          rule: 'danger-html',
          file,
          detail:
            'a `dangerouslySetInnerHTML` whose `__html` does not trace to a sanctioned producer ' +
            `(${[...SANCTIONED_HTML].join(' / ')}) — non-sanctioned dynamic HTML is a D-13 XSS reject`,
        });
      }
    }

    // RULE eval-new-function: `eval(…)` / `new Function(…)` → REJECT (D-13 code-exec).
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'eval') {
      violations.push({
        rule: 'eval-new-function',
        file,
        detail: 'an `eval(…)` call — dynamic code execution is a D-13 reject',
      });
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Function') {
      violations.push({
        rule: 'eval-new-function',
        file,
        detail: 'a `new Function(…)` constructor — dynamic code execution is a D-13 reject',
      });
    }

    // RULE unknown-dependency: an `import … from '<spec>'` / `require('<spec>')` whose
    // specifier is NOT allowlisted (and not a relative `./`/`../` in-repo import) →
    // REJECT (D-P10-03 — resolve by adding an allowlist line in the SAME diff).
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      checkImportSpecifier(node.moduleSpecifier.text, file, violations);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      checkImportSpecifier((node.arguments[0] as ts.StringLiteral).text, file, violations);
    }
    // WR-03: a RE-EXPORT specifier — `export { default } from 'canvas-confetti'` (an
    // ExportDeclaration with a string moduleSpecifier) reaches an unvetted package and must
    // be allowlist-checked exactly like an import.
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      checkImportSpecifier(node.moduleSpecifier.text, file, violations);
    }
    // WR-03: a DYNAMIC import — `await import('canvas-confetti')` (a CallExpression whose
    // callee is the `import` keyword). The rich-lane pattern this contract blesses
    // (`dynamic(() => import('./Scene'))`) and Lovable exports both routinely use it, so it
    // is not a theoretical edge — allowlist-check the specifier like a static import.
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      checkImportSpecifier((node.arguments[0] as ts.StringLiteral).text, file, violations);
    }

    ts.forEachChild(node, walk);
  };

  walk(sf);

  // RULE inline-handler: an `on<word>=` inside a STRING LITERAL / JSX TEXT (an HTML inline
  // event handler) → REJECT. A `JsxAttribute` named `/^on[A-Z]/` (a React event prop) is
  // ALLOWED and is NOT flagged here because this scans string/jsx-text node TEXT, never a
  // JsxAttribute name. (Pitfall 1: `onClick={toggle}` must PASS.)
  const inlineWalk = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) {
      // `on<word>=` directly preceded by whitespace / `<tag ` (an HTML attribute), e.g.
      // `<span onclick="alert(1)">`. We match a lowercase HTML inline-handler attribute
      // (`onclick=`, `onerror=`) — NOT a React `onClick={` (which never appears in a
      // string; it is a JsxAttribute the AST keeps separate).
      if (/\son[a-z]+\s*=/.test(node.getText(sf))) {
        violations.push({
          rule: 'inline-handler',
          file,
          detail: 'an inline `on<word>=` HTML event handler inside a string/JSX-text — a D-14 injection reject',
        });
      }
    }
    ts.forEachChild(node, inlineWalk);
  };
  inlineWalk(sf);
}

/**
 * True iff a specifier is IN-REPO source (cannot reach an unvetted npm package): a
 * relative `./`/`../` import (the `isAllowedRelativeImport` contract) OR the `@/` path
 * alias (`tsconfig` `@/*` → `./src/*`). A `@/`-prefixed import is structurally the same
 * trust level as a relative import — it resolves to first-party project source, never a
 * registry package — so it is allowed without a literal allowlist line. The literal
 * `ALLOWED_IMPORT_SPECIFIERS` list still pins the SPECIFIC `@/…` surfaces a template may
 * reach (e.g. `@/lib/seo/person-jsonld`); this structural allowance is the wider net for
 * the first-party modules the live corpus legitimately imports (validations, safe-image,
 * url, public chrome islands) without dragging every one into the allowlist by hand.
 */
function isInRepoImport(spec: string): boolean {
  return isAllowedRelativeImport(spec) || spec.startsWith('@/');
}

/** Allowlist-check one import/require specifier; push an unknown-dependency violation if not allowed. */
function checkImportSpecifier(spec: string, file: string, violations: SecurityViolation[]): void {
  if (isInRepoImport(spec)) return;
  if (ALLOWED_IMPORTS.has(spec)) return;
  // A subpath of an allowlisted package (e.g. `next/font/google` is listed literally; a
  // future `three/examples/…` subpath would NOT be — keep it strict so an unexpected
  // subpath is reviewed). Type-only `@/components/templates/*` surfaces are listed.
  violations.push({
    rule: 'unknown-dependency',
    file,
    detail:
      `an unlisted import specifier '${spec}' — unknown dependency; resolve by adding an ` +
      'allowlist line in scripts/template-allowlist.ts in the SAME diff (D-P10-03)',
  });
}

/**
 * The PURE-STRING (text) rules — applied to comment-stripped source of EVERY scanned file
 * (`.ts`/`.tsx`/`.css`). These are inherently textual (origins in CSS `url(…)`, secret
 * literal shapes) so the AST gives no leverage; the comment-strip keeps prose benign.
 */
function scanTextRules(file: string, rawSrc: string, violations: SecurityViolation[]): void {
  const src = stripComments(rawSrc);
  const supabaseOrigin = supabaseOriginOrNull();

  // RULE external-font-origin: a runtime CDN font origin. `next/font/local|google` IMPORTS
  // are the sanctioned build-time self-host (D-16) and are allowlisted at the import layer
  // — here we flag the runtime-origin TEXT only.
  if (/https?:\/\/fonts\.googleapis\.com/.test(src) || /https?:\/\/fonts\.gstatic\.com/.test(src)) {
    violations.push({
      rule: 'external-font-origin',
      file,
      detail: 'a runtime Google Fonts CDN origin (fonts.googleapis.com/gstatic.com) — use next/font self-host (D-16)',
    });
  }
  if (/@font-face[\s\S]*?url\(\s*['"]?https?:\/\//.test(src) || /@import\s+url\(\s*['"]?https?:\/\//.test(src)) {
    violations.push({
      rule: 'external-font-origin',
      file,
      detail: 'an `@font-face`/`@import` referencing an external `url(https://…)` — a runtime external font origin reject',
    });
  }

  // RULE external-origin: any external `https://`/`http://`/`//host` origin in `src=` or
  // `url(…)` that is NOT the NEXT_PUBLIC_SUPABASE_URL origin (the same host-lock
  // `safe-image.ts:41-57` enforces — Storage is the ONLY allowed image origin). This is the
  // SHARPER, lower-false-positive layer kept on top of the broad pass below.
  const reportedExternal = new Set<string>();
  for (const m of src.matchAll(/(?:src\s*=\s*['"]|url\(\s*['"]?)((?:https?:)?\/\/[^'")\s]+)/gi)) {
    const url = m[1];
    if (isExternalOrigin(url, supabaseOrigin) && !reportedExternal.has(url)) {
      reportedExternal.add(url);
      violations.push({
        rule: 'external-origin',
        file,
        detail: `an external origin '${url}' in src=/url() — only the Supabase Storage origin is allowed (safe-image host-lock)`,
      });
    }
  }

  // WR-01 broad pass: an external origin written as a BARE string/template literal —
  // `const u = "https://evil.example/tracker.png"; <img src={u} />` — evades the `src=`/`url(`
  // textual proximity rule above (the literal is not adjacent to `src=`). A
  // hostile/AI-generated Lovable export emits exactly this variable-indirection form, so flag
  // ANY external (non-Supabase) absolute/protocol-relative origin token in the comment-
  // stripped source. The live `minimal`/`editorial` corpus contains NO such token (only the
  // host-locked Supabase origin, which `isExternalOrigin` allows), so this stays GREEN on the
  // corpus while closing the indirection hole the negative fixture's literal `src=` form left
  // open. The `external-font-origin` rule above remains the sharper font-CDN layer. `reportedExternal`
  // de-dups so a URL already flagged by the sharper src=/url() rule is not double-reported.
  for (const m of src.matchAll(/(?:https?:)?\/\/[^\s'")]+/g)) {
    const url = m[0];
    if (isExternalOrigin(url, supabaseOrigin) && !reportedExternal.has(url)) {
      reportedExternal.add(url);
      violations.push({
        rule: 'external-origin',
        file,
        detail:
          `an external origin '${url}' — only the Supabase Storage origin is allowed ` +
          '(safe-image host-lock); a bare external-URL literal evades the src=/url() proximity rule',
      });
    }
  }

  // RULE hardcoded-secret: a `VITE_` env name, a JWT (`eyJ…`) anon/service-role key shape,
  // or a literal `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` value assignment.
  if (/\bVITE_[A-Z0-9_]+/.test(src)) {
    violations.push({
      rule: 'hardcoded-secret',
      file,
      detail: 'a `VITE_*` env reference — Vite env names do not belong in a Next template (possible leaked-secret marker)',
    });
  }
  if (/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(src)) {
    violations.push({
      rule: 'hardcoded-secret',
      file,
      detail: 'a hardcoded JWT (`eyJ…`) literal — an anon/service-role key shape must never be inlined in a template',
    });
  }
  if (/SUPABASE_SERVICE_ROLE_KEY/.test(src)) {
    violations.push({
      rule: 'hardcoded-secret',
      file,
      detail: 'a `SUPABASE_SERVICE_ROLE_KEY` reference — the service-role key is server-only and must never reach a template',
    });
  }
}

/** The NEXT_PUBLIC_SUPABASE_URL origin (`https://<ref>.supabase.co`), or null if unset/unparseable. */
function supabaseOriginOrNull(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/** True iff `url` is an external (non-Supabase-Storage) absolute/protocol-relative origin. */
function isExternalOrigin(url: string, supabaseOrigin: string | null): boolean {
  // Protocol-relative `//host` — always treat as external (resolves to an arbitrary origin).
  if (url.startsWith('//')) return true;
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return false; // not an absolute URL → relative/in-repo, not an external origin.
  }
  if (supabaseOrigin && origin === supabaseOrigin) return false; // the ONLY allowed origin.
  return true;
}

/**
 * Scan a template FOLDER for the D-13/14 security rule set. Returns every violation
 * (rule + file + construct-naming detail). Zero violations === the folder PASSES.
 */
export function scanTemplateSecurity(folderAbsPath: string): SecurityScanResult {
  const violations: SecurityViolation[] = [];
  const files = collectSourceFiles(folderAbsPath);
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (/\.tsx?$/.test(file)) {
      scanTsFile(file, src, violations);
    }
    scanTextRules(file, src, violations);
  }
  return { violations };
}

// ─── Standalone CLI tail (mirrors check-bundle-budget.ts:98-101,261-273) ───────────────

function fail(message: string): never {
  console.error(`\n[gate:security] FAIL: ${message}\n`);
  process.exit(1);
}

function main(): void {
  const folders = process.argv.slice(2);
  if (folders.length === 0) {
    fail('usage: tsx scripts/gate-security.ts <template-folder> [<template-folder> …]');
  }
  let total = 0;
  for (const folder of folders) {
    const abs = path.resolve(folder);
    const { violations } = scanTemplateSecurity(abs);
    if (violations.length > 0) {
      total += violations.length;
      for (const v of violations) {
        console.error(`  [${v.rule}] ${path.relative(process.cwd(), v.file)}: ${v.detail}`);
      }
    } else {
      console.log(`[gate:security] PASS ${folder} — no D-13/14 security violations.`);
    }
  }
  if (total > 0) {
    fail(`${total} security violation(s) across the scanned folder(s) — see above.`);
  }
  console.log('\n[gate:security] OK — all scanned template folders pass the D-13/14 static security pass.\n');
}

// Run as a CLI only when invoked directly (`tsx scripts/gate-security.ts …`); importing
// the module (the Vitest test does) never triggers `main()`.
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /gate-security(\.ts|\.js)?$/.test(process.argv[1] ?? '');
if (invokedDirectly) {
  try {
    main();
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}
