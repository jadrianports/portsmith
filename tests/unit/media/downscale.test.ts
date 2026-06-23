/**
 * 34-02 (Wave 2, TDD) — MEDIA-02/03 / D-03/D-05: the PURE longest-edge downscale
 * math (`longestEdgeDims`).
 *
 * WHY pure-math only (the `exceedsPixelCap` / storage-meter precedent): the vitest
 * `unit` project is the `node` environment (NOT jsdom; the repo ships no real canvas
 * or `createImageBitmap`). So only the DOM-free `longestEdgeDims` math is asserted
 * here — the canvas draw + EXIF orientation live in `downscaleToWebp`/`decodeOriented`
 * and are exercised by the real-browser Playwright orientation e2e
 * (e2e/gallery-orientation.spec.ts).
 *
 * THE SPEC (RESEARCH Flag 3, the 5 pinned cases at lines 316-320): never upscales
 * (scale clamped <= 1), rounds each axis, clamps to >= 1.
 *
 * Mirrors the sibling pure-math idiom of `tests/unit/media/dimension-guard.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import { longestEdgeDims } from '@/lib/media/downscale';

describe('longestEdgeDims (no-crop longest-edge fit, D-03/D-05)', () => {
  it('caps a landscape source on its longest (width) edge', () => {
    expect(longestEdgeDims(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
  });

  it('caps a portrait source on its longest (height) edge', () => {
    expect(longestEdgeDims(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });

  it('NEVER upscales a source already under the cap (scale clamped <= 1)', () => {
    expect(longestEdgeDims(1600, 900, 2000)).toEqual({ width: 1600, height: 900 });
  });

  it('leaves a source exactly at the cap unchanged', () => {
    expect(longestEdgeDims(2000, 2000, 2000)).toEqual({ width: 2000, height: 2000 });
  });

  it('caps a large square to the maxEdge on both axes', () => {
    expect(longestEdgeDims(5000, 5000, 2000)).toEqual({ width: 2000, height: 2000 });
  });

  it('clamps each axis to >= 1 so a degenerate input never yields 0', () => {
    expect(longestEdgeDims(0, 0, 2000)).toEqual({ width: 1, height: 1 });
    // An extreme aspect (1px tall) keeps the short axis at the >=1 floor, not 0.
    const dims = longestEdgeDims(4000, 1, 2000);
    expect(dims.width).toBe(2000);
    expect(dims.height).toBe(1);
  });
});
