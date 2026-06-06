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
 *   (3) a per-template **async-island scene chunk exceeds the async-island cap
 *       (`ASYNC_ISLAND_CAP_BYTES`, 320 kB gz — Phase 13 tune; was 250 in P10)** —
 *       the Phase-10 ADDITION (PIPE-08 / CONTRACT §5). The rich/viz lane ships a lazy
 *       `{ ssr: false }` scene island (Three.js / R3F) that, by construction,
 *       appears in NEITHER the route's `rootMainFiles` NOR the page
 *       client-reference-manifest's EAGER set (CONTRACT §5), so the First-Load-JS
 *       gate above genuinely cannot see it — it needs its OWN measurement path
 *       governed by a SEPARATE async-island sanity cap. The standard-lane templates
 *       (`minimal` / `editorial`) ship NO async scene chunk, so the live `.next/`
 *       scan legitimately NO-OPS on a pre-edgerunner corpus ("no async scene chunk
 *       → pass"); once `edgerunner` is built, `discoverAsyncSceneChunks()` locates
 *       its lazy Scene chunk via the client-reference manifests and bounds it.
 *       The reject LOGIC is still proven NOW: the cap predicate is EXPORTED
 *       (`assertAsyncIslandWithinCap`) and unit-exercised against a synthetic
 *       over-cap input by `tests/unit/templates/async-island-cap.test.ts` (B2 /
 *       D-P10-02 — a witnessed failure of the real code path, NOT a deferred stub).
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
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** The hard TMPL-04 budget: client First Load JS for the public route. */
const FIRST_LOAD_JS_BUDGET_BYTES = 200 * 1024; // 200 kB gzipped (D-25)

/**
 * The per-template async-island sanity cap (PIPE-08 / CONTRACT §5). The rich/viz
 * lane's lazy `{ ssr: false }` scene chunk (Three.js / R3F) is NOT counted in the
 * route's First Load JS (it appears in neither `rootMainFiles` nor the page
 * client-reference-manifest), so it is bounded by THIS separate cap. The
 * standard-lane corpus (minimal/editorial) ships no async scene chunk, so the live
 * scan no-ops; the cap's REJECT path is unit-proven against a synthetic over-cap
 * input (B2 / D-P10-02).
 *
 * ── Phase 13 tune (D-05, RESEARCH §1 [HEADLINE]) ─────────────────────────────────
 * Raised from the Phase-10 starting figure (250 kB) to 320 kB gz. The first
 * rich-lane template (`edgerunner`) measured an esbuild floor of ~235.4 kB gz for
 * the real `HoloShape` scene (three@0.184.0 + @react-three/fiber@9.6.1 +
 * @react-three/drei@10.7.7, react/react-dom external, gzip -9) — three.js core
 * (~234 kB) dominates and does not tree-shake; drei's named helpers add ~0.5 kB.
 * 320 kB = measured 235 + ~36% headroom: it absorbs Turbopack chunking overhead, a
 * future minor `three` bump, and the D-03 "3D amplification" follow-up, while still
 * catching the real failure modes (a 1 MB texture dump or `import * from 'three'`
 * would blow well past 320, and 350 is the D-05 ceiling so a regression toward it
 * still signals). The 235 kB figure is from esbuild, NOT Next/Turbopack.
 *
 * MANDATORY plan-07 re-evaluation: 320 is PROVISIONAL. After `edgerunner` is
 * registered + a real `next build` runs, the LIVE `discoverAsyncSceneChunks()` below
 * reads the ACTUAL gzipped `.next/` Scene chunk. Plan 07 records that real number in
 * INGEST-MANIFEST.md and, if it exceeds ~290 kB (i.e. eats most of the 320 headroom),
 * re-evaluates the cap UPWARD toward 350 (still in the D-05 band) AND audits for an
 * accidental `import * from 'three'`. Do NOT assume 235 is the shipped number.
 */
export const ASYNC_ISLAND_CAP_BYTES = 320 * 1024; // 320 kB gzipped (D-05 / RESEARCH §1; was 250 in P10)

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
 * scene chunk and a human-readable `label` (the slug + construct that produced it),
 * THROW an `Error` whose message NAMES the over-cap construct and its size vs the cap
 * when `gzippedBytes` exceeds {@link ASYNC_ISLAND_CAP_BYTES}; return silently otherwise.
 *
 * This is the code path the B2 unit test exercises with a synthetic over-cap value
 * (`tests/unit/templates/async-island-cap.test.ts`) — NOT a mock that "activates at
 * Phase 13". Keeping the size check a pure function over a byte length (rather than
 * buried inside the `.next/`-scanning driver) is what makes it unit-exercisable
 * before any rich-lane template exists to measure.
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
 * The LIVE driver — locate each template's own lazy `{ ssr: false }` scene chunk in
 * `.next/`, gzip it, and feed it to {@link assertAsyncIslandWithinCap}. The standard
 * lane (minimal/editorial) ships NO async scene chunk, so there is legitimately
 * nothing to measure and the driver NO-OPS ("no async scene chunk → pass") — it must
 * NOT fail on absence. A real rich-lane template (Phase 13) registers its async chunk
 * here; the chunk's gzipped size is then bounded by the cap. The chunk is gzipped with
 * the SAME `gzipSync(readFileSync(abs), { level: 9 }).length` mechanic
 * `collectRouteClientChunks` uses for First Load JS, so the two measurements agree.
 *
 * Discovery (Phase 13 — LIVE): a rich-lane template's lazy `{ ssr: false }` scene
 * island is recorded in the page client-reference manifests. Each page emits a
 * `*_client-reference-manifest.js` that assigns `globalThis.__RSC_MANIFEST[page] = {
 * clientModules: { "[project]/<src module path>": { chunks: [...] }, ... } }`. A
 * `dynamic(() => import('./Scene'), { ssr: false })` lazy module appears in that
 * `clientModules` map keyed by its source path (e.g.
 * `[project]/src/components/templates/edgerunner/Scene.tsx`), with its `chunks` array
 * pointing at the on-disk `static/chunks/*.js`. `discoverAsyncSceneChunks()` scans
 * every page manifest, matches the rich-lane Scene module by source path, resolves +
 * dedupes its chunk files, and returns them. It returns `[]` when no such module is
 * found — a pre-edgerunner build or the standard lane — so the live scan still
 * no-ops and never false-fails on absence.
 */

