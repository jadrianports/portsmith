/**
 * Unit coverage for the dimension-bomb pixel-cap predicate (D-06).
 *
 * `exceedsPixelCap(w, h)` is the pure `width * height` math that the client
 * `assertRealImage` guard delegates to after `Image.decode()`. The DOM decode path
 * is exercised in e2e; here we prove the pure cap math: a normal photo passes, an
 * absurd decoded dimension fails.
 *
 * Mirrors the client-helper signature idiom of `tests/unit/safe-image.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import { exceedsPixelCap, MAX_IMAGE_DIMENSION } from '@/lib/media/upload-config';

describe('exceedsPixelCap (dimension-bomb guard, D-06)', () => {
  it('passes a normal photo size', () => {
    expect(exceedsPixelCap(4032, 3024)).toBe(false); // a 12 MP phone photo
    expect(exceedsPixelCap(1920, 1080)).toBe(false);
    expect(exceedsPixelCap(1, 1)).toBe(false);
  });

  it('passes exactly at the cap (MAX × MAX)', () => {
    expect(exceedsPixelCap(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION)).toBe(false);
  });

  it('rejects a pixel count over the cap (image bomb)', () => {
    expect(
      exceedsPixelCap(MAX_IMAGE_DIMENSION + 1, MAX_IMAGE_DIMENSION + 1),
    ).toBe(true);
    expect(exceedsPixelCap(100_000, 100_000)).toBe(true);
  });

  it('exposes a sane positive cap constant', () => {
    expect(MAX_IMAGE_DIMENSION).toBeGreaterThan(0);
  });
});
