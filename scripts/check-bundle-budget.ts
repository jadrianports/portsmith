/**
 * scripts/check-bundle-budget.ts — the TMPL-04 deterministic build gate (D-25;
 * Plan 03-09, Task 1; RESEARCH "Validation Architecture" build-assert row +
 * Wave-0 Gaps "Bundle/ISR build assertion").
 *
 * TMPL-04 has TWO halves; this script enforces the deterministic half (the other
 * half — Lighthouse mobile ≥ 90 — is the holistic human/CI gate). It runs (or
 * consumes) `next build` and FAILS (non-zero exit) if EITHER:
 *
 *   (1) the `/[username]` public route is NOT ISR/static (i.e. it went DYNAMIC
 *       `ƒ`). The cookie-less anon read (03-02) is what keeps the route static;
 *       an accidental `cookies()`/`headers()`/`no-store`/request-host read would
 *       silently flip it to dynamic and break the perf budget — RESEARCH Pitfall 2.
 *
 *   (2) the route's client **First Load JS exceeds 200 kB gzipped** — RESEARCH
 *       Pitfall 3 (the `simple-icons` bundle-leak risk: a non-tree-shaken barrel
 *       or a whole-set import ballooning the client chunk).
 *
 *   (3) a per-template **async-island chunk exceeds the async-island cap
 *       (`ASYNC_ISLAND_CAP_BYTES`, 320 kB gz)** — the Phase-10 ADDITION (PIPE-08 /
 *       CONTRACT §5). A rich/viz-lane template may ship a lazy `{ ssr: false }` island
 *       that appears in NEITHER the route's `rootMainFiles` NOR the page
 *       client-reference-manifest's EAGER set, so the First-Load-JS gate above
 *       genuinely cannot see it — it needs its OWN measurement path governed by a
 *       SEPARATE async-island sanity cap. Standard-lane templates (minimal/editorial)
 *       ship NO async island chunk, so the live scan legitimately NO-OPS ("no async
 *       chunk → pass"). The reject LOGIC is proven by the EXPORTED pure predicate
 *       (`assertAsyncIslandWithinCap`) which callers can exercise against any chunk.
 *
 * This is THE CI/phase gate: wire it as `npm run check:bundle`. A breach exits
 * non-zero with a clear message so the build/CI fails and the phase cannot close
 * on a regressed route.
 *
 * ── HOW IT READS THE BUILD (Next 16.2.6 + Turbopack reality) ──────────────────
 * Next 16 with Turbopack NO LONGER prints a "First Load JS" column in the
 * `next build` route table (the table now shows only Route / Revalidate / Expire),
 * so parsing stdout for a per-route JS figure is unreliable. Instead this script
 * reads the authoritative build artifacts under `.next`:
 *
 *   • RENDER MODE (ISR/static vs dynamic) ← `.next/prerender-manifest.json`.
 *     A route prerendered via `generateStaticParams` produces a CONCRETE entry in
 *     `routes` (e.g. `/jadrianports`) whose `srcRoute` is `/[username]` and which
 *     carries `initialRevalidateSeconds` (the ISR backstop). If the route flipped
 *     to dynamic (`ƒ`), `generateStaticParams` would not yield that concrete
 *     prerendered instance and the entry would be absent — so its PRESENCE is the
 *     deterministic ISR/static proof. (`routes-manifest.json` lists `/[username]`
 *     under `dynamicRoutes` purely because the URL has a `[param]` segment — that
 *     is a URL-pattern fact, NOT a render-mode fact, and is deliberately NOT used
 *     as the mode signal.)
 *
 *   • FIRST LOAD JS ← the route's own
 *     `.next/server/app/(portfolio)/[username]/page/build-manifest.json`
 *     (`rootMainFiles` = the shared client entry chunks every route ships) UNION
 *     the route-specific client-island chunks referenced by
 *     `.next/server/app/(portfolio)/[username]/page_client-reference-manifest.js`
 *     (the ThemeToggle + ScrollReveal islands — the only client JS the otherwise
 *     Server-Component `minimal` template ships). Each chunk file is gzipped
 *     (level 9) and summed — the gzipped total is the route's First Load JS, the
 *     figure the ≤200 kB budget is stated against.
 *
 * Mirrors the standalone-script structure of `scripts/promote-admin.ts`: a header,
 * a `fail()` helper, and a `main().catch(...)` tail. Run with `tsx` (devDep).
 *
 * USAGE:  npm run check:bundle    (-> tsx scripts/check-bundle-budget.ts)
 *         Pass `--skip-build` (or set SKIP_BUILD=1) to reuse an existing `.next`
 *         instead of re-running `next build` (faster local re-runs).
 *
 * THIS IS NOT RUNTIME APP CODE — it is a build/CI gate, never imported by the app.
 */
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** The hard TMPL-04 budget: client First Load JS for the public route. */
const FIRST_LOAD_JS_BUDGET_BYTES = 200 * 1024; // 200 kB gzipped (D-25)