/** The rich-lane Scene source-path marker (matched against the manifest keys). */
const ASYNC_SCENE_MODULE_MARKER = /\/components\/templates\/([A-Za-z0-9_-]+)\/Scene\.[jt]sx?\b/;

/**
 * SECOND DISCOVERY PATH (13-07 — MOUNT-GATED LAZY scenes). The `clientModules` scan above
 * only records a `{ ssr: false }` module in a page's client-reference manifest when it is
 * part of that page's STATIC RSC reference graph. edgerunner's `HoloShape` MOUNT-GATES its
 * `dynamic(() => import('./Scene'), { ssr: false })` behind a `useEffect` + `mounted` flag
 * (it returns `null` until the client mounts), so at static-prerender time the Scene client
 * module is NOT in the `/[username]` page's `clientModules` — that scan legitimately finds
 * nothing for it (verified on the real Turbopack build). The chunk is STILL fully code-split
 * (NOT in the route's First Load JS), but it is recorded in the canonical `next/dynamic`
 * lazy-module manifest instead: `react-loadable-manifest.json` (one per page), whose entries
 * carry the lazy module's `files: ["static/chunks/*.js", ...]`. Those keys are NUMERIC module
 * IDs (no source path), so the rich-lane Scene chunk is identified by CONTENT — a chunk that
 * actually imports `three`/`@react-three/*` (the rich/viz-lane runtime fingerprint). This
 * locates a mount-gated scene chunk so the cap is asserted against the REAL chunk (not a
 * silent `[]` no-op). It is ADDITIVE: a non-mount-gated `{ ssr: false }` Scene is still caught
 * by the `clientModules` source-path path; the two are deduped by abs-path.
 */
const RICH_LANE_CHUNK_SIGNATURE =
  /@react-three\/fiber|react-three-fiber|new WebGLRenderer|three\.module|Icosahedron|WebGLRenderer/;

/** The per-page `next/dynamic` lazy-module manifest filename. */
const REACT_LOADABLE_MANIFEST = 'react-loadable-manifest.json';

/** All page client-reference manifests Turbopack emits under `.next/server/app`. */
const APP_SERVER_DIR = path.join(NEXT_DIR, 'server', 'app');

/** Recursively collect every `*_client-reference-manifest.js` under `.next/server/app`. */
function findClientRefManifests(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findClientRefManifests(full, acc);
    else if (entry.isFile() && entry.name.endsWith('_client-reference-manifest.js')) acc.push(full);
  }
  return acc;
}

/**
 * Parse the `clientModules` map out of a `*_client-reference-manifest.js` file. The
 * file is a `globalThis.__RSC_MANIFEST[page] = {...JSON...};` assignment; extract the
 * `{...}` object literal (it is plain JSON) and JSON.parse it. Returns `null` if the
 * shape is unexpected (the gate then simply finds no scene chunk in that file).
 */
function parseClientModules(
  manifestFile: string,
): Record<string, { chunks?: string[] }> | null {
  let raw: string;
  try {
    raw = readFileSync(manifestFile, 'utf8');
  } catch {
    return null;
  }
  // The assignment is `...__RSC_MANIFEST[...] = { ... };` — slice from the first `{`
  // after the `=` to the matching trailing `}` (the object is the rest of the line
  // before the final `;`). The payload is JSON (double-quoted keys), so JSON.parse it.
  const eq = raw.indexOf('=');
  if (eq === -1) return null;
  const objStart = raw.indexOf('{', eq);
  const objEnd = raw.lastIndexOf('}');
  if (objStart === -1 || objEnd === -1 || objEnd <= objStart) return null;
  try {
    const parsed = JSON.parse(raw.slice(objStart, objEnd + 1)) as {
      clientModules?: Record<string, { chunks?: string[] }>;
    };
    return parsed.clientModules ?? null;
  } catch {
    return null;
  }
}

