/**
 * scripts/gate-template.mjs — the `gate:template` UMBRELLA (CICD-01; Phase-10 Plan 10-06).
 *
 * The ONE pipeline that composes every template gate into a single "automated validation
 * that runs on every template change and BLOCKS ON ANY SINGLE FAILURE" (CICD-01 criterion 1).
 * It REPLACES the Plan-10-01 fail-loud placeholder (B3) — the placeholder existed only to
 * prevent a between-waves false-GREEN; now that every sub-gate exists (Plans 10-03/04/05),
 * this runner is the real LOCAL source of truth (D-P10-01) and `ci.yml` is its mirror.
 *
 * ── THE LOAD-BEARING ORDER (RESEARCH §System Architecture Diagram + §Pitfall 2) ──────────
 * The order is not cosmetic — the build-dependent gates need `.next/` to exist, and the
 * cheap/ordering-independent gates run first so a cheap failure fails fast:
 *
 *   TIER 0  tsc --noEmit              ← W5: CICD-01 literally NAMES tsc. The cheapest possible
 *                                       fail-fast + makes the requirement traceable, even
 *                                       though `next build` (Tier 2) also type-checks.
 *   TIER 1  STATIC (Vitest `unit`)    ← no stack, no build. Fast, fail-first:
 *             gate:security             TS-AST + regex over <slug>/** (D-13/14)
 *             gate:isolation            kit-isolation generalized + token-conformance (D-17)
 *             gate:registry             4-surface registry consistency + neg-fixture absence (CICD-03)
 *             async-island-cap unit     the B2 reject-predicate RED proof (PIPE-08 / CONTRACT §5)
 *   TIER 2  next build (ONCE)         ← produces `.next/` (D-P10-01a: BEFORE the gates below)
 *   TIER 3  BUILD-ARTIFACT (reads .next/, reuses the Tier-2 build — NO double build):
 *             check:bundle --skip-build ≤200kB gz First Load JS + ●SSG/ISR + async-island cap
 *             route-table-ssg test      the D-22 /[username] SSG/ISR invariant
 *   TIER 4  RENDER (Playwright)       ← boots/reuses `npm run dev` (playwright.config webServer):
 *             gate:conformance          PIPE-05 (no drop, no null/undef leak) + neg-control
 *             gate:a11y                 axe serious/critical hard-fail + the B1 neg-control RED
 *             gate:parity              golden-fixture visual parity (PIPE-11)
 *
 * ── FAIL POLICY (CICD-01 "blocks on ANY single failure") ─────────────────────────────────
 *   - Tiers 0/1/2 are FAIL-FAST: cheap + strictly ordering-dependent. A tsc failure, a static
 *     gate failure, or a failed build STOPS the run immediately (no point building on a type
 *     error; no point running build-artifact gates without `.next/`).
 *   - Tiers 3/4 RUN-ALL-THEN-AGGREGATE: once the build exists, run every remaining gate so an
 *     operator sees ALL failing gates in one run (a single re-run surfaces the full picture),
 *     then exit non-zero if ANY failed.
 *   In every case the umbrella's OWN exit code is NON-ZERO if ANY sub-gate exited non-zero,
 *   and the runner NAMES the failing gate(s). A gate that silently no-ops cannot false-GREEN
 *   the run: each sub-gate's reject path is independently proven RED on the negative fixture
 *   (D-P10-02), so "only ever passed" is not "trusted".
 *
 * ── THE CORPUS / SLUG ARG (RESEARCH Open Question 1) ─────────────────────────────────────
 * For Phase 10 the umbrella runs UNPARAMETERIZED over the whole corpus: every sub-gate already
 * generalizes over `Object.keys(templateRegistry)` (→ minimal + editorial) AND exercises the
 * negative fixture (`tests/fixtures/broken-template/`) via its own both-polarities tests. A
 * `npm run gate:template -- <slug>` arg is accepted + echoed as a Phase-11 invocation NOTE
 * (per-slug focus); in Phase 10 it does not narrow the gates (the gate scripts are corpus-wide
 * by construction), so the default corpus run is the contract.
 *
 * ── THUMBNAILS (W7) — OUT OF THE UMBRELLA, BY DESIGN ─────────────────────────────────────
 * `generate-template-thumbnails.mjs` (PIPE-06) is a GENERATIVE OPERATOR SIDE-EFFECT (it writes
 * `public/templates/<slug>.webp`), NOT a pass/fail gate — so it is NOT invoked by this umbrella.
 * It OWNS its own dev-server lifecycle (reuse-if-up, else self-boot + teardown; see its header),
 * so it never hits a dead server regardless of how the umbrella runs. Run it separately:
 *   node scripts/generate-template-thumbnails.mjs
 * (The umbrella never invokes it against a dead server — it simply does not invoke it at all.)
 *
 * THIS IS NOT RUNTIME APP CODE — it is a build/CI gate runner, never imported by the app.
 *
 * USAGE:  npm run gate:template            (whole corpus)
 *         npm run gate:template -- minimal (Phase-11 per-slug focus note; Phase-10 no-narrow)
 */
import { spawnSync } from 'node:child_process';

/**
 * Run a command string through the shell and return its exit status (0 = pass).
 *
 * `shell: true` is REQUIRED on Windows + Node ≥20: a bare `spawnSync('npm', …)` (or `npm.cmd`)
 * throws EINVAL because Node refuses to spawn `.cmd`/`.bat` shims without a shell. Running the
 * command STRING through the shell resolves the platform npm/npx shim correctly on Windows,
 * macOS, and Linux alike — the SAME mechanic `scripts/check-bundle-budget.ts:158` uses.
 */
