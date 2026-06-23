/**
 * 34-02 (Wave 2, TDD) — MEDIA-02/03/04 / D-05/D-07/D-09: the GalleryUploader's batch
 * loop + orphan reconcile.
 *
 * WHY this tests the EXTRACTED pure functions (the `buildMoodboardContent` /
 * `recordView` render-free precedent): jsdom lacks `createImageBitmap` + a real
 * canvas (RESEARCH A2), and the repo ships no @testing-library/react. So the batch
 * loop is lifted into `uploadGalleryBatch(files, deps)` and the unmount belt's set
 * diff into `reconcileOrphans(produced, persisted, free)` — both pure + injectable.
 * This file MOCKS `decodeOriented` / `downscaleToWebp` / the upload `fetch` via the
 * `deps` seam and asserts ONLY the loop/callback/halt/belt behavior in the fast
 * `node` env. Orientation correctness is the real-browser e2e
 * (e2e/gallery-orientation.spec.ts); the pure math is `downscale.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  reconcileOrphans,
  uploadGalleryBatch,
  type GalleryBatchDeps,
  type GalleryUploadItem,
} from '@/components/editor/gallery-uploader';
import type { OrientedSource } from '@/lib/media/downscale';

/** A fake decoded source — the loop only reads `width`/`height` (the pixel-cap gate). */
function orientedFixture(width = 4000, height = 3000): OrientedSource {
  return {
    source: {} as unknown as CanvasImageSource,
    width,
    height,
    orientation: 1,
    alreadyOriented: true,
  };
}