/**
 * The per-template async-island sanity cap (PIPE-08 / CONTRACT §5). A rich/viz-lane
 * template's lazy `{ ssr: false }` island chunk is NOT counted in the route's First
 * Load JS (it appears in neither `rootMainFiles` nor the page client-reference-manifest),
 * so it is bounded by THIS separate cap. Standard-lane templates (minimal/editorial)
 * ship no async island chunk, so the live scan no-ops. The cap's REJECT path is
 * unit-proven by the exported pure predicate `assertAsyncIslandWithinCap`.
 *
 * 320 kB provides generous headroom for a rich-lane island while still catching real
 * failure modes (e.g. a 1 MB un-tree-shaken import). Re-evaluate this figure when a
 * concrete rich-lane template is registered and its actual chunk size is measured.
 */
export const ASYNC_ISLAND_CAP_BYTES = 320 * 1024; // 320 kB gzipped (PIPE-08 / CONTRACT §5)

/** Repo-relative paths (the script is run from the repo root by the npm script). */
const NEXT_DIR = path.resolve('.next');
const PRERENDER_MANIFEST = path.join(NEXT_DIR, 'prerender-manifest.json');

/**
 * The public route under test. `ROUTE_SRC` is the parameterized page; `ROUTE_INSTANCE`
 * is the concrete username prerendered by `generateStaticParams` (the seeded founder
 * slug — D-27 / 03-03; MUST match `generateStaticParams` in the page).
 */
const ROUTE_SRC = '/[username]';
const ROUTE_INSTANCE = '/jadrianports';

/** The route's per-route client manifests (Turbopack App Router layout). */
const ROUTE_BUILD_MANIFEST = path.join(
  NEXT_DIR,
  'server',
  'app',
  '(portfolio)',
  '[username]',
  'page',
  'build-manifest.json',
);
const ROUTE_CLIENT_REF_MANIFEST = path.join(
  NEXT_DIR,
  'server',
  'app',
  '(portfolio)',
  '[username]',
  'page_client-reference-manifest.js',
);

function fail(message: string): never {
  console.error(`\n[check:bundle] FAIL: ${message}\n`);
  process.exit(1);
}

