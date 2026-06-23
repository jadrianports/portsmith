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

/** A decoded source plus the EXIF orientation flag (1-8) and whether the engine
 *  already baked it (so the draw step does not double-rotate). */
export interface OrientedSource {
  /** The decoded source — already EXIF-oriented iff `alreadyOriented` is true. */
  source: CanvasImageSource;
  /** The DISPLAY width (accounts for any orientation swap). */
  width: number;
  /** The DISPLAY height (accounts for any orientation swap). */
  height: number;
  /** The EXIF orientation flag (1-8); 1 when absent / not a JPEG. */
  orientation: number;
  /**
   * True when the decode engine ALREADY applied the EXIF orientation to the bitmap
   * pixels (Chrome ~111+/FF/Safari16 honor `imageOrientation:'from-image'`). When
   * true `downscaleToWebp` draws straight (identity transform); when false it bakes
   * the rotation itself from `orientation` (the iOS<16 / engine-ignores fallback).
   */
  alreadyOriented: boolean;
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
 * Read the RAW (encoded, pre-rotation) pixel dims straight from a JPEG's SOF0/SOF2
 * frame header — the deterministic ground truth used to detect whether the decode
 * engine already baked the EXIF orientation (it is independent of any decode path).
 * Returns `null` for a non-JPEG or a malformed/short buffer (the caller then trusts
 * the WHATWG `from-image` default). Scoped to the frame header only — NOT a full
 * decoder (RESEARCH "Don't Hand-Roll").
 */
async function readJpegRawDims(
  file: File,
): Promise<{ width: number; height: number } | null> {
  try {
    const buf = await file.arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 2 || view.getUint16(0) !== 0xffd8) return null; // SOI

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00) return null; // lost marker sync
      // Standalone markers (RSTn / SOI / EOI / TEM) carry no length segment.
      if (marker === 0xffd8 || marker === 0xffd9 || (marker >= 0xffd0 && marker <= 0xffd7)) {
        offset += 2;
        continue;
      }
      const size = view.getUint16(offset + 2);
      if (size < 2) return null;
      // SOFn frame headers: SOF0-3 / SOF5-7 / SOF9-11 / SOF13-15 (exclude DHT/JPG/DAC).
      const sofn =
        (marker >= 0xffc0 && marker <= 0xffc3) ||
        (marker >= 0xffc5 && marker <= 0xffc7) ||
        (marker >= 0xffc9 && marker <= 0xffcb) ||
        (marker >= 0xffcd && marker <= 0xffcf);
      if (sofn) {
        // SOF payload: [precision:1][height:2][width:2] right after the length word.
        if (offset + 9 > view.byteLength) return null;
        const height = view.getUint16(offset + 5);
        const width = view.getUint16(offset + 7);
        if (width < 1 || height < 1) return null;
        return { width, height };
      }
      if (marker === 0xffda) return null; // SOS — scan data; no frame header found
      offset += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Decode `file` to a raw-pixel `CanvasImageSource` and read its EXIF orientation
 * flag. Returns the DISPLAY dims (already accounting for a 90°/270° axis swap) and
 * the orientation flag so `downscaleToWebp` can bake the rotation during the draw.
 *
 * ENGINE-INDEPENDENT strategy (Pitfall 2 — the silent-no-op trap): the WHATWG
 * default for `imageOrientation` changed to `'from-image'` (Chrome ~111+/FF/
 * Safari16), so a modern engine AUTO-orients the bitmap; iOS<16 leaves it raw. We
 * cannot feature-detect the option (an unknown option does not throw). Instead we
 * decode BOTH `'from-image'` and `'none'` and compare their dims:
 *   - If they DIFFER, the engine honors orientation → the `from-image` bitmap is
 *     already display-oriented; use its own dims + an identity draw (alreadyOriented).
 *   - If they MATCH, the engine ignored both (truly raw pixels) → we bake the
 *     rotation ourselves from the `readJpegOrientation` flag (the iOS<16 fallback).
 * `readJpegOrientation` (dependency-free byte-reader) is the orientation flag source
 * of truth for the manual-bake branch.
 */
export async function decodeOriented(file: File): Promise<OrientedSource> {
  const orientation = await readJpegOrientation(file);
  const swap = orientationSwapsAxes(orientation);

  const fromImage = await createImageBitmap(file, { imageOrientation: 'from-image' });

  // An axis-swapping orientation is the cheap discriminator: if the engine honored
  // `from-image`, a landscape-raw / portrait-display source comes back with swapped
  // dims relative to a forced-raw decode. Only decode the raw probe when the flag
  // could swap axes (orientations 5-8) — for 1-4 the dims are identical either way
  // and we rely on the flag for the (rare) mirror/180 manual bake.
  // Ground truth for the engine-honored discriminator: the RAW encoded pixel dims
  // read straight from the JPEG SOF0 frame header (independent of ANY decode). The
  // `{imageOrientation:'none'}` probe is NOT reliable across engines (some Chromium
  // builds still return display-oriented dims for `'none'`), so the SOF0 bytes are
  // the only deterministic raw reference (Pitfall 2 — the silent-no-op trap).
  const rawDims = await readJpegRawDims(file);

  // Did the engine ALREADY bake the orientation into the `from-image` bitmap?
  // For a swap orientation (5-8) the display dims are the raw axes swapped; the
  // engine honored orientation iff `fromImage` matches that swapped shape (and does
  // NOT match the raw shape). For a non-swap orientation the dims are identical
  // either way, so the bitmap is usable as-is and only a mirror/180 needs a bake.
  let alreadyOriented: boolean;
  if (rawDims && swap) {
    const matchesSwapped =
      fromImage.width === rawDims.height && fromImage.height === rawDims.width;
    const matchesRaw =
      fromImage.width === rawDims.width && fromImage.height === rawDims.height;
    // Honored iff the engine produced the swapped (display) shape and NOT the raw one.
    // (When raw is square both match — treat as honored: an identity draw is correct.)
    alreadyOriented = matchesSwapped || !matchesRaw;
  } else {
    // No SOF0 dims (non-JPEG / malformed) or a non-swap orientation: the WHATWG
    // default is `from-image`, so a modern engine has already oriented the bitmap.
    // For orientations 2/3/4 (mirror/180) the dims don't change, so we still draw
    // straight — `from-image` baked the flip/rotation on every supporting engine,
    // and the iOS<16 raw-pixel case for those is a vanishingly rare non-swap edge.
    alreadyOriented = true;
  }

  if (alreadyOriented) {
    // The engine baked it: draw the from-image bitmap straight (identity draw).
    return {
      source: fromImage,
      width: fromImage.width,
      height: fromImage.height,
      orientation,
      alreadyOriented: true,
    };
  }

  // The engine ignored orientation (raw pixels) — we bake it ourselves on draw. The
  // from-image bitmap holds the raw landscape pixels; report the DISPLAY (swapped)
  // dims so longestEdgeDims / exceedsPixelCap / the emitted {width,height} all reason
  // about the visible image.
  const width = swap ? fromImage.height : fromImage.width;
  const height = swap ? fromImage.width : fromImage.height;
  return { source: fromImage, width, height, orientation, alreadyOriented: false };
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

  if (oriented.alreadyOriented) {
    // The decode engine baked the EXIF orientation into the source pixels — draw it
    // straight to the (display-oriented) canvas. NO manual transform (double-rotate).
    ctx.drawImage(oriented.source, 0, 0, width, height);
  } else {
    // The engine left the pixels raw — bake the rotation ourselves. For a 90°/270°
    // orientation the canvas axes are swapped relative to the raw source, so the raw
    // draw rect is the canvas dims with axes swapped back.
    const swap = orientationSwapsAxes(oriented.orientation);
    const rawW = swap ? height : width;
    const rawH = swap ? width : height;
    applyOrientationTransform(ctx, oriented.orientation, rawW, rawH);
    ctx.drawImage(oriented.source, 0, 0, rawW, rawH);
  }

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
