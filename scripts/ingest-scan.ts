/**
 * `ingest-scan.ts` — the RAW-INPUT security scanner that backs PIPE-04 (`npm run
 * ingest:scan -- <export-path>`; Phase-11 Plan 02; D-P11-06 two-tier). It is a NEAR-CLONE
 * of `scripts/gate-security.ts`: the SAME TS-compiler-API-for-structure + regex-for-text
 * hybrid, the SAME rule set, and the SAME `scripts/template-allowlist.ts` SOURCE OF TRUTH
 * — with exactly THREE deltas:
 *
 *   (1) WALK THE WHOLE RAW EXPORT. `gate-security` scans one TS-only template folder; an
 *       untrusted Lovable/Vite export ships `.ts/.tsx/.js/.jsx/.css`, an `index.html`, and a
 *       `package.json`. `collectSourceFiles` widens the extension set and parses `.js/.jsx`
 *       as TSX (tolerant); `index.html` runs the text rules only; `package.json` feeds the
 *       dep parse (RESEARCH Pitfall 6).
 *   (2) TWO-TIER REPORT, not a binary reject. Each finding carries a `tier`:
 *         - 'must-strip' (BLOCKS, exit != 0): the six D-13/14 security rules
 *           (hardcoded-secret / danger-html / external-origin / external-font-origin /
 *           inline-handler / eval-new-function). Non-negotiable.
 *         - 'flag' (advisory, NEVER blocks the exit code): unknown-dependency (the dep parse)
 *           + unmapped-section (reserved). On the INPUT side an unknown dep is a FLAG because
 *           the raw export legitimately ships react-quill/recharts/radix that the skill will
 *           STRIP — blocking would make every real export RED with no recourse. The hard-fail
 *           re-asserts on the OUTPUT via the unchanged `gate:security` (D-P10-03 / D-P11-06).
 *   (3) A `package.json` DEPENDENCY PARSE. Every `dependencies`/`devDependencies` name not in
 *       `ALLOWED_IMPORT_SPECIFIERS` (and not an in-repo `@/`/relative spec) → an
 *       `unknown-dependency` FLAG whose detail NAMES the dep.
 *
 * WHY A SEPARATE SCANNER (D-P11-06): the existing output-side `gate:security` only ever sees
 * the OUTPUT template, never the raw INPUT. `ingest:scan` is the hard checklist on untrusted
 * Lovable input, provably RED against a marketer export, unit-testable + CI-safe.
 *
 * WHY THE AST (RESEARCH Pattern 1 + Pitfall 1): machine/AI-generated source contains the
 * banned SUBSTRINGS in legal contexts (`onClick={}` JSX, `next/font/google` imports, Tailwind
 * class strings with `/`). The structural rules walk the AST so these never false-fire; pure
 * regex layers on top only for inherently-textual rules over comment-stripped source. The
 * clean fixture (`tests/fixtures/clean-export/`) is the GREEN canary.
 *
 * STANDALONE CLI (mirrors `scripts/gate-security.ts:423-466` + `check-bundle-budget.ts`): run
 * `tsx scripts/ingest-scan.ts <export-path>` to scan an export directly; the Vitest test
 * `tests/unit/templates/ingest-scan.test.ts` is the PRIMARY driver and proves both polarities
 * + the exit-code contract.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { ALLOWED_IMPORT_SPECIFIERS, SANCTIONED_HTML_PRODUCERS, isAllowedRelativeImport } from './template-allowlist';

/** The two-tier classification: a must-strip finding BLOCKS the exit code; a flag does not. */
export type IngestTier = 'must-strip' | 'flag';

/** The stable rule ids the unit test asserts on. */
export type IngestRule =
  | 'hardcoded-secret'
  | 'danger-html'
  | 'external-origin'
  | 'external-font-origin'
  | 'inline-handler'
  | 'eval-new-function'
  | 'unknown-dependency'
  | 'unmapped-section';