function run(label, command) {
  console.log(`\n[gate:template] ▶ ${label}\n    $ ${command}`);
  const res = spawnSync(command, { stdio: 'inherit', env: process.env, shell: true });
  if (res.error) {
    console.error(`[gate:template] ✗ ${label} — could not spawn: ${res.error.message}`);
    return 1;
  }
  const status = res.status ?? (res.signal ? 1 : 1);
  if (status === 0) {
    console.log(`[gate:template] ✓ ${label}`);
  } else {
    console.error(`[gate:template] ✗ ${label} — exited ${status}`);
  }
  return status;
}

/** A tier of gates: a label + the ordered [label, command] steps it runs. */
function runFailFast(tierLabel, steps) {
  console.log(`\n========== ${tierLabel} (fail-fast) ==========`);
  for (const [label, command] of steps) {
    const status = run(label, command);
    if (status !== 0) {
      return { failed: [label] };
    }
  }
  return { failed: [] };
}

function runAggregate(tierLabel, steps) {
  console.log(`\n========== ${tierLabel} (run-all, aggregate) ==========`);
  const failed = [];
  for (const [label, command] of steps) {
    const status = run(label, command);
    if (status !== 0) failed.push(label);
  }
  return { failed };
}

function main() {
  // RESEARCH Open Question 1 — accept + echo an optional slug arg (Phase-11 focus note).
  // In Phase 10 the gate scripts are corpus-wide by construction, so the arg does not narrow.
  const slugArg = process.argv.slice(2).find((a) => !a.startsWith('-'));
  if (slugArg) {
    console.log(
      `[gate:template] NOTE: slug arg "${slugArg}" received. Phase-10 gates are corpus-wide ` +
        `(every sub-gate generalizes over Object.keys(templateRegistry) + the negative fixture), ` +
        `so the arg does NOT narrow the run here — it is the Phase-11 per-slug invocation note ` +
        `(RESEARCH Open Question 1). Running the full corpus.`,
    );
  }

  console.log(
    '[gate:template] CICD-01 umbrella — tsc → static → next build → build-artifact → render. ' +
      'Blocks on ANY single sub-gate failure.',
  );

  const allFailed = [];

  // TIER 0 — tsc --noEmit FIRST (W5: CICD-01 names tsc; cheapest fail-fast).
  let tier = runFailFast('TIER 0 — type-check (W5)', [
    ['tsc --noEmit (W5 — CICD-01 named gate)', 'npx tsc --noEmit'],
  ]);
  allFailed.push(...tier.failed);
  if (tier.failed.length) return finish(allFailed);

  // TIER 1 — STATIC gates (Vitest unit; no stack, no build). Fail-fast on the cheap tier.
  tier = runFailFast('TIER 1 — static gates', [
    ['gate:security (D-13/14)', 'npm run gate:security'],
    ['gate:isolation (D-17 + token-conformance)', 'npm run gate:isolation'],
    ['gate:registry (CICD-03)', 'npm run gate:registry'],
    [
      'async-island-cap unit (B2 — reject predicate RED)',
      'npx vitest run tests/unit/templates/async-island-cap.test.ts',
    ],
  ]);
  allFailed.push(...tier.failed);
  if (tier.failed.length) return finish(allFailed);

  // TIER 2 — next build ONCE (produces .next/; D-P10-01a: BEFORE the build-artifact gates).
  tier = runFailFast('TIER 2 — next build (produces .next/)', [
    ['next build', 'npx next build'],
  ]);
  allFailed.push(...tier.failed);
  if (tier.failed.length) return finish(allFailed);

  // TIER 3 — BUILD-ARTIFACT gates: reuse the Tier-2 build (--skip-build, NO double build).
  tier = runAggregate('TIER 3 — build-artifact gates', [
    ['check:bundle --skip-build (≤200kB gz + ●SSG/ISR + async cap)', 'npm run check:bundle -- --skip-build'],
    [
      'route-table-ssg (D-22 SSG/ISR invariant)',
      'npx vitest run --project unit tests/build/route-table-ssg.test.ts',
    ],
  ]);
  allFailed.push(...tier.failed);

  // TIER 4 — RENDER gates (Playwright boots/reuses `npm run dev` per playwright.config webServer).
  tier = runAggregate('TIER 4 — render gates', [
    ['gate:conformance (PIPE-05 + neg-control)', 'npm run gate:conformance'],
    ['gate:a11y (axe serious/critical + B1 neg-control)', 'npm run gate:a11y'],
    ['gate:parity (PIPE-11 golden-fixture parity)', 'npm run gate:parity'],
  ]);
  allFailed.push(...tier.failed);

  return finish(allFailed);
}

function finish(allFailed) {
  console.log('\n================ gate:template SUMMARY ================');
  if (allFailed.length === 0) {
    console.log('[gate:template] ✓ ALL GATES GREEN — the CICD-01 pipeline passed end-to-end.\n');
    process.exit(0);
  }
  console.error(
    `[gate:template] ✗ FAILED — ${allFailed.length} gate(s) RED: ${allFailed.join(', ')}.\n` +
      '  ANY single sub-gate failure fails the whole umbrella (CICD-01). Fix the named gate(s).\n',
  );
  process.exit(1);
}

main();
