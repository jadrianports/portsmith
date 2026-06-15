/**
 * Captures the two committed landing-page proof screenshots
 * (`public/landing/showcase-{dev,aurora}.webp`) the front-door proof block renders
 * (Phase 22, Plan 22-04 — LAND-03 / D-03 / D-04 / D-05 / D-12). Sibling of
 * `generate-template-thumbnails.mjs`: the SAME Playwright + in-page
 * `<canvas>.toBlob('image/webp')` mechanism, the SAME fail-closed guard — only the
 * navigation TARGET differs (the LIVE `/[username]` pages, not the stack-free fixture).
 *
 * ── WHAT THIS IS (LAND-03 / D-03) ──────────────────────────────────────────────
 * The landing proof block (`src/components/landing/showcase-card.tsx`) shows two
 * contrasting PUBLISHED portfolios via committed STATIC `<img>` screenshots (NOT live
 * iframes — those would load the heavy template bundle on `/` and break the LAND-05
 * SSG perf posture). Each card's browser-frame address bar prints the production host
 * `portsmith.vercel.app/<username>` and links to the live page, so the screenshot MUST
 * be of that exact live `/[username]` page (D-05). This script captures:
 *   - `public/landing/showcase-dev.webp`    ← the LIVE `/jadrianports` (founder dev / edgerunner-v2)
 *   - `public/landing/showcase-aurora.webp` ← the LIVE `/aurora-demo`  (seeded marketer / aurora)
 *
 * PITFALL 3 / T-22-07 (the ONE change from the thumbnail script): the thumbnail
 * generator navigates the stack-free `/__fixture/<slug>?variant=full` route (fixture
 * content at no real URL); THIS script navigates the LIVE `${BASE_URL}/${username}`
 * pages and waits on a real-portfolio landmark (the rendered `<main>`), so each
 * screenshot matches the live page its browser-frame URL points at.
 *
 * The WebP encode is the in-page `<canvas>.toBlob('image/webp')` path (the Sharp-free,
 * CLAUDE.md-sanctioned encode — `page.screenshot({ type: 'webp' })` is unsupported and
 * Sharp is "absent by choice"). Output is 1280×800 (16:10) — the box the proof card
 * reserves (`aspect-[16/10] object-cover`, zero CLS).
 *
 * ── DEV-SERVER SCOPE ───────────────────────────────────────────────────────────
 * This .mjs launches chromium DIRECTLY (not the Playwright test runner), so it OWNS
 * the dev-server lifecycle, mirroring `playwright.config.ts`'s `reuseExistingServer`
 * semantics:
 *   - If a dev server is ALREADY reachable at http://127.0.0.1:3000 it is REUSED.
 *   - Otherwise this script BOOTS `npm run dev`, AWAITS readiness, captures, tears down.
 *     It NEVER navigates against a dead server — if boot fails it exits non-zero with a
 *     clear "start `npm run dev` first" message.
 *
 * ── PRECONDITION ───────────────────────────────────────────────────────────────
 * BOTH portfolios must be seeded + published first (else the live page 404s and the
 * capture fail-closes):
 *   npm run seed:founder   # → /jadrianports
 *   npm run seed:aurora    # → /aurora-demo
 * Then (with a dev server up, or letting this script boot one):
 *   npm run capture:landing-proof
 *
 * ── FAIL-CLOSED ────────────────────────────────────────────────────────────────
 * After the in-page encode, `assertValidWebp` checks the bytes are a real WebP
 * (RIFF/WEBP magic) AND that the canvas was drawn at the exact 1280×800 box — a
 * blank/empty/wrong-size render throws and does NOT overwrite the good committed asset;
 * an all-or-nothing write only commits once BOTH pages captured + validated. The
 * fail-closed path is PROVEN REAL by an inline self-check (`--self-check`) that feeds
 * `assertValidWebp` wrong-size + non-WebP + empty buffers and asserts it throws.
 *
 * ── REFRESH (D-12) ─────────────────────────────────────────────────────────────
 * These are MANUAL refresh-on-change committed assets, NOT a CI gate. Re-run after any
 * showcase-portfolio content tweak:
 *   npm run capture:landing-proof
 * Prove the fail-closed assertion only (no render, no dev server):
 *   node scripts/capture-landing-proof.mjs --self-check
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { chromium } from '@playwright/test';

const W = 1280; // 16:10 source — the proof card reserves the box at aspect-[16/10].
const H = 800;
const BASE_URL = 'http://127.0.0.1:3000';
const WEBP_QUALITY = 0.82;

// The two LIVE proof targets (Pitfall 3: live `/[username]`, NOT `/__fixture/<slug>`).
// `username` MUST match what `src/components/landing/proof.tsx` wires (`jadrianports` +
// `aurora-demo`); `out` MUST match the `<img src>` the showcase card renders.
const TARGETS = [
  { name: 'dev', username: 'jadrianports', out: 'public/landing/showcase-dev.webp' },
  { name: 'aurora', username: 'aurora-demo', out: 'public/landing/showcase-aurora.webp' },
];

/**
 * Fail-closed validity check — a pure helper over an encoded buffer + the dimensions
 * the in-page canvas reported. THROWS (naming the target) if the buffer is not a valid
 * WebP or was not drawn at the exact 1280×800 box. Pure so the inline self-check can
 * exercise its REJECT path with a deliberately-broken buffer.
 *
 * A valid WebP starts with the RIFF container magic: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP".
 */