/** A single raw-input finding: its tier, the rule, the file, and a construct-naming detail. */
export interface IngestFinding {
  /** 'must-strip' blocks the exit code (the six D-13/14 rules); 'flag' is advisory. */
  tier: IngestTier;
  /** The stable rule id. */
  rule: IngestRule;
  /** The relative-ish file path the finding was found in. */
  file: string;
  /** A human-readable detail that NAMES the construct (the dep, the host, the env name). */
  detail: string;
}

export interface IngestScanResult {
  findings: IngestFinding[];
}

const ALLOWED_IMPORTS = new Set<string>(ALLOWED_IMPORT_SPECIFIERS);
const SANCTIONED_HTML = new Set<string>(SANCTIONED_HTML_PRODUCERS);

/**
 * Strip comments (block + line) before the PURE-STRING regex rules so a banned substring
 * that lives only in PROSE (a header documenting what is banned) does not false-fire. Reused
 * VERBATIM from `gate-security.ts:66-70`; it deliberately does NOT strip STRING LITERALS (a
 * banned origin inside a real code string IS a finding we want).
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments (avoid eating `://` in URLs)
}

/**
 * DELTA 1 — recursively collect every source file the raw export carries. The output gate
 * (`gate-security.ts:72-84`) collects `.tsx?/.css` only; an untrusted Vite/React export also
 * ships `.js/.jsx`, an `index.html`, and a `package.json` (RESEARCH Pitfall 6). Skips
 * `node_modules` (a downloaded export may include a vendored tree — never scan it).
 */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(tsx?|jsx?|css|html)$/.test(entry) || entry === 'package.json') {
      out.push(full);
    }
  }
  return out;
}

/**
 * Resolve a `dangerouslySetInnerHTML` `__html` EXPRESSION to a sanctioned producer (reused
 * from `gate-security.ts:95-110` for false-positive PARITY with the output gate). On the raw
 * INPUT side there is NO `_kit`, so no `__html` ever traces to a sanctioned producer — every
 * `dangerouslySetInnerHTML` is must-strip. We keep the producer-tracing identical to the
 * output gate so the two scans agree by construction; on the input side it simply always
 * returns false in practice.
 */
function htmlExprIsSanctioned(expr: ts.Expression, sf: ts.SourceFile): boolean {
  if (ts.isCallExpression(expr)) {
    return calleeName(expr) !== null && SANCTIONED_HTML.has(calleeName(expr)!);
  }
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

/** The `__html` expression of a `dangerouslySetInnerHTML={{ __html: … }}` JSX attr, or a sentinel. */
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
  return obj;
}

/**
 * DELTA 2 (structural rules) — apply the AST rules to one parsed source file, tagging each
 * finding with its tier. The six security rules are must-strip; an unknown import specifier is
 * a FLAG (advisory; the OUTPUT gate hard-fails it). `.js/.jsx` are parsed as TSX (tolerant) so
 * the export's JS files are scanned identically.
 */
