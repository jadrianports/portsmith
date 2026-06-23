/**
 * Upload slot configuration — the single audited place for the per-slot upload
 * specs, the per-user storage quota, and the pure quota / dimension math the
 * upload route, delete helper, and client uploader all share (Phase 5, D-01/D-03/
 * D-05/D-09).
 *
 * Shape mirrors the `ITEM_CONFIG: Record<…>` table in `item-card.tsx:105` — a typed
 * `Record` keyed by a string-union of slots, each value an object of per-slot specs.
 *
 * The image slots carry the FIXED crop `aspect` (D-03 — the "hard-to-make-ugly"
 * lever) and the retina `target` pixel size (D-05 — ONE WebP per slot, no srcSet),
 * sized ~2-3× the template's render boxes (avatar 160×160, project 16/9, testimonial
 * 40×40). The `ceiling` byte caps MIRROR migration 003's `file_size_limit`
 * (avatars/media 5 MiB, resumes 10 MiB — `003:42-46`); they are a per-request
 * defense-in-depth ceiling, distinct from the per-USER `QUOTA_BYTES` cap.
 *
 * This module is PURE (no `file-type`, no Supabase, no `next/headers`) so it imports
 * cleanly into the client uploader, the route handler, and the vitest `node`
 * unit project without a request scope (RESEARCH Pitfall 7).
 */

/** Image-slot byte ceiling — mirrors migration 003 `avatars`/`media` file_size_limit. */
const IMAGE_CEILING_BYTES = 5 * 1024 * 1024; // 5 MiB = 5242880
/** Résumé byte ceiling — mirrors migration 003 `resumes` file_size_limit. */
const RESUME_CEILING_BYTES = 10 * 1024 * 1024; // 10 MiB = 10485760

/**
 * The upload slots. `kind` is the wire param the route branches on. `moodboard`
 * (13.1-03, correctness gap #3) is the gallery image kind the moodboard per-type
 * form uploads through — a pure config addition (bucket `media`, image-gated by the
 * existing `isImageKind`/`ALLOWED_IMAGE_MIME` path), NO migration (the BEFORE-INSERT
 * atomic quota trigger gates ALL `media` writes regardless of render state).
 */
export type UploadKind =
  | 'avatar'
  | 'project'
  | 'testimonial'
  | 'moodboard'
  // 29-02 (META-03 / META-04): the page-identity image slots — a square favicon and
  // a 1.91:1 social-share OG card. Pure config additions riding the `media` bucket's
  // existing webp-only + quota-trigger upload path (no migration, no new bypass).
  | 'favicon'
  | 'og'
  // 34-01 (MEDIA-02 / D-04): the no-crop batch gallery image kind. A `crop:'maxEdge'`
  // union variant on the `media` bucket — the client downscales to 2000px longest-edge,
  // the route + quota trigger gate it through the UNCHANGED webp-only image path.
  | 'gallery'
  | 'resume';

/** A user-writable Storage bucket (migration 003). */
export type UploadBucket = 'avatars' | 'media' | 'resumes';

/** Fields every slot variant shares (D-04 discriminated-union base). */
interface BaseSlotConfig {
  bucket: UploadBucket;
  context: string;
  /** Per-request byte ceiling (defense-in-depth with the bucket cap). */
  ceiling: number;
}

/** The six fixed-aspect image slots (avatar/project/testimonial/moodboard/favicon/og).
 *  Discriminated by `crop:'fixed'`; carries the fixed crop aspect + retina target (D-03/D-05). */
export interface FixedImageSlotConfig extends BaseSlotConfig {
  crop: 'fixed';
  /** Fixed crop aspect ratio (D-03). */
  aspect: number;
  /** Retina target pixel size for the single stored WebP (D-05). */
  target: { width: number; height: number };
}

/** The no-crop gallery image slot (D-04 / MEDIA-02). Discriminated by `crop:'maxEdge'`;
 *  the client downscales the original to `maxEdge` on its longest edge — no fixed aspect. */
export interface GalleryImageSlotConfig extends BaseSlotConfig {
  crop: 'maxEdge';
  /** Longest-edge clamp for the client downscale (D-03). */
  maxEdge: number;
}

/** The résumé (raw file) slot. Discriminated by `crop:'none'`. */
export interface FileSlotConfig extends BaseSlotConfig {
  crop: 'none';
}

/**
 * Back-compat alias: the fixed-aspect image variant kept its historical name so
 * `image-uploader.tsx:174`'s `UPLOAD_KINDS[kind] as ImageSlotConfig` cast (it reads
 * `aspect`/`target`/`ceiling`) compiles untouched after the union reshape.
 */
export type ImageSlotConfig = FixedImageSlotConfig;

export type UploadSlotConfig =
  | FixedImageSlotConfig
  | GalleryImageSlotConfig
  | FileSlotConfig;

/**
 * Per-slot upload specs. Image slots (avatar/project/testimonial) carry the fixed
 * crop aspect + retina target; the résumé slot is a raw PDF (no crop/aspect).
 */
