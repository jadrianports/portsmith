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
export type UploadKind = 'avatar' | 'project' | 'testimonial' | 'moodboard' | 'resume';

/** A user-writable Storage bucket (migration 003). */
export type UploadBucket = 'avatars' | 'media' | 'resumes';

export interface ImageSlotConfig {
  bucket: UploadBucket;
  context: string;
  /** Fixed crop aspect ratio (D-03). */
  aspect: number;
  /** Retina target pixel size for the single stored WebP (D-05). */
  target: { width: number; height: number };
  /** Per-request byte ceiling (defense-in-depth with the bucket cap). */
  ceiling: number;
}

export interface FileSlotConfig {
  bucket: UploadBucket;
  context: string;
  ceiling: number;
}

export type UploadSlotConfig = ImageSlotConfig | FileSlotConfig;

/**
 * Per-slot upload specs. Image slots (avatar/project/testimonial) carry the fixed
 * crop aspect + retina target; the résumé slot is a raw PDF (no crop/aspect).
 */
export const UPLOAD_KINDS: Record<UploadKind, UploadSlotConfig> = {
  avatar: {
    bucket: 'avatars',
    context: 'avatar',
    aspect: 1,
    target: { width: 512, height: 512 },
    ceiling: IMAGE_CEILING_BYTES,
  },
  project: {
    bucket: 'media',
    context: 'project',
    aspect: 16 / 9,
    target: { width: 1600, height: 900 },
    ceiling: IMAGE_CEILING_BYTES,
  },
  testimonial: {
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
    bucket: 'media',
    context: 'moodboard',
    aspect: 1,
    target: { width: 1200, height: 1200 },
    ceiling: IMAGE_CEILING_BYTES,
  },
  resume: {
    bucket: 'resumes',
    context: 'resume',
    ceiling: RESUME_CEILING_BYTES,
  },
};

/** Per-user storage cap (D-09). 25 MiB = 26214400 bytes. */
export const QUOTA_BYTES = 25 * 1024 * 1024;

/**
 * Derived `kind → bucket` lookup the route + delete helper share. Single source of
 * truth so the bucket for a given slot is never re-typed inline.
 */
export const kindToBucket: Record<UploadKind, UploadBucket> = {
  avatar: UPLOAD_KINDS.avatar.bucket,
  project: UPLOAD_KINDS.project.bucket,
  testimonial: UPLOAD_KINDS.testimonial.bucket,
  moodboard: UPLOAD_KINDS.moodboard.bucket,
  resume: UPLOAD_KINDS.resume.bucket,
};

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
 * maintained `storage_used_bytes` (NEVER writes it) and renders "X / 25 MB". Its
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
 * The truthful "X / 25 MB" readout (Copywriting Contract). Whole MB render as an
 * integer; a sub-MB upload shows ONE decimal so a tiny image is never shown
 * misleadingly as "0 / 25 MB". The denominator is always the 25 MB cap.
 *
 * WR-06: the decimal is FLOORED, not rounded — rounding 24.96 MB up to "25 / 25 MB"
 * read as "full" while `meterState` was still 'approaching' (an internally
 * contradictory display). Flooring reserves the exact cap figure for genuinely
 * at/over-cap usage; a real upload still floors to a visible 0.1 minimum.
 */
export function formatStorageReadout(used: number): string {
  const capMb = Math.round(QUOTA_BYTES / (1024 * 1024)); // 25
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