function scanAstFile(file: string, src: string, findings: IngestFinding[]): void {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, /*setParentNodes*/ true, ts.ScriptKind.TSX);

  const walk = (node: ts.Node): void => {
    // RULE danger-html (must-strip): a `dangerouslySetInnerHTML` whose `__html` does NOT
    // trace to a sanctioned producer. On the raw input side none ever does → always must-strip.
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === 'dangerouslySetInnerHTML') {
      const htmlExpr = dangerHtmlExpression(node, sf);
      if (!htmlExpr || !htmlExprIsSanctioned(htmlExpr as ts.Expression, sf)) {
        findings.push({
          tier: 'must-strip',
          rule: 'danger-html',
          file,
          detail:
            'a `dangerouslySetInnerHTML` whose `__html` does not trace to a sanctioned producer — ' +
            'the raw input has no sanctioned producer, so ANY dynamic HTML is a D-13 XSS must-strip',
        });
      }
    }

    // RULE eval-new-function (must-strip): `eval(…)` / `new Function(…)` (D-13 code-exec).
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'eval') {
      findings.push({
        tier: 'must-strip',
        rule: 'eval-new-function',
        file,
        detail: 'an `eval(…)` call — dynamic code execution is a D-13 must-strip',
      });
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Function') {
      findings.push({
        tier: 'must-strip',
        rule: 'eval-new-function',
        file,
        detail: 'a `new Function(…)` constructor — dynamic code execution is a D-13 must-strip',
      });
    }

    // RULE unknown-dependency (FLAG): an `import`/`require`/re-export/dynamic-import specifier
    // not allowlisted (and not in-repo). On the INPUT side this is a FLAG, not a block — the
    // skill may simply strip the dep (D-P11-06). The OUTPUT `gate:security` hard-fails it.
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      checkImportSpecifier(node.moduleSpecifier.text, file, findings);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      checkImportSpecifier((node.arguments[0] as ts.StringLiteral).text, file, findings);
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      checkImportSpecifier(node.moduleSpecifier.text, file, findings);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      checkImportSpecifier((node.arguments[0] as ts.StringLiteral).text, file, findings);
    }

    ts.forEachChild(node, walk);
  };
  walk(sf);

  // RULE inline-handler (must-strip): an `on<word>=` inside a STRING LITERAL / JSX TEXT (an
  // injected HTML inline event handler). A `JsxAttribute` named `onClick` (a React event prop)
  // is NOT flagged — this scans string/jsx-text node TEXT, never a JsxAttribute name
  // (Pitfall 1: `onClick={toggle}` must PASS).
  const inlineWalk = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) {
      if (/\son[a-z]+\s*=/.test(node.getText(sf))) {
        findings.push({
          tier: 'must-strip',
          rule: 'inline-handler',
          file,
          detail: 'an inline `on<word>=` HTML event handler inside a string/JSX-text — a D-14 injection must-strip',
        });
      }
    }
    ts.forEachChild(node, inlineWalk);
  };
  inlineWalk(sf);
}

/**
 * True iff a specifier is IN-REPO source (cannot reach an unvetted npm package): a relative
 * `./`/`../` import OR the `@/` path alias. Reused VERBATIM from `gate-security.ts:268-270`.
 * A Vite export's `@/` resolves to its own `./src/*` (same trust level as relative) and is
 * stripped/rewritten by the skill anyway, so it is never a dep finding.
 */
function isInRepoImport(spec: string): boolean {
  return isAllowedRelativeImport(spec) || spec.startsWith('@/');
}

/** Allowlist-check one import/require specifier; push an unknown-dependency FLAG if not allowed. */
function checkImportSpecifier(spec: string, file: string, findings: IngestFinding[]): void {
  if (isInRepoImport(spec)) return;
  if (ALLOWED_IMPORTS.has(spec)) return;
  findings.push({
    tier: 'flag',
    rule: 'unknown-dependency',
    file,
    detail:
      `an unlisted import specifier '${spec}' — unknown dependency (FLAG; the skill may strip it). ` +
      'If it survives into the generated template it must become an allowlist line in ' +
      'scripts/template-allowlist.ts (the OUTPUT gate:security re-asserts, D-P11-06).',
  });
}

/**
 * DELTA 2 (text rules) — the PURE-STRING rules, applied to comment-stripped source of EVERY
 * scanned file (`.ts/.tsx/.js/.jsx/.css/.html`). Reused from `gate-security.ts:293-379`; all
 * six are must-strip. These are inherently textual (origins in CSS `url(…)`, secret literal
 * shapes) so the AST gives no leverage; the comment-strip keeps prose benign.
 */