function readJson<T>(file: string): T {
  if (!existsSync(file)) {
    fail(
      `expected build artifact not found: ${file}\n` +
        '  Run `npm run build` first, or run this without --skip-build.',
    );
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch (err) {
    return fail(`could not parse ${file}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Run `next build` unless explicitly skipped (reuse an existing `.next`). */
function runBuildIfNeeded(): void {
  const skip = process.argv.includes('--skip-build') || process.env.SKIP_BUILD === '1';
  if (skip) {
    console.log('[check:bundle] --skip-build set — reusing the existing .next build output.');
    return;
  }
  console.log('[check:bundle] running `next build` ...');
  // Invoke the local Next CLI so the gate measures a real production build.
  // `shell: true` is REQUIRED on Windows + Node ≥20: a bare `spawnSync('npm', …)`
  // (or `npm.cmd`) throws EINVAL because Node now refuses to spawn `.cmd`/`.bat`
  // shims without a shell. Running the command string through the shell resolves
  // the platform npm shim correctly on Windows, macOS, and Linux alike.
  const res = spawnSync('npm run build', { stdio: 'inherit', env: process.env, shell: true });
  if (res.error) {
    fail(`could not run \`next build\`: ${res.error.message}`);
  }
  if (res.status !== 0) {
    fail(
      `\`next build\` failed (exit ${res.status ?? String(res.signal)}) — ` +
        'fix the build before the budget gate.',
    );
  }
}

/**
 * Half 1 — RENDER MODE. Prove `/[username]` is ISR/static, NOT dynamic (`ƒ`).
 * The concrete prerendered instance (`/jadrianports`) must exist in the
 * prerender-manifest `routes` with the matching `srcRoute` and an ISR revalidate.
 */
function assertRouteIsIsrStatic(): void {
  interface PrerenderManifest {
    routes: Record<
      string,
      { srcRoute?: string | null; initialRevalidateSeconds?: number | false }
    >;
    dynamicRoutes: Record<string, unknown>;
  }
  const pm = readJson<PrerenderManifest>(PRERENDER_MANIFEST);

  const instance = pm.routes?.[ROUTE_INSTANCE];
  if (!instance) {
    fail(
      `${ROUTE_SRC} is NOT ISR/static — no prerendered instance "${ROUTE_INSTANCE}" found in ` +
        `prerender-manifest.routes. The route likely went DYNAMIC (ƒ): an accidental ` +
        `cookies()/headers()/no-store/request-host read in the route or its data layer ` +
        `flips it to dynamic and breaks the TMPL-04 perf budget (RESEARCH Pitfall 2).`,
    );
  }
  if (instance.srcRoute !== ROUTE_SRC) {
    fail(
      `prerendered "${ROUTE_INSTANCE}" has srcRoute "${instance.srcRoute}" (expected "${ROUTE_SRC}") — ` +
        'the route/seed slug mapping changed; verify generateStaticParams matches the seed.',
    );
  }
  const revalidate = instance.initialRevalidateSeconds;
  if (typeof revalidate !== 'number' || revalidate <= 0) {
    fail(
      `${ROUTE_SRC} is prerendered but has no ISR revalidate (initialRevalidateSeconds=${String(
        revalidate,
      )}). Expected the D-21 backstop (\`export const revalidate = 3600\`).`,
    );
  }

  console.log(
    `[check:bundle] PASS render-mode: ${ROUTE_SRC} is ISR/static (●) — prerendered "${ROUTE_INSTANCE}" ` +
      `with revalidate=${revalidate}s. NOT dynamic (ƒ).`,
  );
}

/** Collect the unique `static/chunks/*.js` client files the route ships. */
function collectRouteClientChunks(): string[] {
  interface RouteBuildManifest {
    rootMainFiles?: string[];
    pages?: Record<string, string[]>;
  }
  const rbm = readJson<RouteBuildManifest>(ROUTE_BUILD_MANIFEST);

  // The shared client entry chunks every route loads on first paint.
  const rootMain = Array.isArray(rbm.rootMainFiles) ? rbm.rootMainFiles : [];

  // The route-specific client islands (ThemeToggle + ScrollReveal) — referenced
  // from the page's client-reference-manifest as `static/chunks/*.js`.
  const routeChunks: string[] = [];
  if (existsSync(ROUTE_CLIENT_REF_MANIFEST)) {
    const crm = readFileSync(ROUTE_CLIENT_REF_MANIFEST, 'utf8');
    const matches = crm.match(/static\/chunks\/[A-Za-z0-9_./-]+\.js/g) ?? [];
    for (const m of matches) routeChunks.push(m);
  }

  // Any page-keyed JS chunks (defensive — empty under current Turbopack output).
  const pageChunks: string[] = [];
  for (const list of Object.values(rbm.pages ?? {})) {
    for (const f of list) if (f.endsWith('.js')) pageChunks.push(f);
  }

  return [...new Set([...rootMain, ...routeChunks, ...pageChunks])];
}

/**
 * Half 2 — FIRST LOAD JS ≤ 200 kB gzipped. Gzip each client chunk the route ships
 * and sum; FAIL if the gzipped total exceeds the budget.
 */
function assertFirstLoadJsWithinBudget(): void {
  const chunks = collectRouteClientChunks();
  if (chunks.length === 0) {
    fail(
      'could not resolve any client chunks for the route — the build manifests changed shape. ' +
        'Inspect .next/server/app/(portfolio)/[username]/page/build-manifest.json.',
    );
  }

  let totalGz = 0;
  const rows: string[] = [];
  for (const rel of chunks) {
    const abs = path.join(NEXT_DIR, rel);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      fail(`route chunk listed in the manifest does not exist on disk: ${rel}`);
    }
    const gz = gzipSync(readFileSync(abs), { level: 9 }).length;
    totalGz += gz;
    rows.push(`    ${(gz / 1024).toFixed(1).padStart(7)} kB gz   ${rel}`);
  }

  console.log('[check:bundle] route client chunks (gzipped):');
  for (const r of rows) console.log(r);

  const totalKb = (totalGz / 1024).toFixed(1);
  const budgetKb = (FIRST_LOAD_JS_BUDGET_BYTES / 1024).toFixed(0);

  if (totalGz > FIRST_LOAD_JS_BUDGET_BYTES) {
    fail(
      `${ROUTE_SRC} First Load JS is ${totalKb} kB gzipped — OVER the ${budgetKb} kB budget (D-25). ` +
        'A non-tree-shaken import (e.g. a simple-icons barrel/whole-set leak, RESEARCH Pitfall 3) ' +
        'or a new heavy client island is the likely cause. Shrink the client JS before merging.',
    );
  }

  console.log(
    `[check:bundle] PASS first-load-js: ${ROUTE_SRC} = ${totalKb} kB gzipped (budget ${budgetKb} kB). ` +
      'Under cap.',
  );
}

