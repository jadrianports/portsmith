/**
 * LAUNCH-09 / D-16 — the committed brand OG fallback `public/og-default.png`.
 *
 * `scripts/generate-og-default.mjs` was rewritten onto the in-repo `next/og` (Satori) path so it
 * can render the "Portsmith" wordmark + the verbatim locked landing headline in Inter on the
 * Evergreen/Copper brand palette. This card is the OG fallback for CHROME pages (the landing /
 * blog / services metadata) — it represents the BRAND, never a user (portfolio pages use the
 * dynamic per-portfolio card).
 *
 * This test asserts the committed asset is a real rendered 1200×630 card AND that the generator
 * is deterministic (a no-op re-run produces byte-identical output — no timestamp/random input),
 * which is what keeps `git diff public/og-default.png` empty on regeneration.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const COMMITTED = join(ROOT, 'public', 'og-default.png');
const GENERATOR = join(ROOT, 'scripts', 'generate-og-default.mjs');

/** Decode width/height from a PNG's IHDR (big-endian u32 at byte offsets 16 + 20). */
function pngDimensions(buf: Buffer): { width: number; height: number } {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const tmpDir = mkdtempSync(join(tmpdir(), 'og-default-'));
afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('LAUNCH-09 / D-16 — public/og-default.png is a real branded 1200×630 card', () => {
  it('exists at public/og-default.png', () => {
    expect(existsSync(COMMITTED)).toBe(true);
  });

  // Test 1 — dimensions decode to exactly 1200×630 (the standard summary_large_image size).
  it('decodes to 1200×630 (IHDR)', () => {
    const buf = readFileSync(COMMITTED);
    // PNG magic bytes: 89 50 4E 47 — proves a genuine PNG.
    expect(Array.from(buf.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(pngDimensions(buf)).toEqual({ width: 1200, height: 630 });
  });

  // Test 2 — a real rendered card (Satori text + fonts) is tens of KB, not a tiny placeholder.
  it('is a non-trivial rendered card (> 5000 bytes)', () => {
    const buf = readFileSync(COMMITTED);
    expect(buf.byteLength).toBeGreaterThan(5000);
  });

  // Test 3 — determinism: re-running the generator to a temp file reproduces the committed bytes
  // EXACTLY (no timestamp/random input), which is what keeps `git diff` empty on a no-op re-run.
  it('is deterministic — a fresh generation reproduces the committed bytes byte-for-byte', () => {
    const out = join(tmpDir, 'regen.png');
    execFileSync(process.execPath, [GENERATOR], {
      cwd: ROOT,
      env: { ...process.env, OG_DEFAULT_OUT: out },
      stdio: 'pipe',
    });
    const fresh = readFileSync(out);
    const committed = readFileSync(COMMITTED);
    expect(fresh.byteLength).toBe(committed.byteLength);
    expect(Buffer.compare(fresh, committed)).toBe(0);
  });
});
