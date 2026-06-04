/**
 * scripts/preview-template.ts — CICD-02's LOCAL preview command (Plan 10-05, Task 3).
 *
 * `npm run preview:template <slug>` gives the operator ONE command to visually review a
 * template's render before acceptance — the human-in-the-loop visual gate (CICD-02). It
 * targets the STACK-FREE `/__fixture/<slug>?variant=full` golden render (Plan 10-02): no
 * Supabase, no DB, no cookies — the simplest reviewable render, the SAME one the
 * conformance / a11y / parity render gates use, so what the operator eyeballs is exactly
 * what the gates measure.
 *
 * This is a DOCUMENTED OPERATOR COMMAND, NOT an automated gate — the previewable build is
 * human visual judgment (RESEARCH "Manual-Only Verifications"). It prints (and, where a
 * platform opener exists, opens) the review URLs; the operator looks at the render and
 * decides. It boots no server itself — it reuses a running `npm run dev` and tells the
 * operator to start one if none is up (the preview render only exists on a dev server;
 * the `__fixture` route is `notFound()` in production by design — Plan 10-02).
 *
 * ── CICD-02 CLOUD HALF — DEFERRED (Vercel preview-per-PR) ──────────────────────
 * CICD-02 has two halves: this local preview (ships NOW) and a Vercel preview-per-PR
 * deployment (the cloud half). The cloud half is DOCUMENTED-FOR-WHEN-LINKED and DEFERRED
 * to Phase 16: there is NO linked Vercel project yet (the $0-now budget keeps the build
 * on the free *.vercel.app, and the first domain dollar is a public-launch expense — see
 * CLAUDE.md / handoff ADR-002). When a Vercel project is linked (Phase 16), each PR gets
 * an automatic preview URL and the operator reviews the real deployed render there; until
 * then, this local `preview:template` command IS the CICD-02 visual-review surface.
 *
 * USAGE:  npm run preview:template <slug>      (e.g. `npm run preview:template editorial`)
 *         npm run preview:template <slug> --null   (also print the all-null review URL)
 *
 * Run with `tsx` (devDep) — the same runner as `check:bundle` / `seed:founder`. No new deps.
 * THIS IS NOT RUNTIME APP CODE — it is an operator preview command, never imported by the app.
 */
import { spawnSync } from 'node:child_process';

import { TEMPLATE_SLUGS } from '../e2e/helpers/slugs';

/** The local dev origin the `__fixture` route + the render gates use (playwright.config baseURL). */
const BASE_URL = 'http://127.0.0.1:3000';

/**
 * The standard-lane slugs — sourced from the SHARED `e2e/helpers/slugs.ts` constant (WR-05).
 * That constant is anchored to `Object.keys(templateRegistry)` by `slugs-anchor.test.ts`, so a
 * Phase-11 template adds one line there and this preview command picks it up.
 */
const KNOWN_SLUGS: readonly string[] = TEMPLATE_SLUGS;

function usage(message?: string): never {
  if (message) console.error(`\n[preview:template] ${message}\n`);
  console.error(
    'Usage: npm run preview:template <slug> [--null]\n' +
      `  <slug>   one of: ${KNOWN_SLUGS.join(', ')} (or any registered template slug)\n` +
      '  --null   also print the all-null review URL (variant=null)\n',
  );
  process.exit(1);
}

/** Best-effort open the URL in the default browser (platform-aware); never fatal if it fails. */
function tryOpen(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === 'win32' ? 'start ""' : platform === 'darwin' ? 'open' : 'xdg-open';
  // `shell:true` so the Windows `start` builtin resolves; failure is non-fatal (URL is printed).
  const res = spawnSync(`${cmd} "${url}"`, { stdio: 'ignore', shell: true });
  if (res.error || (typeof res.status === 'number' && res.status !== 0)) {
    // Opener missing/headless — fine, the operator copies the printed URL.
  }
}

async function isServerUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  // argv[2] is the first user arg under `tsx scripts/preview-template.ts <slug>` /
  // `npm run preview:template <slug>` (npm forwards trailing args to the script).
  const slug = process.argv[2];
  const wantNull = process.argv.includes('--null');

  if (!slug || slug.startsWith('-')) usage('a <slug> argument is required.');
  if (!KNOWN_SLUGS.includes(slug)) {
    console.warn(
      `[preview:template] note: "${slug}" is not a known standard-lane slug ` +
        `(${KNOWN_SLUGS.join(', ')}). Proceeding — the __fixture route 404s an unknown slug.`,
    );
  }

  const fullUrl = `${BASE_URL}/__fixture/${slug}?variant=full`;
  const nullUrl = `${BASE_URL}/__fixture/${slug}?variant=null`;

  const up = await isServerUp(BASE_URL);
  if (!up) {
    console.error(
      `\n[preview:template] no dev server at ${BASE_URL}.\n` +
        '  Start one in another terminal first:  npm run dev\n' +
        '  Then re-run:                          npm run preview:template ' +
        `${slug}\n` +
        '  (The __fixture preview render only exists on a dev server — it is notFound() in production.)\n',
    );
    process.exit(1);
  }

  console.log(`\n[preview:template] CICD-02 local visual review — "${slug}" golden render.`);
  console.log(`  full (golden):  ${fullUrl}`);
  if (wantNull) console.log(`  all-null:       ${nullUrl}`);
  console.log('  Eyeball the render, then accept/reject the template. (Vercel preview-per-PR: deferred to Phase 16.)\n');

  tryOpen(fullUrl);
  if (wantNull) tryOpen(nullUrl);
}

main().catch((err) => {
  console.error(`[preview:template] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
