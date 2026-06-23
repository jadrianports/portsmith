/**
 * MEDIA-02 (34-02) — EXIF orientation correctness in the gallery downscale path.
 *
 * The "sideways phone photo" regression guard (RESEARCH Flag 1 / Pitfall 1): a
 * portrait phone photo is encoded LANDSCAPE with an EXIF Orientation tag (6 = rotate
 * 90° CW for display). A naive <img>/raw-bitmap-to-canvas draw stores the RAW
 * (landscape) pixels — sideways. The GalleryUploader's `decodeOriented` +
 * `downscaleToWebp` must BAKE the orientation into the canvas BEFORE encode, so the
 * stored/emitted dims are the DISPLAY orientation (portrait: height > width).
 *
 * This is the ONLY real-browser test in the wave: jsdom lacks `createImageBitmap` +
 * a real canvas (RESEARCH A2), so orientation correctness can only be proven in a
 * real engine. The batch-loop/callback/halt logic is the jsdom-free node component
 * test (tests/unit/media/gallery-uploader.test.tsx); the pure math is
 * tests/unit/media/downscale.test.ts.
 *
 * HARNESS: the dev/test-only `/__gallery-fixture` route mounts the real
 * `GalleryUploader` and surfaces each emitted `{url,width,height}` as JSON in
 * `[data-testid="gallery-emit"]`. A verified owner is signed in (the upload route
 * requires a verified identity), the Orientation-6 JPEG is picked via setInputFiles
 * (mirroring e2e/media-upload.spec.ts), and the emitted dims are asserted portrait.
 *
 * Run: `npx playwright test e2e/gallery-orientation.spec.ts`.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import {
  createConfirmedOwner,
  deleteOwner,
  signInAsOwner,
  type TestOwner,
} from './helpers/cms-auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The Storage public-object prefix for a gallery image (media bucket). */
const GALLERY_STORAGE_PREFIX = '/storage/v1/object/public/media/';

test.describe('MEDIA-02 — an EXIF-Orientation-6 JPEG downscales to NON-rotated (portrait) stored dims', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('galori');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('the emitted {width,height} reflect the DISPLAY orientation (height > width), not the raw landscape pixels', async ({
    page,
  }) => {
    // Cold Next 16 dev compile + real auth + decode/downscale/upload run here.
    test.setTimeout(180_000);

    // 1) Sign in as a verified owner (the upload route requires verified identity).
    await signInAsOwner(page, owner);

    // 2) Open the dev/test-only fixture that mounts the real GalleryUploader.
    await page.goto('/__gallery-fixture');
    await expect(page.getByTestId('gallery-uploader')).toBeAttached({ timeout: 30_000 });

    // 3) Pick the Orientation-6 JPEG (raw 160x96 LANDSCAPE; EXIF 6 → displays portrait).
    const fixture = path.join(__dirname, 'fixtures', 'orientation-6.jpg');
    const uploadResponse = page.waitForResponse(
      (res) => res.url().includes('/api/media/upload') && res.request().method() === 'POST',
      { timeout: 90_000 },
    );
    await page.getByTestId('gallery-uploader').setInputFiles(fixture);

    // 4) The upload lands (200) with a Storage media URL — the network proof.
    const res = await uploadResponse;
    expect(res.status()).toBe(200);
    const payload = (await res.json()) as { url?: string };
    expect(payload.url, 'upload route returned a url').toBeTruthy();
    expect(payload.url).toContain(GALLERY_STORAGE_PREFIX);

    // 5) Read the emitted {url,width,height} the fixture surfaced.
    const emitLocator = page.getByTestId('gallery-emit');
    await expect
      .poll(
        async () => {
          const raw = (await emitLocator.textContent()) ?? '[]';
          try {
            return (JSON.parse(raw) as Array<{ url: string }>).length;
          } catch {
            return 0;
          }
        },
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);

    const emitted = JSON.parse((await emitLocator.textContent()) ?? '[]') as Array<{
      url: string;
      width: number;
      height: number;
    }>;
    expect(emitted).toHaveLength(1);
    const { width, height } = emitted[0];

    // 6) THE ASSERTION: orientation was baked → the stored dims are PORTRAIT.
    // The raw pixels are 160x96 (landscape). With EXIF Orientation 6 baked, the
    // display (and therefore the stored/emitted) dims are 96x160 (portrait), so
    // height > width. A sideways regression would emit width > height.
    expect(height, `emitted dims ${width}x${height} must be portrait (height > width)`).toBeGreaterThan(
      width,
    );
    // Sanity: the small fixture is under the 2000px cap → no upscale, native dims.
    expect(width).toBe(96);
    expect(height).toBe(160);
  });
});
