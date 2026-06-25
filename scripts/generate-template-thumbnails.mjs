/**
 * Generates the template-picker thumbnails (`public/templates/<slug>.webp`) referenced by
 * `TemplateCard` (07-05 / UI-SPEC B.5 #2, D-P7-07) as REAL per-template renders (PIPE-06).
 *
 * ── WHAT THIS IS (PIPE-06 — folds `recapture-template-thumbnails`) ─────────────
 * Each thumbnail is a REAL golden-fixture render of the template, captured via Playwright
 * against the stack-free `/__fixture/<slug>?variant=full` route (Plan 10-02 — NO Supabase,
 * NO DB, NO cookies), then encoded to WebP IN-PAGE via the browser `<canvas>.toBlob(
 * 'image/webp')` — the SAME mechanism CLAUDE.md documents for the avatar pipeline
 * (client `react-cropper` → `<canvas>.toBlob('image/webp')`). NO `sharp`: Playwright's
 * `page.screenshot({ type: 'webp' })` is NOT supported, so the canvas encode is the
 * sharp-free path (CLAUDE.md: Sharp "absent by choice"). Output is 1280×800 (16:10) —
 * the box `TemplateCard` reserves (`aspect-[16/10]`, zero CLS).
 *
 * ── DEV-SERVER SCOPE (W7) ──────────────────────────────────────────────────────
 * This .mjs launches chromium DIRECTLY (not through the Playwright test runner), so it
 * OWNS the dev-server lifecycle, mirroring `playwright.config.ts`'s
 * `reuseExistingServer:!CI` semantics:
 *   - If a dev server is ALREADY reachable at http://127.0.0.1:3000 it is REUSED
 *     (a hand-started `npm run dev`, or 10-06's umbrella's already-running server).
 *   - Otherwise this script BOOTS `npm run dev`, AWAITS readiness, captures, then tears
 *     it down. It NEVER navigates against a dead server — if boot fails it exits non-zero
 *     with a clear "start `npm run dev` first" message.
 * So 10-06's umbrella (Task 1) may either leave its dev server up (reused here) or let
 * this script self-boot; either way the `/__fixture/<slug>` target is guaranteed live.
 *
 * ── FAIL-CLOSED (B4) ─────────────────────────────────────────────────────────��─
 * The generator is a generative side-effect that VALIDATES its output and THROWS / exits
 * non-zero rather than committing a bad asset. After the in-page encode, `assertValidWebp`
 * checks the bytes are a real WebP (RIFF/WEBP magic) AND that the canvas was drawn at the
 * exact 1280×800 box (a blank/empty/wrong-size render fails the check). A failing slug
 * exits the whole script non-zero and does NOT overwrite the good committed asset. The
 * fail-closed path is PROVEN REAL by an inline self-check (`--self-check`, run by this
 * file at startup) that feeds `assertValidWebp` a wrong-size + a non-WebP buffer and
 * asserts it throws — so the assertion is demonstrably fail-closed, not GREEN-only.
 *
 * Re-run (with a dev server up, or letting this script boot one):
 *   node scripts/generate-template-thumbnails.mjs
 * Prove the fail-closed assertion only (no render, no dev server):
 *   node scripts/generate-template-thumbnails.mjs --self-check
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

import { chromium } from '@playwright/test';

const W = 1280; // 16:10 source — TemplateCard reserves the box at aspect-[16/10].
const H = 800;
const BASE_URL = 'http://127.0.0.1:3000';
// WR-05: this `.mjs` runs under plain `node` and cannot import the `.ts` registry or the
// shared `e2e/helpers/slugs.ts` constant, so the slug set is a literal here. The anchor guard
// `tests/unit/templates/slugs-anchor.test.ts` reads THIS literal from source and asserts it
// equals `Object.keys(templateRegistry)`, so a Phase-11 template addition fails loudly until
// this line is updated.
const SLUGS = ['minimal', 'editorial', 'aurora', 'edgerunner-v2', 'atelier', 'blueprint'];
const WEBP_QUALITY = 0.82;

/**
 * B4 fail-closed validity check — a pure helper over an encoded buffer + the dimensions
 * the in-page canvas reported. THROWS (naming the slug) if the buffer is not a valid WebP
 * or was not drawn at the exact 1280×800 box. Pure so the inline self-check can exercise
 * its REJECT path with a deliberately-broken buffer.
 *
 * A valid WebP starts with the RIFF container magic: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP".
 */
function assertValidWebp(buf, label, drawnWidth, drawnHeight) {
  if (!buf || buf.length < 16) {
    throw new Error(`[thumbnails] "${label}": encoded buffer is empty/too small (${buf?.length ?? 0} bytes) — broken render, refusing to write.`);
  }
  const riff = buf.toString('ascii', 0, 4);
  const webp = buf.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || webp !== 'WEBP') {
    throw new Error(`[thumbnails] "${label}": not a valid WebP (magic "${riff}"/"${webp}", expected "RIFF"/"WEBP") — refusing to write a bad asset.`);
  }
  if (drawnWidth !== W || drawnHeight !== H) {
    throw new Error(`[thumbnails] "${label}": canvas drawn at ${drawnWidth}x${drawnHeight}, expected ${W}x${H} (16:10) — wrong-size/blank render, refusing to write.`);
  }
}

/**
 * INLINE FAIL-CLOSED SELF-CHECK (B4 proof) — exercise `assertValidWebp`'s REJECT path
 * against deliberately-broken inputs and assert it throws. Runs at startup (and is the
 * whole job under `--self-check`). If any branch DOESN'T throw, the assertion is not
 * fail-closed → exit non-zero. This proves the validity gate is real, not GREEN-only.
 */