function scanTextRules(file: string, rawSrc: string, findings: IngestFinding[]): void {
  const src = stripComments(rawSrc);
  const supabaseOrigin = supabaseOriginOrNull();

  // RULE external-font-origin (must-strip): a runtime CDN font origin (use next/font, D-16).
  if (/https?:\/\/fonts\.googleapis\.com/.test(src) || /https?:\/\/fonts\.gstatic\.com/.test(src)) {
    findings.push({
      tier: 'must-strip',
      rule: 'external-font-origin',
      file,
      detail: 'a runtime Google Fonts CDN origin (fonts.googleapis.com/gstatic.com) — use next/font self-host (D-16)',
    });
  }
  if (/@font-face[\s\S]*?url\(\s*['"]?https?:\/\//.test(src) || /@import\s+url\(\s*['"]?https?:\/\//.test(src)) {
    findings.push({
      tier: 'must-strip',
      rule: 'external-font-origin',
      file,
      detail: 'an `@font-face`/`@import` referencing an external `url(https://…)` — a runtime external font origin must-strip',
    });
  }

  // RULE external-origin (must-strip): the SHARP `src=`/`url()` pass — any external origin not
  // the Supabase Storage origin. De-dup so the broad pass below does not double-report.
  const reportedExternal = new Set<string>();
  for (const m of src.matchAll(/(?:src\s*=\s*['"]|url\(\s*['"]?)((?:https?:)?\/\/[^'")\s]+)/gi)) {
    const url = m[1];
    if (isExternalOrigin(url, supabaseOrigin) && !reportedExternal.has(url)) {
      reportedExternal.add(url);
      findings.push({
        tier: 'must-strip',
        rule: 'external-origin',
        file,
        detail: `an external origin '${url}' in src=/url() — only the Supabase Storage origin is allowed (safe-image host-lock)`,
      });
    }
  }

  // RULE external-origin (must-strip): the BROAD bare-URL pass — a `https://`/`//host` token
  // not adjacent to `src=`/`url(` (`const u = "https://evil/x.png"; <img src={u} />`). A
  // Tailwind class never starts with `//`, so this stays GREEN on the corpus (Pitfall 1).
  for (const m of src.matchAll(/(?:https?:)?\/\/[^\s'")]+/g)) {
    const url = m[0];
    if (isExternalOrigin(url, supabaseOrigin) && !reportedExternal.has(url)) {
      reportedExternal.add(url);
      findings.push({
        tier: 'must-strip',
        rule: 'external-origin',
        file,
        detail:
          `an external origin '${url}' — only the Supabase Storage origin is allowed ` +
          '(safe-image host-lock); a bare external-URL literal evades the src=/url() proximity rule',
      });
    }
  }

  // RULE hardcoded-secret (must-strip): a `VITE_` env name, a JWT (`eyJ…`) shape, or a
  // `SUPABASE_SERVICE_ROLE_KEY` reference.
  if (/\bVITE_[A-Z0-9_]+/.test(src)) {
    findings.push({
      tier: 'must-strip',
      rule: 'hardcoded-secret',
      file,
      detail: 'a `VITE_*` env reference — Vite env names do not belong in a Next template (possible leaked-secret marker)',
    });
  }
  if (/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(src)) {
    findings.push({
      tier: 'must-strip',
      rule: 'hardcoded-secret',
      file,
      detail: 'a hardcoded JWT (`eyJ…`) literal — an anon/service-role key shape must never be inlined in a template',
    });
  }
  if (/SUPABASE_SERVICE_ROLE_KEY/.test(src)) {
    findings.push({
      tier: 'must-strip',
      rule: 'hardcoded-secret',
      file,
      detail: 'a `SUPABASE_SERVICE_ROLE_KEY` reference — the service-role key is server-only and must never reach a template',
    });
  }
}

/** The NEXT_PUBLIC_SUPABASE_URL origin, or null if unset/unparseable. Reused verbatim. */
function supabaseOriginOrNull(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/** True iff `url` is an external (non-Supabase-Storage) absolute/protocol-relative origin. Reused verbatim. */
function isExternalOrigin(url: string, supabaseOrigin: string | null): boolean {
  if (url.startsWith('//')) return true;
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return false; // not an absolute URL → relative/in-repo, not an external origin.
  }
  if (supabaseOrigin && origin === supabaseOrigin) return false;
  return true;
}

/**
 * DELTA 3 — parse a raw export's `package.json` `dependencies` + `devDependencies`. Every dep
 * NAME not in `ALLOWED_IMPORT_SPECIFIERS` (and not an in-repo `@/`/relative spec) → an
 * `unknown-dependency` FLAG whose detail NAMES the dep. This is a FLAG (never must-strip) — the
 * raw export legitimately ships deps the skill will STRIP; the hard-fail re-asserts on the
 * OUTPUT (D-P11-06).
 */
function scanPackageJsonDeps(file: string, rawSrc: string, findings: IngestFinding[]): void {
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(rawSrc) as typeof pkg;
  } catch {
    findings.push({
      tier: 'flag',
      rule: 'unknown-dependency',
      file,
      detail: 'package.json is not valid JSON — could not parse dependencies for the allowlist check',
    });
    return;
  }
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const name of Object.keys(deps)) {
    if (isInRepoImport(name)) continue;
    if (ALLOWED_IMPORTS.has(name)) continue;
    findings.push({
      tier: 'flag',
      rule: 'unknown-dependency',
      file,
      detail:
        `an unlisted package.json dependency '${name}' — unknown dependency (FLAG; the operator ` +
        'decides keep→allowlist+slopcheck / replace / reject). It never blocks the input scan; the ' +
        'OUTPUT gate:security hard-fails it if it survives into the generated template (D-P11-06).',
    });
  }
}

/**
 * Scan a raw export FOLDER for the D-13/14 rule set, two-tier classified. Returns every
 * finding (tier + rule + file + construct-naming detail). Mirrors
 * `scanTemplateSecurity(folderAbsPath)` so the unit test drives it directly. Zero must-strip
 * findings === the export PASSES the input gate (flags are advisory).
 */
export function scanIngest(exportAbsPath: string): IngestScanResult {
  const findings: IngestFinding[] = [];
  const files = collectSourceFiles(exportAbsPath);
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (path.basename(file) === 'package.json') {
      scanPackageJsonDeps(file, src, findings);
      continue; // package.json is data, not source — no AST/text rules over it.
    }
    if (/\.(tsx?|jsx?)$/.test(file)) {
      scanAstFile(file, src, findings);
    }
    // Text rules over every non-package.json file (.ts/.tsx/.js/.jsx/.css/.html).
    scanTextRules(file, src, findings);
  }
  return { findings };
}

