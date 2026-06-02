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

/** The four upload slots. `kind` is the wire param the route branches on. */
export type UploadKind = 'avatar' | 'project' | 'testimonial' | 'resume';

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