/** A 1 MiB-ish fake File (well under GALLERY_ORIGINAL_CEILING_BYTES). */
function fakeFile(name: string, size = 1_000_000): File {
  const f = new File([new Uint8Array(8)], name, { type: 'image/jpeg' });
  // Force a controlled `.size` (the constructed blob is tiny).
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

/** A `Response`-like ok/json stub for the upload seam. */
function okUpload(url: string): Response {
  return {
    ok: true,
    json: async () => ({ url }),
  } as unknown as Response;
}

/** A non-ok `Response` carrying a typed error body (e.g. quota_exceeded → 409). */
function failUpload(error: string): Response {
  return {
    ok: false,
    json: async () => ({ error }),
  } as unknown as Response;
}

/** Build the injected deps with sensible defaults, overridable per test. */
function makeDeps(over: Partial<GalleryBatchDeps> = {}): {
  deps: GalleryBatchDeps;
  emitted: GalleryUploadItem[];
} {
  const emitted: GalleryUploadItem[] = [];
  const deps: GalleryBatchDeps = {
    decodeOriented: vi.fn(async () => orientedFixture()),
    // Default: emit the truthful CANVAS dims (2000×1500 for a 4000×3000 source).
    downscaleToWebp: vi.fn(async () => ({
      blob: new Blob(['x'], { type: 'image/webp' }),
      width: 2000,
      height: 1500,
    })),
    uploadBlob: vi.fn(async () => okUpload('https://store.test/u/gallery/a.webp')),
    onUploaded: (item) => emitted.push(item),
    onUploadedSettled: vi.fn(),
    ...over,
  };
  return { deps, emitted };
}

describe('uploadGalleryBatch — callback dims (D-05 / MEDIA-03)', () => {
  it('emits {url, width, height} with the downscale-CANVAS dims, not the source dims', async () => {
    let i = 0;
    const { deps, emitted } = makeDeps({
      uploadBlob: vi.fn(async () => okUpload(`https://store.test/u/gallery/${i++}.webp`)),
    });

    const result = await uploadGalleryBatch([fakeFile('a.jpg')], deps);

    expect(result.halted).toBe(false);
    expect(result.failures).toHaveLength(0);
    expect(emitted).toEqual([
      { url: 'https://store.test/u/gallery/0.webp', width: 2000, height: 1500 },
    ]);
    expect(deps.onUploadedSettled).toHaveBeenCalledTimes(1);
  });
});

describe('uploadGalleryBatch — continue-on-error summary (D-07 / MEDIA-02)', () => {
  it('a 3-file batch with 1 bad (decode failure) emits 2 items + reports the 1 failure', async () => {
    let n = 0;
    const { deps, emitted } = makeDeps({
      // The middle file fails to decode; the other two succeed.
      decodeOriented: vi.fn(async () => {
        n += 1;
        if (n === 2) throw new Error('not decodable');
        return orientedFixture();
      }),
      uploadBlob: vi.fn(async () => okUpload(`https://store.test/u/gallery/ok.webp`)),
    });

    const result = await uploadGalleryBatch(
      [fakeFile('a.jpg'), fakeFile('bad.jpg'), fakeFile('c.jpg')],
      deps,
    );

    expect(result.halted).toBe(false);
    expect(emitted).toHaveLength(2); // the two good files still uploaded
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toEqual({ name: 'bad.jpg', reason: 'decode_failed' });
  });

  it('rejects a file over the client ceiling BEFORE decoding it', async () => {
    const decode = vi.fn(async () => orientedFixture());
    const { deps, emitted } = makeDeps({ decodeOriented: decode });
    // 41 MiB > GALLERY_ORIGINAL_CEILING_BYTES (40 MiB).
    const huge = fakeFile('huge.jpg', 41 * 1024 * 1024);

    const result = await uploadGalleryBatch([huge], deps);

    expect(decode).not.toHaveBeenCalled(); // never decoded
    expect(emitted).toHaveLength(0);
    expect(result.failures).toEqual([{ name: 'huge.jpg', reason: 'too_large' }]);
  });

  it('rejects a decode-bomb (over the 12000px pixel cap) before downscale (MEDIA-04)', async () => {
    const downscale = vi.fn();
    const { deps } = makeDeps({
      decodeOriented: vi.fn(async () => orientedFixture(20_000, 20_000)),
      downscaleToWebp: downscale as unknown as GalleryBatchDeps['downscaleToWebp'],
    });

    const result = await uploadGalleryBatch([fakeFile('bomb.jpg')], deps);

    expect(downscale).not.toHaveBeenCalled();
    expect(result.failures).toEqual([{ name: 'bomb.jpg', reason: 'too_large' }]);
  });
});

describe('uploadGalleryBatch — mid-batch quota halt (D-07)', () => {
  it('a 409 quota_exceeded BREAKs the loop; earlier items stay emitted, later are not attempted', async () => {
    let call = 0;
    const upload = vi.fn(async () => {
      call += 1;
      // First succeeds; second hits quota; third must never be attempted.
      if (call === 1) return okUpload('https://store.test/u/gallery/1.webp');
      return failUpload('quota_exceeded');
    });
    const downscale = vi.fn(async () => ({
      blob: new Blob(['x'], { type: 'image/webp' }),
      width: 2000,
      height: 1500,
    }));
    const { deps, emitted } = makeDeps({
      uploadBlob: upload,
      downscaleToWebp: downscale,
    });

    const result = await uploadGalleryBatch(
      [fakeFile('1.jpg'), fakeFile('2.jpg'), fakeFile('3.jpg')],
      deps,
    );

    expect(result.halted).toBe(true);
    expect(emitted).toEqual([
      { url: 'https://store.test/u/gallery/1.webp', width: 2000, height: 1500 },
    ]);
    // Two upload attempts (success + quota); the third file is NOT attempted.
    expect(upload).toHaveBeenCalledTimes(2);
    expect(downscale).toHaveBeenCalledTimes(2);
  });

  it('a non-quota upload failure is collected and the loop continues', async () => {
    let call = 0;
    const upload = vi.fn(async () => {
      call += 1;
      if (call === 1) return failUpload('unsupported_type');
      return okUpload('https://store.test/u/gallery/ok.webp');
    });
    const { deps, emitted } = makeDeps({ uploadBlob: upload });

    const result = await uploadGalleryBatch([fakeFile('x.gif'), fakeFile('y.jpg')], deps);

    expect(result.halted).toBe(false);
    expect(emitted).toHaveLength(1); // the second file still uploaded
    expect(result.failures).toEqual([{ name: 'x.gif', reason: 'unsupported_type' }]);
  });
});

describe('reconcileOrphans — orphan-free belt set diff (D-09 / MEDIA-04)', () => {
  it('frees every produced URL the form has NOT persisted', () => {
    const produced = new Set([
      'https://store.test/u/gallery/saved.webp',
      'https://store.test/u/gallery/orphan1.webp',
      'https://store.test/u/gallery/orphan2.webp',
    ]);
    const persisted = new Set(['https://store.test/u/gallery/saved.webp']);
    const freed: string[] = [];

    reconcileOrphans(produced, persisted, (url) => freed.push(url));

    expect(freed.sort()).toEqual([
      'https://store.test/u/gallery/orphan1.webp',
      'https://store.test/u/gallery/orphan2.webp',
    ]);
    // The persisted (saved) object is NEVER freed.
    expect(freed).not.toContain('https://store.test/u/gallery/saved.webp');
  });

  it('frees nothing when every produced URL is persisted', () => {
    const urls = new Set(['https://store.test/u/gallery/a.webp']);
    const freed: string[] = [];
    reconcileOrphans(urls, urls, (url) => freed.push(url));
    expect(freed).toHaveLength(0);
  });
});
