/**
 * Gallery downscale primitive (34-02, MEDIA-02/03 / D-03/D-05) — the pure
 * longest-edge math + the EXIF-correct decode + the no-crop downscale-to-WebP step
 * the `GalleryUploader` draws on.
 *
 * Two layers, deliberately separable:
 *   1. `longestEdgeDims` — PURE aspect-preserving longest-edge fit math. No DOM, no
 *      canvas, no `createImageBitmap`; imports cleanly into the vitest `node` unit
 *      project (same discipline as `upload-config.ts`'s `exceedsPixelCap`). This is
 *      the unit-tested spec (RESEARCH Flag 3, lines 300-312) — NEVER upscales
 *      (`scale = min(1, maxEdge/longest)`), rounds each axis, clamps >= 1.
 *   2. `decodeOriented` + `downscaleToWebp` — the DOM/canvas wrappers. These touch
 *      `createImageBitmap` / `<canvas>` so they only run in a real browser (the
 *      Playwright orientation e2e); the jsdom component test MOCKS them.
 *
 * ── EXIF ORIENTATION STRATEGY (RESEARCH Flag 1, recommendation 1) ─────────────
 * A naive `<img>`-to-canvas draw (or `createImageBitmap(file)` without the
 * `imageOrientation` option) gives the canvas the RAW, unrotated pixels — CSS
 * `image-orientation` is display-only and is NOT applied to a canvas, so a portrait
 * phone photo (EXIF Orientation 6/8) would store sideways (Pitfall 1). The
 * `{ imageOrientation: 'from-image' }` option fixes this on Chrome112/FF111/
 * Safari16/iOS16+ but SILENTLY no-ops on iOS<16 — and an unknown option does not
 * throw, so a try/catch cannot feature-detect it (Pitfall 2).
 *
 * Therefore the orientation flag is read by a dependency-free, ~40-line JPEG-APP1
 * byte-reader (`readJpegOrientation`) as the deterministic SOURCE OF TRUTH, and the
 * matching rotate/translate is applied to the canvas during the downscale draw — so
 * the result is engine-independent (correct on iOS 14/15/16+ alike). We decode the
 * RAW pixels via `createImageBitmap(file)` (NO `from-image` option, so the bitmap is
 * never double-rotated) and bake the orientation ourselves. This scopes the
 * hand-rolled code to the single orientation byte only (RESEARCH "Don't Hand-Roll").
 *
 * Canvas tainting (Pitfall 7): `createImageBitmap(file)` from a local `File`/`Blob`
 * is same-origin and does NOT taint the canvas, so `toBlob` is safe.
 */

/**
 * PURE longest-edge fit (RESEARCH Flag 3 — the verbatim spec). Returns the target
 * canvas dims for an `srcW × srcH` source clamped so its LONGEST edge is at most
 * `maxEdge`. NEVER upscales (a source already under the cap keeps its native size);
 * rounds each axis to whole pixels and clamps to >= 1 so a degenerate input never
 * yields 0. No DOM — node-unit-testable.
 */
export function longestEdgeDims(
  srcW: number,
  srcH: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(srcW, srcH);
  // NEVER upscale: a source already under the cap keeps its native size (scale=1).
  const scale = longest <= maxEdge ? 1 : maxEdge / longest;
  // Round to whole pixels; clamp to >=1 so a degenerate input never yields 0.
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  return { width, height };
}

/** A decoded, raw-pixel source plus the EXIF orientation flag (1-8) to bake on draw. */
export interface OrientedSource {
  /** The decoded raw-pixel source (no orientation applied yet — we bake it on draw). */
  source: CanvasImageSource;
  /** The DISPLAY width (already accounts for the orientation swap). */
  width: number;
  /** The DISPLAY height (already accounts for the orientation swap). */
  height: number;
  /** The EXIF orientation flag (1-8); 1 when absent / not a JPEG. */
  orientation: number;
}

/** EXIF orientation values that swap the width/height axes (90°/270° rotations). */
function orientationSwapsAxes(orientation: number): boolean {
  return orientation >= 5 && orientation <= 8;
}

/**
 * Read the single EXIF Orientation flag (1-8) from a JPEG's APP1/Exif segment.
 * Returns 1 (the identity orientation) for a non-JPEG, a JPEG with no Exif, or any
 * malformed/short buffer — so a missing flag is always a safe no-rotation default.
 *
 * Scoped to the ONE orientation tag (0x0112); it is NOT a general EXIF parser
 * (RESEARCH "Don't Hand-Roll"). Walks the JPEG marker segments to find APP1
 * ("Exif\0\0"), reads the TIFF header for endianness + the 0th IFD offset, then
 * scans that IFD's entries for tag 0x0112.
 */
export async function readJpegOrientation(file: File): Promise<number> {
  try {
    const buf = await file.arrayBuffer();
    const view = new DataView(buf);
    // SOI marker: a JPEG starts with 0xFFD8.
    if (view.byteLength < 2 || view.getUint16(0) !== 0xffd8) return 1;

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      // All segment markers start with 0xFF; bail if we lost sync.
      if ((marker & 0xff00) !== 0xff00) return 1;
      const size = view.getUint16(offset + 2);
      if (size < 2) return 1;

      // APP1 (0xFFE1) carries the Exif payload.
      if (marker === 0xffe1) {
        const app1Start = offset + 4;
        // "Exif\0\0" header (6 bytes) precedes the TIFF block.
        if (
          app1Start + 6 <= view.byteLength &&
          view.getUint32(app1Start) === 0x45786966 && // "Exif"
          view.getUint16(app1Start + 4) === 0x0000
        ) {
          return readOrientationFromTiff(view, app1Start + 6);
        }
        return 1;
      }

      // SOS (0xFFDA) marks the start of scan data — no more metadata segments.
      if (marker === 0xffda) return 1;
      offset += 2 + size;
    }
    return 1;
  } catch {
    // A read failure must never break the upload — default to no rotation.
    return 1;
  }
}

