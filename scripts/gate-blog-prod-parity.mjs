/**
 * scripts/gate-blog-prod-parity.mjs — the PRODUCTION-SERVED blog-engine parity gate
 * (debug `blog-posts-empty-prod-build` — 13.2-07 gate hardening).
 *
 * ── WHY THIS GATE EXISTS (the bug it locks out) ──────────────────────────────────────────
 * The dogfood blog-engine parity check (`e2e/blog-engine-parity.spec.ts`) runs against
 * `next dev` (playwright.config.ts `webServer: npm run dev`). `next dev` renders every
 * route on-demand at request time, so it can NEVER observe a STALE or BROKEN PRODUCTION
 * PRERENDER — the exact failure mode that slipped past the gate: a `.next` built before the
 * 3 founder posts were seeded served the EMPTY blog state ("// no transmissions yet") under
 * `next start`, while `next dev` showed all 3 posts. Visual-parity baselines (pixels, against
 * dev) cannot catch a prerender that bakes in the wrong DATA.
 *
 * This gate closes that gap with a CONTENT assertion against the PRODUCTION-served output:
 * it owns a full `next build` → `next start` → fetch → assert → teardown lifecycle and FAILS
 * LOUDLY if the production HTML for the founder's blog routes is missing the seeded posts or
 * shows the empty state. It can never false-GREEN against dev because it builds + serves prod
 * itself. This is the production analog of the dev-bound `e2e/blog-engine-parity.spec.ts`.
 *
 * ── WHAT IT ASSERTS (D-22 / SC-3) ────────────────────────────────────────────────────────
 *   /jadrianports/blog              → contains all 3 seeded post slugs; ZERO "no transmissions yet".
 *   /jadrianports/blog/<newest>     → its KEEP READING strip links ≥1 OTHER seeded post slug.
 *   /jadrianports/services          → 200 (the working sibling route — proves the serve is healthy).
 * Each route MUST also be served STATIC/ISR (the prerendered .html exists in .next) — a route
 * that fell back to dynamic would still serve the content but would silently break D-22; the
 * route-table-ssg vitest gate is the dedicated SSG/ISR assertion, this gate adds the prerender
 * FILE-EXISTENCE check as a cheap belt-and-suspenders.
 *
 * ── PRECONDITION (LOAD-BEARING) ──────────────────────────────────────────────────────────
 * The LOCAL Supabase stack must be UP and the 3 founder posts SEEDED + PUBLISHED:
 *     supabase start
 *     npm run seed:founder
 * A missing seed makes the build prerender the empty state — which is EXACTLY what this gate
 * is built to fail on, so it fails loudly with that hint rather than silently skipping.
 *
 * NOT runtime app code — a build/serve gate, never imported by the app.
 *
 * USAGE:  npm run gate:blog-prod
 *         npm run gate:blog-prod -- --skip-build   (reuse an existing .next; faster local re-run)
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3000;
const ORIGIN = `http://localhost:${PORT}`;
const SEEDED_USERNAME = 'jadrianports';

/** The 3 seeded founder post slugs (D-27 — MUST match seed-founder-portfolio.ts + generateStaticParams). */
const POST_SLUGS = ['shipping-on-the-edge', 'neon-motion-design', 'type-safety-or-die'];
/** The newest post (display_date 2026-04-18) — its detail page anchors the KEEP READING check. */
const NEWEST_SLUG = 'shipping-on-the-edge';
/** The empty-state sentinel the broken prerender served (blog-index-content.tsx). MUST be ABSENT. */
const EMPTY_SENTINEL = 'no transmissions yet';

const log = (m) => console.log(`[gate:blog-prod] ${m}`);
const err = (m) => console.error(`[gate:blog-prod] ✗ ${m}`);

/** Run a command STRING through the shell (Windows .cmd-shim safe — same mechanic as gate-template.mjs). */
function run(label, command) {
  log(`▶ ${label}\n    $ ${command}`);
  const res = spawnSync(command, { stdio: 'inherit', env: process.env, shell: true, cwd: ROOT });
  return res.status ?? 1;
}

