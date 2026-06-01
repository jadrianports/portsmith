/**
 * Unit coverage for the render-time image-src guard `isHttpImageSrc` (WR-05).
 *
 * The `minimal` template renders avatars / project images with `next/image` +
 * `unoptimized`, which bypasses Next's `images.remotePatterns` host allowlist. The
 * guard restricts an `<Image src>` to http(s) so a `data:`/arbitrary-scheme src is
 * never loaded directly by the visitor's browser.
 */
import { describe, expect, it } from 'vitest';

import { isHttpImageSrc } from '@/lib/safe-image';

describe('isHttpImageSrc (WR-05 image-src guard)', () => {
  it('accepts http(s) URLs', () => {
    expect(isHttpImageSrc('https://cdn.example.com/a.webp')).toBe(true);
    expect(isHttpImageSrc('http://example.com/a.png')).toBe(true);
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
