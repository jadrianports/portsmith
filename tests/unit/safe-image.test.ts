/**
 * Unit coverage for the render-time image-src guard `isHttpImageSrc` (WR-05 + D-08).
 *
 * The `minimal` template renders avatars / project images with `next/image` +
 * `unoptimized`, which bypasses Next's `images.remotePatterns` host allowlist. The
 * guard restricts an `<Image src>` to http(s) so a `data:`/arbitrary-scheme src is
 * never loaded directly by the visitor's browser.
 *
 * D-08 (Phase 5) HOST-LOCK: the guard now additionally requires the Supabase Storage
 * origin (`NEXT_PUBLIC_SUPABASE_URL`) — Storage is the canonical and ONLY allowed
 * image origin. So the prior "accepts any http(s)" cases for foreign CDNs now
 * REJECT; only a Storage-origin URL passes. `NEXT_PUBLIC_SUPABASE_URL` is provided
 * by vitest's dotenv load of `.env.local`.
 */
import { describe, expect, it } from 'vitest';

import { isHttpImageSrc } from '@/lib/safe-image';

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;

describe('isHttpImageSrc (WR-05 + D-08 host-locked image-src guard)', () => {
  it('accepts a Storage-origin http(s) URL (D-08)', () => {
    expect(
      isHttpImageSrc(`${BASE}/storage/v1/object/public/avatars/u/a.webp`),
    ).toBe(true);
  });

  it('rejects foreign http(s) origins (D-08 host-lock — FLIPPED from prior accept)', () => {
    expect(isHttpImageSrc('https://cdn.example.com/a.webp')).toBe(false);
    expect(isHttpImageSrc('http://example.com/a.png')).toBe(false);
    expect(isHttpImageSrc('https://evil.com/x.webp')).toBe(false);
  });

  it('rejects data:/javascript:/blob:/file: schemes', () => {
    expect(isHttpImageSrc('data:image/png;base64,iVBORw0KGgo=')).toBe(false);
    expect(isHttpImageSrc('javascript:alert(1)')).toBe(false);
    expect(isHttpImageSrc('blob:https://x.com/abc')).toBe(false);
    expect(isHttpImageSrc('file:///etc/passwd')).toBe(false);
  });

  it('rejects protocol-relative //host', () => {
    expect(isHttpImageSrc('//evil.com/x.png')).toBe(false);
  });

  it('rejects nullish / empty / unparseable', () => {
    expect(isHttpImageSrc(null)).toBe(false);
    expect(isHttpImageSrc(undefined)).toBe(false);
    expect(isHttpImageSrc('')).toBe(false);
    expect(isHttpImageSrc('   ')).toBe(false);
    expect(isHttpImageSrc('not a url')).toBe(false);
  });
});
