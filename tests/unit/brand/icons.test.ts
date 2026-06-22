/**
 * Wave 0 — BRAND-02 icon + manifest output (Plan 32-02 Task 1).
 *
 * Invokes the metadata-file default exports / route GET / manifest function DIRECTLY
 * (they are plain functions — no server needed) and asserts the rendered PNG dimensions +
 * content-type and the manifest field values. PNG bytes are read off the `ImageResponse`
 * via `.arrayBuffer()`; dimensions decode from the IHDR (mirrors og-default.test.ts).
 */
import { describe, expect, it } from 'vitest';

import AppleIcon, {
  size as appleSize,
  contentType as appleContentType,
} from '@/app/(chrome)/apple-icon';
import Icon, {
  size as iconSize,
  contentType as iconContentType,
} from '@/app/(chrome)/icon';
import manifest from '@/app/(chrome)/manifest';
import { GET as appIconGET } from '@/app/(chrome)/app-icon/[size]/route';

/** Decode width/height from a PNG's IHDR (big-endian u32 at byte offsets 16 + 20). */
function pngDimensions(buf: Buffer): { width: number; height: number } {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** PNG magic bytes 89 50 4E 47 — proves a genuine PNG. */
function isPng(buf: Buffer): boolean {
  return (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  );
}

/** Read the bytes of an ImageResponse / Response into a Buffer. */
async function responseBytes(res: Response): Promise<Buffer> {
  return Buffer.from(await res.arrayBuffer());
}

describe('BRAND-02 — icon.tsx (32px app-icon PNG)', () => {
  it('declares size 32×32 + image/png content-type', () => {
    expect(iconSize).toEqual({ width: 32, height: 32 });
    expect(iconContentType).toBe('image/png');
  });

  it('renders a real 32×32 PNG', async () => {
    const buf = await responseBytes(Icon());
    expect(isPng(buf)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 32, height: 32 });
  });
});

describe('BRAND-02 — apple-icon.tsx (180px apple-touch PNG)', () => {
  it('declares size 180×180 + image/png content-type', () => {
    expect(appleSize).toEqual({ width: 180, height: 180 });
    expect(appleContentType).toBe('image/png');
  });

  it('renders a real 180×180 PNG', async () => {
    const buf = await responseBytes(AppleIcon());
    expect(isPng(buf)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 180, height: 180 });
  });
});

describe('BRAND-02 — app-icon/[size] route (installable 192/512 PNGs)', () => {
  const req = new Request('http://localhost/app-icon');

  it('renders a 192×192 PNG for size=192', async () => {
    const res = await appIconGET(req, {
      params: Promise.resolve({ size: '192' }),
    });
    expect(res.status).toBe(200);
    const buf = await responseBytes(res);
    expect(isPng(buf)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 192, height: 192 });
  });

  it('renders a 512×512 PNG for size=512', async () => {
    const res = await appIconGET(req, {
      params: Promise.resolve({ size: '512' }),
    });
    expect(res.status).toBe(200);
    const buf = await responseBytes(res);
    expect(isPng(buf)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 512, height: 512 });
  });

  it('404s on any non-allow-listed size', async () => {
    const res = await appIconGET(req, {
      params: Promise.resolve({ size: '999' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('BRAND-02 — manifest.ts (PWA web app manifest)', () => {
  const m = manifest();

  it('carries the verbatim name/short_name/description/start_url/display', () => {
    expect(m.name).toBe('Portsmith');
    expect(m.short_name).toBe('Portsmith');
    expect(m.description).toBe(
      'Publish a polished, single-scroll portfolio by filling in structured content and choosing a curated template.',
    );
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
  });

  it('uses the evergreen light theme_color', () => {
    expect(m.theme_color).toBe('#1B3A2E');
  });

  it('lists the /icon.svg favicon + the 192/512 installable PNG icons', () => {
    const icons = m.icons ?? [];
    // /icon.svg — sizes:'any'
    expect(icons).toContainEqual(
      expect.objectContaining({
        src: '/icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
      }),
    );
    // /app-icon/192 — 192x192 image/png
    expect(icons).toContainEqual(
      expect.objectContaining({
        src: '/app-icon/192',
        type: 'image/png',
        sizes: '192x192',
      }),
    );
    // /app-icon/512 — 512x512 image/png
    expect(icons).toContainEqual(
      expect.objectContaining({
        src: '/app-icon/512',
        type: 'image/png',
        sizes: '512x512',
      }),
    );
  });
});