function assertValidWebp(buf, label, drawnWidth, drawnHeight) {
  if (!buf || buf.length < 16) {
    throw new Error(`[landing-proof] "${label}": encoded buffer is empty/too small (${buf?.length ?? 0} bytes) — broken render, refusing to write.`);
  }
  const riff = buf.toString('ascii', 0, 4);
  const webp = buf.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || webp !== 'WEBP') {
    throw new Error(`[landing-proof] "${label}": not a valid WebP (magic "${riff}"/"${webp}", expected "RIFF"/"WEBP") — refusing to write a bad asset.`);
  }
  if (drawnWidth !== W || drawnHeight !== H) {
    throw new Error(`[landing-proof] "${label}": canvas drawn at ${drawnWidth}x${drawnHeight}, expected ${W}x${H} (16:10) — wrong-size/blank render, refusing to write.`);
  }
}

/**
 * INLINE FAIL-CLOSED SELF-CHECK — exercise `assertValidWebp`'s REJECT path against
 * deliberately-broken inputs and assert it throws. Runs at startup (and is the whole
 * job under `--self-check`). If any branch DOESN'T throw, the assertion is not
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
      console.error(`[landing-proof] FAIL-CLOSED SELF-CHECK BROKEN: assertValidWebp did NOT throw on "${name}".`);
      process.exit(1);
    }
  }
  console.log('[landing-proof] fail-closed self-check PASS — assertValidWebp rejects wrong-size / non-WebP / empty.');
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
 * Capture one LIVE portfolio page: navigate `${BASE_URL}/${username}`, wait on a real
 * portfolio landmark (the first rendered `<section>` — NOT `.tmpl-<slug>`, since this is
 * the live page, not the fixture). The first `<section>` is the template-agnostic content
 * landmark present on every published portfolio: edgerunner-v2 wraps its sections in
 * `<main>`, but the aurora template renders `<section>`s directly into a `.tmpl-aurora`
 * `<div>` with no `<main>` — so `<section>` (not `<main>`) is the reliable cross-template
 * wait. Then draw the 1280×800 viewport onto an in-page canvas and `toBlob('image/webp')`.
 * Returns `{ buf, drawnWidth, drawnHeight }`.
 */
async function captureLive(page, { name, username }) {
  await page.setViewportSize({ width: W, height: H });
  const res = await page.goto(`${BASE_URL}/${username}`, { waitUntil: 'networkidle' });
  if (!res || !res.ok()) {
    throw new Error(`[landing-proof] "${name}" (/${username}): live page returned ${res ? res.status() : 'no response'} — is the portfolio seeded + published (npm run seed:${name === 'dev' ? 'founder' : 'aurora'})? Refusing to write.`);
  }
  // Wait on the rendered portfolio landmark — the first `<section>` (proves the live page
  // rendered; template-agnostic across edgerunner-v2/aurora; NOT the fixture-only
  // `.tmpl-<slug>` wait of the thumbnail script).
  await page.locator('section').first().waitFor({ state: 'visible', timeout: 60_000 });
  // Font-readiness — Playwright does NOT auto-wait for next/font (display:'swap').
  await page.evaluate(() => document.fonts.ready);
  // Hide the `next dev` overlay (dev chrome, not page content).
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
  // Prove the fail-closed assertion is real BEFORE doing any rendering.
  proveFailClosed();
  if (process.argv.includes('--self-check')) {
    console.log('[landing-proof] --self-check only — skipping render. (Fail-closed assertion proven above.)');
    return;
  }

  // Reuse an already-running dev server, else boot one (reuseExistingServer semantics).
  let devProc = null;
  const alreadyUp = await waitForServer(BASE_URL, 1_500);
  if (alreadyUp) {
    console.log(`[landing-proof] reusing the dev server already up at ${BASE_URL}.`);
  } else {
    console.log(`[landing-proof] no dev server at ${BASE_URL} — booting \`npm run dev\` ...`);
    devProc = spawn('npm run dev', { stdio: 'ignore', env: process.env, shell: true });
    const booted = await waitForServer(BASE_URL, 180_000); // cold Next 16 Windows compile headroom
    if (!booted) {
      if (devProc) devProc.kill();
      console.error(`[landing-proof] dev server never came up at ${BASE_URL}. Start \`npm run dev\` first, then re-run.`);
      process.exit(1);
    }
    console.log(`[landing-proof] dev server is up at ${BASE_URL}.`);
  }

  const browser = await chromium.launch();
  const captured = [];
  try {
    const page = await browser.newPage();
    for (const target of TARGETS) {
      console.log(`[landing-proof] capturing "${target.name}" via LIVE /${target.username} ...`);
      const { buf, drawnWidth, drawnHeight } = await captureLive(page, target);
      // Fail-closed: validate BEFORE writing — a broken/empty/wrong-size render throws here.
      assertValidWebp(buf, `${target.name} (/${target.username})`, drawnWidth, drawnHeight);
      captured.push({ out: target.out, buf });
    }
  } finally {
    await browser.close();
    if (devProc) devProc.kill();
  }

  // Only write once BOTH pages captured + validated (all-or-nothing — never half-overwrite).
  for (const { out, buf } of captured) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, buf);
    console.log(`wrote ${out} — ${W}x${H} (16:10), ${buf.length} bytes (real live-page render)`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