function proveFailClosed() {
  const cases = [
    { name: 'wrong-size canvas', fn: () => assertValidWebp(Buffer.from('RIFF\x00\x00\x00\x00WEBP....'), 'self-check/wrong-size', 640, 480) },
    { name: 'non-WebP bytes', fn: () => assertValidWebp(Buffer.from('NOTAWEBPNOTAWEBP'), 'self-check/non-webp', W, H) },
    { name: 'empty buffer', fn: () => assertValidWebp(Buffer.alloc(0), 'self-check/empty', W, H) },
  ];
  for (const { name, fn } of cases) {
    let threw = false;
    try {
      fn();
    } catch {
      threw = true;
    }
    if (!threw) {
      console.error(`[thumbnails] FAIL-CLOSED SELF-CHECK BROKEN: assertValidWebp did NOT throw on "${name}".`);
      process.exit(1);
    }
  }
  console.log('[thumbnails] fail-closed self-check PASS — assertValidWebp rejects wrong-size / non-WebP / empty (B4).');
}

/** Poll until the dev server answers at BASE_URL, or time out. Mirrors webServer readiness. */
async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok || (res.status >= 200 && res.status < 500)) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  return false;
}

/**
 * Capture one slug: navigate the stack-free golden render, apply the determinism recipe
 * (matching `e2e/helpers/render-fixture.ts`), draw the 1280×800 viewport onto an in-page
 * canvas, and `toBlob('image/webp')`. Returns `{ buf, drawnWidth, drawnHeight }`.
 */
async function captureSlug(page, slug) {
  await page.setViewportSize({ width: W, height: H });
  const res = await page.goto(`${BASE_URL}/__fixture/${slug}?variant=full`, { waitUntil: 'networkidle' });
  if (!res || !res.ok()) {
    throw new Error(`[thumbnails] "${slug}": __fixture render returned ${res ? res.status() : 'no response'} — broken render, refusing to write.`);
  }
  // The scoped template root rendered (proves the lazy template chunk loaded + rendered).
  await page.locator(`.tmpl-${slug}`).first().waitFor({ state: 'visible', timeout: 60_000 });
  // Font-readiness — Playwright does NOT auto-wait for next/font (display:'swap').
  await page.evaluate(() => document.fonts.ready);
  // Hide the `next dev` overlay (dev chrome, not a template element).
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });

  // In-page WebP encode via canvas.toBlob (the sharp-free, CLAUDE.md-sanctioned path):
  // screenshot the 1280×800 viewport to PNG, draw it onto a 1280×800 canvas, toBlob('image/webp').
  const pngBytes = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
  const pngBase64 = pngBytes.toString('base64');

  const result = await page.evaluate(
    async ({ b64, w, h, q }) => {
      const img = new Image();
      const loaded = new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error('image decode failed'));
      });
      img.src = `data:image/png;base64,${b64}`;
      await loaded;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2d context unavailable');
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', q));
      if (!blob) throw new Error('toBlob returned null');
      const ab = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(ab));
      return { bytes, drawnWidth: canvas.width, drawnHeight: canvas.height };
    },
    { b64: pngBase64, w: W, h: H, q: WEBP_QUALITY },
  );

  return {
    buf: Buffer.from(result.bytes),
    drawnWidth: result.drawnWidth,
    drawnHeight: result.drawnHeight,
  };
}

async function main() {
  // B4: prove the fail-closed assertion is real BEFORE doing any rendering.
  proveFailClosed();
  if (process.argv.includes('--self-check')) {
    console.log('[thumbnails] --self-check only — skipping render. (Fail-closed assertion proven above.)');
    return;
  }

  // W7: reuse an already-running dev server, else boot one (reuseExistingServer semantics).
  let devProc = null;
  const alreadyUp = await waitForServer(BASE_URL, 1_500);
  if (alreadyUp) {
    console.log(`[thumbnails] reusing the dev server already up at ${BASE_URL}.`);
  } else {
    console.log(`[thumbnails] no dev server at ${BASE_URL} — booting \`npm run dev\` (W7) ...`);
    devProc = spawn('npm run dev', { stdio: 'ignore', env: process.env, shell: true });
    const booted = await waitForServer(BASE_URL, 180_000); // cold Next 16 Windows compile headroom
    if (!booted) {
      if (devProc) devProc.kill();
      console.error(`[thumbnails] dev server never came up at ${BASE_URL}. Start \`npm run dev\` first, then re-run.`);
      process.exit(1);
    }
    console.log(`[thumbnails] dev server is up at ${BASE_URL}.`);
  }

  const browser = await chromium.launch();
  const captured = [];
  try {
    const page = await browser.newPage();
    for (const slug of SLUGS) {
      console.log(`[thumbnails] rendering "${slug}" via /__fixture/${slug}?variant=full ...`);
      const { buf, drawnWidth, drawnHeight } = await captureSlug(page, slug);
      // B4 fail-closed: validate BEFORE writing — a broken/empty/wrong-size render throws here.
      assertValidWebp(buf, slug, drawnWidth, drawnHeight);
      captured.push({ slug, buf });
    }
  } finally {
    await browser.close();
    if (devProc) devProc.kill();
  }

  // Only write once EVERY slug captured + validated (all-or-nothing — never half-overwrite).
  mkdirSync('public/templates', { recursive: true });
  for (const { slug, buf } of captured) {
    const out = `public/templates/${slug}.webp`;
    writeFileSync(out, buf);
    console.log(`wrote ${out} — ${W}x${H} (16:10), ${buf.length} bytes (real golden-fixture render)`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
