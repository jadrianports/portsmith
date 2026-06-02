/**
 * Unit coverage for the magic-byte sniff primitive (MEDIA-01 authoritative gate).
 *
 * `sniffMime` reads the ACTUAL leading bytes (not the declared MIME), so a real
 * WebP resolves to `image/webp`, a PDF to `application/pdf`, and a JPEG to
 * `image/jpeg` — which is correctly NOT in `ALLOWED_IMAGE_MIME` (only the produced
 * WebP passes). `file-type` works on the leading magic bytes, so minimal signature
 * buffers suffice (we don't need a full valid file).
 *
 * Mirrors the accept/reject idiom of `tests/unit/safe-image.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import {
  ALLOWED_IMAGE_MIME,
  ALLOWED_PDF_MIME,
  sniffMime,
} from '@/lib/media/magic-bytes';

/** Minimal WebP magic: "RIFF" (0-3) + 4 size bytes + "WEBP" (8-11). */
function webpBytes(): Uint8Array {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // R I F F
    0x1a, 0x00, 0x00, 0x00, // little-endian size (any)
    0x57, 0x45, 0x42, 0x50, // W E B P
    0x56, 0x50, 0x38, 0x20, // VP8\x20 chunk header (lossy)
    0x00, 0x00, 0x00, 0x00,
  ]);
}

/** Minimal PDF magic: "%PDF-". */
function pdfBytes(): Uint8Array {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
}

/** JPEG SOI marker: FF D8 FF. */
function jpegBytes(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
}

describe('magic-bytes — allowlists', () => {
  it('ALLOWED_IMAGE_MIME contains ONLY image/webp', () => {
    expect([...ALLOWED_IMAGE_MIME]).toEqual(['image/webp']);
    expect(ALLOWED_IMAGE_MIME.has('image/jpeg')).toBe(false);
    expect(ALLOWED_IMAGE_MIME.has('image/png')).toBe(false);
    expect(ALLOWED_IMAGE_MIME.has('image/gif')).toBe(false);
    expect(ALLOWED_IMAGE_MIME.has('image/svg+xml')).toBe(false);
  });

  it('ALLOWED_PDF_MIME contains ONLY application/pdf', () => {
    expect([...ALLOWED_PDF_MIME]).toEqual(['application/pdf']);
  });
});

describe('sniffMime — detects the actual content type', () => {
  it('sniffs real WebP bytes as image/webp', async () => {
    expect(await sniffMime(webpBytes())).toBe('image/webp');
  });

  it('sniffs PDF bytes (%PDF-) as application/pdf', async () => {
    expect(await sniffMime(pdfBytes())).toBe('application/pdf');
  });

  it('a JPEG buffer sniffs to a mime NOT in ALLOWED_IMAGE_MIME (rejected)', async () => {
    const mime = await sniffMime(jpegBytes());
    expect(mime).toBe('image/jpeg');
    expect(ALLOWED_IMAGE_MIME.has(mime!)).toBe(false);
  });

  it('returns null for unidentifiable bytes', async () => {
    expect(await sniffMime(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });
});