// ─── Standalone CLI tail (mirrors gate-security.ts:423-466) ────────────────────────────

function fail(message: string): never {
  console.error(`\n[ingest:scan] FAIL: ${message}\n`);
  process.exit(1);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    fail('usage: tsx scripts/ingest-scan.ts <export-path>   (e.g. npm run ingest:scan -- lovable-exports/<name>)');
  }
  const exportPath = args[0];
  const abs = path.resolve(exportPath);
  if (!existsSync(abs)) {
    fail(`export path not found: ${exportPath} (resolved: ${abs})`);
  }

  const { findings } = scanIngest(abs);
  const mustStrip = findings.filter((f) => f.tier === 'must-strip');
  const flags = findings.filter((f) => f.tier === 'flag');

  for (const f of mustStrip) {
    console.error(`  [must-strip] [${f.rule}] ${path.relative(process.cwd(), f.file)}: ${f.detail}`);
  }
  for (const f of flags) {
    console.log(`  [flag] [${f.rule}] ${path.relative(process.cwd(), f.file)}: ${f.detail}`);
  }

  if (flags.length > 0) {
    console.log(
      `\n[ingest:scan] ${flags.length} FLAG(s) for operator review (unknown deps / unmapped sections) — ` +
        'these are advisory and do NOT block; resolve them interactively and record to INGEST-MANIFEST.md.',
    );
  }

  // Exit code: non-zero IFF any must-strip finding exists. Flags print but NEVER block (D-P11-06).
  if (mustStrip.length > 0) {
    fail(`${mustStrip.length} MUST-STRIP finding(s) — the raw export carries D-13/14 violations; see above.`);
  }
  console.log(`\n[ingest:scan] OK — no must-strip findings in ${exportPath} (${flags.length} advisory flag(s)).\n`);
}

// Run as a CLI only when invoked directly (`tsx scripts/ingest-scan.ts …`); importing the
// module (the Vitest test does) never triggers `main()`.
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /ingest-scan(\.ts|\.js)?$/.test(process.argv[1] ?? '');
if (invokedDirectly) {
  try {
    main();
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}
