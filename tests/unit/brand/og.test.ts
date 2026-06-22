/**
 * Wave 0 — BRAND-04 platform OG card output (Plan 32-02 Task 2).
 *
 * Mirrors tests/unit/og/og-default.test.ts: invokes the `(chrome)/opengraph-image.tsx`
 * default `Image()` (a plain async function — no server needed), reads the rendered PNG
 * bytes off the ImageResponse, and asserts it is a real 1200×630 PNG plus the segment
 * exports (contentType + verbatim alt).
 */
import { describe, expect, it } from 'vitest';

import Image, {
  alt,
  size,
  contentType,
} from '@/app/(chrome)/opengraph-image';

/** Decode width/height from a PNG's IHDR (big-endian u32 at byte offsets 16 + 20). */
function pngDimensions(buf: Buffer): { width: number; height: number } {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('BRAND-04 — (chrome)/opengraph-image.tsx (1200×630 platform card)', () => {
  it('declares the summary_large_image size + image/png content-type + verbatim alt', () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe('image/png');
    expect(alt).toBe('Portsmith — a polished portfolio in about 15 minutes');
  });

  it('renders a real, non-trivial 1200×630 PNG', async () => {
    const res = await Image();
    const buf = Buffer.from(await res.arrayBuffer());
    // PNG magic bytes 89 50 4E 47 — proves a genuine PNG.
    expect(Array.from(buf.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(pngDimensions(buf)).toEqual({ width: 1200, height: 630 });
    // A real rendered card (Satori text + fonts) is tens of KB, not a placeholder.
    expect(buf.byteLength).toBeGreaterThan(5000);
  });
});