export const UPLOAD_KINDS: Record<UploadKind, UploadSlotConfig> = {
  avatar: {
    crop: 'fixed',
    bucket: 'avatars',
    context: 'avatar',
    aspect: 1,
    target: { width: 512, height: 512 },
    ceiling: IMAGE_CEILING_BYTES,
  },
  project: {
    crop: 'fixed',
    bucket: 'media',
    context: 'project',
    aspect: 16 / 9,
    target: { width: 1600, height: 900 },
    ceiling: IMAGE_CEILING_BYTES,
  },
  testimonial: {
    crop: 'fixed',
    bucket: 'media',
    context: 'testimonial',
    aspect: 1,
    target: { width: 96, height: 96 },
    ceiling: IMAGE_CEILING_BYTES,
  },
  // 13.1-03 (gap #3): the gallery/moodboard image slot. A square crop (1:1 — a
  // gallery grid tile / mood swatch) at a retina target ~2-3× a typical render box;
  // bucket `media` so the BEFORE-INSERT 25 MiB quota trigger (migration 009) gates it
  // unchanged. `ceiling: IMAGE_CEILING_BYTES` is per-request defense-in-depth.
  moodboard: {
    crop: 'fixed',
    bucket: 'media',
    context: 'moodboard',
    aspect: 1,
    target: { width: 1200, height: 1200 },
    ceiling: IMAGE_CEILING_BYTES,
  },
  // 29-02 (D-03 / META-03): the browser-tab favicon slot. A square crop (1:1) at a
  // 256×256 retina target; bucket `media` so the BEFORE-INSERT quota trigger gates it
  // unchanged. `ceiling: IMAGE_CEILING_BYTES` is per-request defense-in-depth.
  favicon: {
    crop: 'fixed',
    bucket: 'media',
    context: 'favicon',
    aspect: 1,
    target: { width: 256, height: 256 },
    ceiling: IMAGE_CEILING_BYTES,
  },
  // 29-02 (D-05 / META-04): the social-share OG card slot. The canonical 1.91:1
  // aspect at the 1200×630 target; same `media` bucket + quota-trigger path.
  og: {
    crop: 'fixed',
    bucket: 'media',
    context: 'og',
    aspect: 1.91,
    target: { width: 1200, height: 630 },
    ceiling: IMAGE_CEILING_BYTES,
  },
  // 34-01 (MEDIA-02 / D-04 / D-08): the no-crop batch gallery image slot. Unlike the
  // fixed-aspect kinds it carries NO aspect/target — the client downscales the original
  // to `maxEdge` (2000px, D-03) on its longest edge, preserving the native aspect. Rides
  // the `media` bucket so the BEFORE-INSERT quota trigger gates it unchanged; the route's
  // per-request `ceiling: IMAGE_CEILING_BYTES` still caps the small stored WebP at 5 MiB.
  gallery: {
    crop: 'maxEdge',
    bucket: 'media',
    context: 'gallery',
    maxEdge: 2000,
    ceiling: IMAGE_CEILING_BYTES,
  },
  resume: {
    crop: 'none',
    bucket: 'resumes',
    context: 'resume',
    ceiling: RESUME_CEILING_BYTES,
  },
};

/**
 * The COARSE pre-buffer upload ceiling (D-12 / HARD-04). The max of every per-kind
 * `ceiling` (image 5 MiB, resume 10 MiB ⇒ 10 MiB = 10485760). The upload route reads
 * the request `Content-Length` and rejects with 413 BEFORE buffering the body when a
 * declared length exceeds THIS coarse bound — the actual kind isn't known until after
 * the multipart parse, so the bound must be the largest per-kind ceiling. Derived from
 * the table so a future larger kind raises it automatically (no re-export churn). The
 * authoritative gate stays the per-kind post-read `byteLength > cfg.ceiling` check
 * (Content-Length is UNTRUSTED — Pitfall 4); this is only a cheap memory-pressure
 * speed-bump that bounds the common-case buffered body to ≤10 MiB.
 */
export const MAX_UPLOAD_CEILING = Math.max(
  ...Object.values(UPLOAD_KINDS).map((k) => k.ceiling),
);

/** Per-user storage cap (D-09; raised D-10 / MEDIA-01). 65 MiB = 68157440 bytes.
 *  MUST match the SQL `quota` CONSTANT in migration 031 (the linkage test guards it). */
export const QUOTA_BYTES = 65 * 1024 * 1024;

/**
 * Derived `kind → bucket` lookup the route + delete helper share. Single source of
 * truth so the bucket for a given slot is never re-typed inline.
 */
export const kindToBucket: Record<UploadKind, UploadBucket> = {
  avatar: UPLOAD_KINDS.avatar.bucket,
  project: UPLOAD_KINDS.project.bucket,
  testimonial: UPLOAD_KINDS.testimonial.bucket,
  moodboard: UPLOAD_KINDS.moodboard.bucket,
  favicon: UPLOAD_KINDS.favicon.bucket,
  og: UPLOAD_KINDS.og.bucket,
  gallery: UPLOAD_KINDS.gallery.bucket,
  resume: UPLOAD_KINDS.resume.bucket,
};