/** Parse the TIFF/Exif block at `tiffStart` and return the Orientation tag (0x0112). */
function readOrientationFromTiff(view: DataView, tiffStart: number): number {
  if (tiffStart + 8 > view.byteLength) return 1;
  // Byte-order mark: 0x4949 = little-endian ("II"), 0x4D4D = big-endian ("MM").
  const endian = view.getUint16(tiffStart);
  const little = endian === 0x4949;
  if (!little && endian !== 0x4d4d) return 1;

  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);

  // The 0th IFD offset is at tiffStart+4 (relative to tiffStart).
  const ifd0 = tiffStart + u32(tiffStart + 4);
  if (ifd0 + 2 > view.byteLength) return 1;

  const entries = u16(ifd0);
  for (let i = 0; i < entries; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > view.byteLength) return 1;
    if (u16(entry) === 0x0112) {
      // Orientation: a SHORT value stored in the first 2 bytes of the value field.
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

/**
 * Decode `file` to a raw-pixel `CanvasImageSource` and read its EXIF orientation
 * flag. Returns the DISPLAY dims (already accounting for a 90°/270° axis swap) and
 * the orientation flag so `downscaleToWebp` can bake the rotation during the draw.
 *
 * Uses `createImageBitmap(file)` WITHOUT the `imageOrientation` option (so the bitmap
 * carries the raw, un-rotated pixels and is never double-rotated) and our own
 * `readJpegOrientation` as the deterministic orientation source of truth.
 */
export async function decodeOriented(file: File): Promise<OrientedSource> {
  const orientation = await readJpegOrientation(file);
  const bitmap = await createImageBitmap(file);
  const swap = orientationSwapsAxes(orientation);
  // DISPLAY dims: swap axes for the 90°/270° orientations so longestEdgeDims +
  // exceedsPixelCap + the emitted {width,height} all reason about the visible image.
  const width = swap ? bitmap.height : bitmap.width;
  const height = swap ? bitmap.width : bitmap.height;
  return { source: bitmap, width, height, orientation };
}

/**
 * Apply the EXIF orientation transform to a 2D context whose canvas is already sized
 * to the DISPLAY (post-rotation) `width × height`. After this call, drawing the raw
 * bitmap at `(0,0,rawW,rawH)` lands it correctly oriented. `rawW`/`rawH` are the
 * RAW (pre-rotation) dims to draw into. Covers all 8 EXIF orientations.
 */
function applyOrientationTransform(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  rawW: number,
  rawH: number,
): void {
  switch (orientation) {
    case 2: // mirror horizontal
      ctx.transform(-1, 0, 0, 1, rawW, 0);
      break;
    case 3: // 180°
      ctx.transform(-1, 0, 0, -1, rawW, rawH);
      break;
    case 4: // mirror vertical
      ctx.transform(1, 0, 0, -1, 0, rawH);
      break;
    case 5: // mirror horizontal + 90° CW
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6: // 90° CW
      ctx.transform(0, 1, -1, 0, rawH, 0);
      break;
    case 7: // mirror horizontal + 90° CCW
      ctx.transform(0, -1, -1, 0, rawH, rawW);
      break;
    case 8: // 90° CCW
      ctx.transform(0, -1, 1, 0, 0, rawW);
      break;
    default: // 1 (or unknown) — identity
      break;
  }
}

/**
 * Downscale an `OrientedSource` to a WebP whose LONGEST edge is at most `maxEdge`,
 * baking the EXIF orientation into the pixels. Returns the encoded blob plus the
 * CANVAS dims (D-05 — the truthful STORED pixel dims, NOT the source's natural dims;
 * Phase 36 reserves a CLS-safe box from these). Never upscales (via longestEdgeDims).
 */
export async function downscaleToWebp(
  oriented: OrientedSource,
  maxEdge: number,
  quality = 0.8,
): Promise<{ blob: Blob; width: number; height: number }> {
  // longestEdgeDims reasons about the DISPLAY dims (oriented.width/height).
  const { width, height } = longestEdgeDims(oriented.width, oriented.height, maxEdge);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('encode_failed');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high'; // mirrors the existing getCroppedCanvas opt

  // The destination RAW dims (pre-rotation) the scaled draw fills. For a 90°/270°
  // orientation the canvas axes are swapped relative to the raw bitmap, so the raw
  // draw rect is the canvas dims with axes swapped back.
  const swap = orientationSwapsAxes(oriented.orientation);
  const rawW = swap ? height : width;
  const rawH = swap ? width : height;

  applyOrientationTransform(ctx, oriented.orientation, rawW, rawH);
  // Scaled draw: raw source → the full (pre-rotation) destination rect.
  ctx.drawImage(oriented.source, 0, 0, rawW, rawH);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('encode_failed'))),
      'image/webp',
      quality,
    ),
  );

  // Free the decoded bitmap once encoded (no-op if the source isn't an ImageBitmap).
  if (typeof (oriented.source as ImageBitmap).close === 'function') {
    (oriented.source as ImageBitmap).close();
  }

  // D-05: the emitted dims are the CANVAS dims — the truthful stored WebP pixels.
  return { blob, width: canvas.width, height: canvas.height };
}