/** Best-effort: free port 3000 so `next start` can bind it (a leftover npm start would EADDRINUSE). */
function freePort() {
  if (process.platform === 'win32') {
    // PowerShell: kill whatever owns the port-3000 listener, if anything.
    spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | ` +
          `Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }`,
      ],
      { stdio: 'ignore' },
    );
  } else {
    spawnSync('bash', ['-c', `fuser -k ${PORT}/tcp 2>/dev/null || true`], { stdio: 'ignore' });
  }
}

async function waitForReady(child, timeoutMs = 60_000) {
  const start = Date.now();
  let ready = false;
  child.stdout.on('data', (d) => {
    if (/Ready in|started server on|Local:/i.test(String(d))) ready = true;
  });
  while (!ready && Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`next start exited early (code ${child.exitCode})`);
    try {
      const res = await fetch(`${ORIGIN}/${SEEDED_USERNAME}/services`, { redirect: 'manual' });
      if (res.status > 0) ready = true;
    } catch {
      /* not up yet */
    }
    if (!ready) await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw new Error(`next start did not become ready within ${timeoutMs}ms`);
}

async function fetchText(urlPath) {
  const res = await fetch(`${ORIGIN}${urlPath}`);
  return { status: res.status, body: await res.text() };
}

async function main() {
  const skipBuild = process.argv.includes('--skip-build');
  const failures = [];

  // (1) Build the production output (unless reusing an existing .next).
  if (!skipBuild) {
    freePort();
    const code = run('next build (production prerender)', 'npx next build');
    if (code !== 0) {
      err('next build failed — cannot validate the production blog render.');
      process.exit(1);
    }
  } else {
    log('--skip-build: reusing the existing .next (assumes a recent `npm run build`).');
  }

  // (2) Cheap belt-and-suspenders: the founder blog routes MUST have been PRERENDERED.
  // A missing .html means the route fell back to dynamic OR the build saw no portfolio —
  // either way the D-22 SSG/ISR contract is broken (route-table-ssg is the formal gate).
  const prerendered = [
    `${SEEDED_USERNAME}/blog.html`,
    ...POST_SLUGS.map((s) => `${SEEDED_USERNAME}/blog/${s}.html`),
  ];
  for (const rel of prerendered) {
    const p = path.join(ROOT, '.next', 'server', 'app', rel);
    if (!existsSync(p)) {
      failures.push(`missing prerender: .next/server/app/${rel} (route not statically prerendered — D-22 broken)`);
    }
  }

  // (3) Serve the production build and assert the SERVED content.
  freePort();
  log('starting `next start`…');
  // Pass the command as a STRING (not args array) under shell:true — avoids the Node DEP0190
  // shell-arg warning and resolves the Windows npx/.cmd shim the same way gate-template.mjs does.
  const server = spawn('npx next start', { cwd: ROOT, env: process.env, shell: true });
  let serverStderr = '';
  server.stderr.on('data', (d) => (serverStderr += String(d)));

  try {
    await waitForReady(server);
    log('server ready — fetching production routes.');

    // 3a. Blog index — all 3 slugs present, empty sentinel ABSENT.
    const index = await fetchText(`/${SEEDED_USERNAME}/blog`);
    if (index.status !== 200) {
      failures.push(`GET /${SEEDED_USERNAME}/blog returned ${index.status} (expected 200; seed the founder posts?)`);
    } else {
      if (index.body.includes(EMPTY_SENTINEL)) {
        failures.push(
          `/${SEEDED_USERNAME}/blog served the EMPTY state ("${EMPTY_SENTINEL}") — the production ` +
            'prerender baked in zero posts (stale .next or unseeded DB). This is the exact bug this gate locks out.',
        );
      }
      const missing = POST_SLUGS.filter((s) => !index.body.includes(s));
      if (missing.length) {
        failures.push(`/${SEEDED_USERNAME}/blog is missing seeded post slug(s): ${missing.join(', ')}`);
      }
    }

    // 3b. Newest post detail — KEEP READING links ≥1 OTHER seeded post.
    const post = await fetchText(`/${SEEDED_USERNAME}/blog/${NEWEST_SLUG}`);
    if (post.status !== 200) {
      failures.push(`GET /${SEEDED_USERNAME}/blog/${NEWEST_SLUG} returned ${post.status} (expected 200)`);
    } else {
      const others = POST_SLUGS.filter((s) => s !== NEWEST_SLUG).filter((s) =>
        post.body.includes(`/${SEEDED_USERNAME}/blog/${s}`),
      );
      if (others.length === 0) {
        failures.push(
          `/${SEEDED_USERNAME}/blog/${NEWEST_SLUG} KEEP READING strip is EMPTY — getPublishedPosts ` +
            'returned no sibling posts in the production prerender (the KEEP-READING half of the reported bug).',
        );
      }
    }

    // 3c. Services — the working sibling route is healthy (proves the serve itself is fine).
    const services = await fetchText(`/${SEEDED_USERNAME}/services`);
    if (services.status !== 200) {
      failures.push(`GET /${SEEDED_USERNAME}/services returned ${services.status} (expected 200)`);
    }
  } catch (e) {
    failures.push(`serve/fetch error: ${e.message}${serverStderr ? `\n  stderr: ${serverStderr.slice(0, 500)}` : ''}`);
  } finally {
    server.kill('SIGTERM');
    // On Windows SIGTERM may not propagate to the child `next` — free the port to be sure.
    freePort();
  }

  // (4) Verdict.
  console.log('\n================ gate:blog-prod SUMMARY ================');
  if (failures.length === 0) {
    log('✓ PRODUCTION blog render GREEN — 3 posts on /blog, populated KEEP READING, services healthy.\n');
    process.exit(0);
  }
  err(`FAILED — ${failures.length} assertion(s) RED:`);
  for (const f of failures) console.error(`    • ${f}`);
  console.error(
    '\n  Precondition: `supabase start` then `npm run seed:founder` (the 3 founder posts must be ' +
      'seeded + published), then re-run `npm run gate:blog-prod`.\n',
  );
  process.exit(1);
}

main();