/** Recursively collect every `react-loadable-manifest.json` under `.next/server`. */
function findReactLoadableManifests(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findReactLoadableManifests(full, acc);
    else if (entry.isFile() && entry.name === REACT_LOADABLE_MANIFEST) acc.push(full);
  }
  return acc;
}

/**
 * SECOND DISCOVERY PATH (13-07) — locate a MOUNT-GATED rich-lane Scene chunk via the
 * `react-loadable-manifest.json` (the canonical `next/dynamic` lazy-module manifest). Each
 * entry is `{ id, files: ["static/chunks/*.js", ...] }`; the keys are numeric module IDs
 * (no source path), so a candidate JS chunk is confirmed as a rich-lane Scene island by
 * CONTENT — it must carry the `three`/`@react-three/*` runtime signature. Adds confirmed
 * chunks to `byAbs` (deduped with the `clientModules` path) labeled `richviz/Scene`.
 */
function collectLoadableSceneChunks(byAbs: Map<string, string>): void {
  const serverDir = path.join(NEXT_DIR, 'server');
  for (const manifestFile of findReactLoadableManifests(serverDir)) {
    let manifest: Record<string, { files?: string[] }>;
    try {
      manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as Record<
        string,
        { files?: string[] }
      >;
    } catch {
      continue; // unreadable/odd shape — the gate simply finds no chunk in this file
    }
    for (const entry of Object.values(manifest)) {
      const files = Array.isArray(entry.files) ? entry.files : [];
      for (const file of files) {
        if (!file.endsWith('.js')) continue;
        const rel = file.replace(/^\/_next\//, '').replace(/^\//, '');
        const abs = path.join(NEXT_DIR, rel);
        if (byAbs.has(abs)) continue; // already found via the clientModules path
        if (!existsSync(abs) || !statSync(abs).isFile()) continue;
        // CONTENT confirmation: only a chunk that actually pulls in three/R3F is a
        // rich-lane Scene island (keeps an unrelated future lazy chunk from tripping the cap).
        const content = readFileSync(abs, 'utf8');
        if (!RICH_LANE_CHUNK_SIGNATURE.test(content)) continue;
        byAbs.set(abs, 'richviz/Scene');
      }
    }
  }
}

function discoverAsyncSceneChunks(): { abs: string; label: string }[] {
  // Map a normalized chunk abs-path → its template-scoped label so the same chunk
  // discovered across multiple page manifests (or via the `<module evaluation>`
  // duplicate keys) is measured once.
  const byAbs = new Map<string, string>();

  // PATH 1 — the page client-reference manifests (`clientModules`, source-path keyed).
  // Catches a `{ ssr: false }` Scene that is in a page's STATIC RSC reference graph.
  for (const manifestFile of findClientRefManifests(APP_SERVER_DIR)) {
    const clientModules = parseClientModules(manifestFile);
    if (!clientModules) continue;
    for (const [moduleKey, mod] of Object.entries(clientModules)) {
      const m = ASYNC_SCENE_MODULE_MARKER.exec(moduleKey);
      if (!m) continue; // not a rich-lane Scene module
      const slug = m[1]; // e.g. "edgerunner"
      const chunks = Array.isArray(mod.chunks) ? mod.chunks : [];
      for (const chunk of chunks) {
        // Manifest chunks are emitted as `/_next/static/chunks/*.js`; the on-disk
        // path drops the leading `/_next/` and is rooted at `.next/`. Only JS chunks
        // contribute to the scene's JS weight (CSS is measured elsewhere).
        if (!chunk.endsWith('.js')) continue;
        const rel = chunk.replace(/^\/_next\//, '').replace(/^\//, '');
        const abs = path.join(NEXT_DIR, rel);
        byAbs.set(abs, `${slug}/Scene`);
      }
    }
  }

  // PATH 2 — the react-loadable manifests (mount-gated lazy scenes, content-confirmed).
  // Catches edgerunner's `HoloShape`-mount-gated `{ ssr: false }` Scene that PATH 1 misses.
  collectLoadableSceneChunks(byAbs);

  return [...byAbs.entries()].map(([abs, label]) => ({ abs, label }));
}

function assertTemplateAsyncIslandsWithinCap(): void {
  const sceneChunks = discoverAsyncSceneChunks();
  if (sceneChunks.length === 0) {
    console.log(
      '[check:bundle] PASS async-island-cap: no lazy { ssr: false } scene chunk on the ' +
        'standard lane (minimal/editorial) — nothing to measure (no-op until a Phase-13 ' +
        `rich-lane template ships). Cap is ${(ASYNC_ISLAND_CAP_BYTES / 1024).toFixed(0)} kB gz.`,
    );
    return;
  }
  for (const { abs, label } of sceneChunks) {
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      fail(`async-island scene chunk listed for "${label}" does not exist on disk: ${abs}`);
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