/**
 * Client-only pre-downscale original-file ceiling for gallery picks (D-06).
 * 40 MiB covers virtually all phone/DSLR JPEG/PNG originals. This is NOT a route
 * ceiling — the upload route never sees the original file; only the small downscaled
 * WebP (≤ the per-kind `IMAGE_CEILING_BYTES`) ever reaches the route. The gallery
 * uploader rejects an over-this original BEFORE decoding/downscaling it (a memory-
 * pressure + UX speed-bump, not a security authority).
 */
export const GALLERY_ORIGINAL_CEILING_BYTES = 40 * 1024 * 1024; // 41943040

/**
 * Pure quota predicate (MEDIA-03). True when accepting `incoming` more bytes on top
 * of `used` would push the user OVER `QUOTA_BYTES`. Exactly-at-cap is allowed
 * (`used + incoming === QUOTA_BYTES` ⇒ false); one byte over is rejected.
 */
export function wouldExceedQuota(used: number, incoming: number): boolean {
  return used + incoming > QUOTA_BYTES;
}

/**
 * Dimension-bomb pixel cap (D-06). The maximum allowed dimension on either axis of
 * a decoded image; the testable unit of the client `assertRealImage` guard. The DOM
 * `Image.decode()` wrapper lives in the client uploader — this is the pure
 * `width * height` math it delegates to, so it is unit-testable without a DOM.
 */
export const MAX_IMAGE_DIMENSION = 12_000;

/**
 * True when a decoded image's pixel count exceeds the dimension-bomb cap
 * (`MAX_IMAGE_DIMENSION²`). A normal photo passes; an absurd decoded size fails.
 */
export function exceedsPixelCap(width: number, height: number): boolean {
  return width * height > MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION;
}

/* ──────────────────────────────────────────────────────────────────────────── *
 * StorageMeter pure math (D-09 / B-10 / B-11)
 *
 * The display-only `storage-meter.tsx` component reads the protected, trigger-
 * maintained `storage_used_bytes` (NEVER writes it) and renders "X / 65 MB". Its
 * DECISION math lives here — pure, `node`-unit-testable, and the single source of
 * truth for the three threshold boundaries — so the component is a thin renderer.
 * ──────────────────────────────────────────────────────────────────────────── */

/** The three meter threshold states (B-10 / B-11). NEVER an accent state. */
export type MeterState = 'under' | 'approaching' | 'over';

/** The "approaching the cap" boundary — the last ~15% of headroom (B-10). */
export const METER_APPROACHING_RATIO = 0.85;

/**
 * The threshold STATE for `used` bytes against `QUOTA_BYTES` (B-10):
 *   - under       < 85%
 *   - approaching 85% .. < 100%
 *   - over        ≥ 100% (at/over the cap)
 * Color is assigned per-state by the component (brand / warning / destructive —
 * never accent, B-11) and is ALWAYS paired with the numeric readout + a label.
 */
export function meterState(used: number): MeterState {
  if (used >= QUOTA_BYTES) return 'over';
  if (used >= QUOTA_BYTES * METER_APPROACHING_RATIO) return 'approaching';
  return 'under';
}

/**
 * The fill ratio (0..1) for the meter track width. Clamped so a garbage/negative
 * value reads 0 and an over-cap value never overflows the track (caps at 1).
 */
export function meterFillRatio(used: number): number {
  if (!Number.isFinite(used) || used <= 0) return 0;
  const ratio = used / QUOTA_BYTES;
  return ratio > 1 ? 1 : ratio;
}

/**
 * The truthful "X / 65 MB" readout (Copywriting Contract). Whole MB render as an
 * integer; a sub-MB upload shows ONE decimal so a tiny image is never shown
 * misleadingly as "0 / 65 MB". The denominator is always the cap (derived from
 * QUOTA_BYTES, so it auto-tracks D-10's raise — no hardcoded number here).
 *
 * WR-06: the decimal is FLOORED, not rounded — rounding e.g. 64.96 MB up to "65 / 65 MB"
 * read as "full" while `meterState` was still 'approaching' (an internally
 * contradictory display). Flooring reserves the exact cap figure for genuinely
 * at/over-cap usage; a real upload still floors to a visible 0.1 minimum.
 */
export function formatStorageReadout(used: number): string {
  const capMb = Math.round(QUOTA_BYTES / (1024 * 1024)); // 65
  const safe = Number.isFinite(used) && used > 0 ? used : 0;
  const usedMbRaw = safe / (1024 * 1024);
  // Whole MB → integer; otherwise one FLOORED decimal (never rounds up to the cap;
  // never floors a real upload to 0).
  let usedMb: string;
  if (Number.isInteger(usedMbRaw)) {
    usedMb = String(usedMbRaw);
  } else {
    const oneDecimal = Math.floor(usedMbRaw * 10) / 10;
    usedMb = oneDecimal === 0 && safe > 0 ? '0.1' : String(oneDecimal);
  }
  return `${usedMb} / ${capMb} MB`;
}