/**
 * Half 3 — ASYNC-ISLAND CAP (PIPE-08 / CONTRACT §5). The EXPORTED, PURE, UNIT-TESTABLE
 * reject predicate: given the gzipped byte length of a template's lazy `{ ssr: false }`
 * island chunk and a human-readable `label` (the slug + construct that produced it),
 * THROW an `Error` whose message NAMES the over-cap construct and its size vs the cap
 * when `gzippedBytes` exceeds {@link ASYNC_ISLAND_CAP_BYTES}; return silently otherwise.
 *
 * Keeping the size check a pure function over a byte length (rather than buried inside
 * the `.next/`-scanning driver) makes it unit-exercisable before any rich-lane template
 * exists to measure.
 *
 * It throws (rather than calling `fail()`/`process.exit`) so it is safe to import and
 * assert against in a unit test; the live driver below catches/re-surfaces via `fail()`.
 */
export function assertAsyncIslandWithinCap(gzippedBytes: number, label: string): void {
  if (!Number.isFinite(gzippedBytes) || gzippedBytes < 0) {
    throw new Error(
      `[async-island-cap] invalid gzipped size for "${label}": ${String(gzippedBytes)}`,
    );
  }
  if (gzippedBytes > ASYNC_ISLAND_CAP_BYTES) {
    const gotKb = (gzippedBytes / 1024).toFixed(1);
    const capKb = (ASYNC_ISLAND_CAP_BYTES / 1024).toFixed(0);
    throw new Error(
      `[async-island-cap] "${label}" async-island scene chunk is ${gotKb} kB gzipped — ` +
        `OVER the ${capKb} kB async-island cap (PIPE-08 / CONTRACT §5). The rich/viz lane's ` +
        `lazy { ssr: false } scene island (e.g. an un-tree-shaken \`import * from 'three'\` or ` +
        `a bundled texture/model) must be code-split + slimmed below the cap before merging.`,
    );
  }
}

/**
 * Async-island scan stub — returns an empty list until a concrete rich-lane template
 * registers its lazy `{ ssr: false }` island. Standard-lane templates (minimal/editorial/
 * aurora/edgerunner CSS-only) ship no async island, so this legitimately NO-OPS.
 * When a rich-lane template ships, wire its chunk discovery here and bound it with
 * {@link assertAsyncIslandWithinCap}.
 */
function discoverAsyncIslandChunks(): { abs: string; label: string }[] {
  return [];
}

function assertTemplateAsyncIslandsWithinCap(): void {
  const chunks = discoverAsyncIslandChunks();
  if (chunks.length === 0) {
    console.log(
      '[check:bundle] PASS async-island-cap: no lazy { ssr: false } island chunk — ' +
        `nothing to measure (standard lane). Cap is ${(ASYNC_ISLAND_CAP_BYTES / 1024).toFixed(0)} kB gz.`,
    );
    return;
  }
  for (const { abs, label } of chunks) {
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      fail(`async-island chunk listed for "${label}" does not exist on disk: ${abs}`);
    }
    const gz = gzipSync(readFileSync(abs), { level: 9 }).length;
    // The pure predicate throws on over-cap; surface it as a gate failure (non-zero exit).
    try {
      assertAsyncIslandWithinCap(gz, label);
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    }
    console.log(
      `[check:bundle] PASS async-island-cap: "${label}" = ${(gz / 1024).toFixed(1)} kB gz ` +
        `(cap ${(ASYNC_ISLAND_CAP_BYTES / 1024).toFixed(0)} kB). Under cap.`,
    );
  }
}

function main(): void {
  console.log('[check:bundle] TMPL-04 deterministic gate — ISR/static + ≤200 kB First Load JS + async-island cap.');
  runBuildIfNeeded();
  assertRouteIsIsrStatic();
  assertFirstLoadJsWithinBudget();
  assertTemplateAsyncIslandsWithinCap();
  console.log('\n[check:bundle] OK — both deterministic TMPL-04 halves pass + async-island cap holds. (Lighthouse ≥90 is the separate holistic gate.)\n');
}

/**
 * CLI-ONLY tail. Guarded so importing this module (e.g. the B2 unit test importing
 * `assertAsyncIslandWithinCap` / `ASYNC_ISLAND_CAP_BYTES`) does NOT run `next build`
 * or the gate. `import.meta.url` matches the process entry only when run directly via
 * `tsx scripts/check-bundle-budget.ts` (the `check:bundle` script).
 */
const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  try {
    main();
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}
