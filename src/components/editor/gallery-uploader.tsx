'use client';

/**
 * GalleryUploader (34-02, MEDIA-02/03/04 / D-05/D-07/D-09) — the no-crop, multi-file
 * BATCH gallery upload primitive the whole v2.8 gallery chain rests on.
 *
 * A deliberate FORK of `image-uploader.tsx` (RESEARCH line 33 — NEW component over
 * extending ImageUploader): it REUSES that file's helpers (`refreshStorageMeter`
 * idiom, the `freeUnsavedUpload` orphan belt, the upload POST shape, the
 * `uploadErrorMessage` tone) and replaces ONLY the single-file fixed-ratio crop step
 * with a sequential, native-aspect downscale loop.
 *
 * The per-item client loop (RESEARCH lines 438-467):
 *   pick (multiple) → reject > GALLERY_ORIGINAL_CEILING_BYTES → decodeOriented
 *   (EXIF-baked) → exceedsPixelCap gate (12000px decode-bomb, MEDIA-04) →
 *   downscaleToWebp (2000px longest edge, one WebP) → POST FormData{kind:'gallery'}
 *   to /api/media/upload → on 200 emit {url, width, height} (the downscale-canvas
 *   dims, D-05) + arm the orphan belt + refresh the meter.
 *
 * Continue-on-error + quota-halt (D-07): a per-item failure is collected and the
 * loop CONTINUES with a final "N of M couldn't be added" summary; a mid-batch 409
 * `{error:'quota_exceeded'}` BREAKs the queue (later items are not attempted).
 *
 * Orphan-free belt at batch scale (D-09 / Pitfall 6): the uploader OWNS a
 * `producedUrls` set of the in-session URLs it emitted; the Phase-35 form SUPPLIES a
 * `persistedUrls` prop (RESEARCH Open Q1 RESOLVED). On unmount, every produced URL
 * the form has not persisted is freed via `freeUnsavedUpload` (the service-role,
 * own-folder-guarded delete — NEVER a raw `.remove()`).
 *
 * FIELD CONTROL (Pattern 2): it emits items to the parent; it NEVER calls
 * saveSectionAction / revalidatePath — the surrounding form's Save persists.
 *
 * The batch loop + the orphan reconcile are lifted into pure, injectable helpers
 * (`uploadGalleryBatch`, `reconcileOrphans`) so the jsdom component test can assert
 * the loop/callback/halt behavior WITHOUT a real canvas or `createImageBitmap`
 * (mirrors the `buildMoodboardContent` / `recordView` render-free test discipline).
 */
import { ImagePlus, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { Alert } from '@/components/ui/alert';
import { freeUnsavedUpload } from '@/lib/cms/free-unsaved-upload-action';
import { cmsKeys } from '@/lib/query/cms-keys';
import {
  decodeOriented as defaultDecodeOriented,
  downscaleToWebp as defaultDownscaleToWebp,
  type OrientedSource,
} from '@/lib/media/downscale';
import {
  exceedsPixelCap,
  GALLERY_ORIGINAL_CEILING_BYTES,
  UPLOAD_KINDS,
} from '@/lib/media/upload-config';

/** The downscale-canvas dims emitted per successful item (D-05 — the stored pixels). */
export interface GalleryUploadItem {
  url: string;
  width: number;
  height: number;
}

/** A per-file failure collected during the batch (drives the summary copy). */
export interface GalleryUploadFailure {
  name: string;
  reason: 'too_large' | 'unsupported_type' | 'decode_failed' | 'error';
}

/** The outcome of a single batch run (the pure loop's return). */
export interface GalleryBatchResult {
  /** True when a mid-batch quota_exceeded halted the remaining queue (D-07). */
  halted: boolean;
  /** The per-file failures (continue-on-error); empty on a clean batch. */
  failures: GalleryUploadFailure[];
}

/** The injectable seam for `uploadGalleryBatch` (mocked render-free in tests). */
export interface GalleryBatchDeps {
  decodeOriented: (file: File) => Promise<OrientedSource>;
  downscaleToWebp: (
    oriented: OrientedSource,
    maxEdge: number,
    quality?: number,
  ) => Promise<{ blob: Blob; width: number; height: number }>;
  uploadBlob: (blob: Blob) => Promise<Response>;
  onUploaded: (item: GalleryUploadItem) => void;
  /** Fired after each successful upload so the storage meter re-reads usage. */
  onUploadedSettled?: () => void;
}

/**
 * The PURE sequential batch loop (D-02/D-07) — `for…of` with `await` per item,
 * NEVER `Promise.all` (the parallel anti-pattern that races the quota row-lock).
 * Per item: client size gate → decode → pixel-cap gate → downscale → upload. A
 * per-item failure is collected and the loop CONTINUES; a 409 `quota_exceeded`
 * BREAKs (halt). Each success emits {url,width,height} immediately (incremental UX).
 *
 * Extracted (with injected deps) so the jsdom test exercises it without a real
 * canvas/createImageBitmap.
 */
export async function uploadGalleryBatch(
  files: File[],
  deps: GalleryBatchDeps,
): Promise<GalleryBatchResult> {
  const maxEdge = UPLOAD_KINDS.gallery.crop === 'maxEdge' ? UPLOAD_KINDS.gallery.maxEdge : 2000;
  const failures: GalleryUploadFailure[] = [];

  for (const file of files) {
    // (1) Client pre-downscale ceiling (D-06) — reject absurd originals before decode.
    if (file.size > GALLERY_ORIGINAL_CEILING_BYTES) {
      failures.push({ name: file.name, reason: 'too_large' });
      continue;
    }

    let oriented: OrientedSource;
    try {
      oriented = await deps.decodeOriented(file);
    } catch {
      // A non-decodable / unsupported file (e.g. a sneaky non-image) — collect + continue.
      failures.push({ name: file.name, reason: 'decode_failed' });
      continue;
    }

    // (3) Decode-bomb gate (MEDIA-04, T-34-06) — cap the DECODED bitmap before downscale.
    if (exceedsPixelCap(oriented.width, oriented.height)) {
      failures.push({ name: file.name, reason: 'too_large' });
      continue;
    }

    try {
      const { blob, width, height } = await deps.downscaleToWebp(oriented, maxEdge, 0.8);
      const res = await deps.uploadBlob(blob);

      if (!res.ok) {
        let code: string | undefined;
        try {
          code = ((await res.json()) as { error?: string })?.error;
        } catch {
          code = undefined;
        }
        // (6) Mid-batch quota_exceeded HALTS the remaining queue (D-07).
        if (code === 'quota_exceeded') {
          return { halted: true, failures };
        }
        failures.push({
          name: file.name,
          reason: code === 'unsupported_type' ? 'unsupported_type' : 'error',
        });
        continue;
      }

      const { url } = (await res.json()) as { url: string };
      // (7) Emit immediately (incremental UX) + let the caller arm the belt / refresh.
      deps.onUploaded({ url, width, height });
      deps.onUploadedSettled?.();
    } catch {
      failures.push({ name: file.name, reason: 'error' });
      continue;
    }
  }

  return { halted: false, failures };
}

/**
 * The PURE orphan-reconcile (D-09): free every produced URL the form has NOT
 * persisted. Used by the unmount belt; extracted so the test asserts the set diff
 * without mounting React.
 */
export function reconcileOrphans(
  produced: ReadonlySet<string>,
  persisted: ReadonlySet<string>,
  free: (url: string) => void,
): void {
  for (const url of produced) {
    if (url !== '' && !persisted.has(url)) free(url);
  }
}

/** Friendly batch-summary copy for the collected per-file failures. */
function summaryCopy(failures: GalleryUploadFailure[], total: number): string {
  const n = failures.length;
  return `${n} of ${total} couldn’t be added. Use JPG, PNG, or WebP images under 40 MB.`;
}

export interface GalleryUploaderProps {
  /** Fired once per successful item with the downscale-canvas dims (D-05). */
  onUploaded: (item: GalleryUploadItem) => void;
  /**
   * D-09: the URLs the surrounding form has PERSISTED. On unmount every produced URL
   * NOT in this set is freed. The uploader owns the produced-set tracking; the
   * Phase-35 form supplies this prop (RESEARCH Open Q1 RESOLVED). A freshly-saved
   * URL appears here, so its object is correctly left intact.
   */
  persistedUrls?: ReadonlySet<string>;
  /** Field label. Defaults to "Add photos". */
  label?: string;
}

export function GalleryUploader({
  onUploaded,
  persistedUrls,
  label = 'Add photos',
}: GalleryUploaderProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [outOfSpace, setOutOfSpace] = useState(false);
  // Ignore a stale batch result if the user re-picked before it resolved.
  const reqId = useRef(0);

  /**
   * Read-refresh the display-only StorageMeter (NEVER a write of the protected
   * column) — copied verbatim from image-uploader.tsx:186-193.
   */
  const refreshStorageMeter = useCallback(() => {
    void queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey[0] === cmsKeys.all[0] &&
        q.queryKey[1] === 'storage-used',
    });
  }, [queryClient]);

  // D-09: the in-session URLs this component produced (the SET form of
  // image-uploader.tsx's `currentValueRef`). A ref so the unmount belt fires once
  // with the LATEST set, not the mount-time set.
  const producedUrlsRef = useRef<Set<string>>(new Set());
  // D-09: the latest persisted baseline, mirrored to a ref for the same reason
  // (image-uploader.tsx:224-227).
  const persistedUrlsRef = useRef<ReadonlySet<string>>(persistedUrls ?? new Set());
  useEffect(() => {
    persistedUrlsRef.current = persistedUrls ?? new Set();
  }, [persistedUrls]);

  // D-09 belt (reconcile-on-unmount, image-uploader.tsx:259-276 at batch scale): if
  // torn down while still holding UNSAVED produced URLs, free each one the form has
  // not persisted. Fires once on unmount with the latest sets (read via refs). The
  // server action is idempotent + own-folder-guarded — safe as fire-and-forget.
  useEffect(() => {
    return () => {
      reconcileOrphans(producedUrlsRef.current, persistedUrlsRef.current, (url) => {
        void freeUnsavedUpload(url).catch(() => {});
      });
    };
    // Mount-once: the refs carry the current sets at unmount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      const total = files.length;
      const myReq = ++reqId.current;

      setSummary(null);
      setOutOfSpace(false);
      setBusy(true);

      const result = await uploadGalleryBatch(files, {
        decodeOriented: defaultDecodeOriented,
        downscaleToWebp: defaultDownscaleToWebp,
        uploadBlob: async (blob) => {
          const fd = new FormData();
          fd.append('kind', 'gallery');
          fd.append('file', blob, 'image.webp');
          return fetch('/api/media/upload', { method: 'POST', body: fd });
        },
        onUploaded: (item) => {
          // A newer pick superseded this batch — drop its emits/tracking.
          if (myReq !== reqId.current) return;
          producedUrlsRef.current.add(item.url);
          onUploaded(item);
        },
        onUploadedSettled: () => {
          if (myReq !== reqId.current) return;
          refreshStorageMeter();
        },
      });

      // A newer pick superseded this batch — drop the stale summary/state.
      if (myReq !== reqId.current) return;

      setBusy(false);
      if (result.halted) setOutOfSpace(true);
      if (result.failures.length > 0) setSummary(summaryCopy(result.failures, total));
    },
    [onUploaded, refreshStorageMeter],
  );

  const openPicker = useCallback(() => {
    setSummary(null);
    setOutOfSpace(false);
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>

      {/* Hidden native multi-file input. `accept` allowlist excludes HEIC (createImageBitmap
          can't decode it); `data-testid="gallery-uploader"` drives the Playwright e2e. */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        data-testid="gallery-uploader"
        className="sr-only"
        onChange={(e) => {
          void handleFiles(e.target.files);
          // Reset so re-picking the same files re-fires onChange.
          e.target.value = '';
        }}
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={busy}
        aria-busy={busy || undefined}
        className={
          'flex min-h-22 w-full flex-col items-center justify-center gap-1 rounded-md ' +
          'border-[1.5px] border-dashed border-border-strong bg-surface-muted px-4 py-6 ' +
          'text-center outline-none transition-colors ' +
          'hover:border-border-strong hover:bg-surface ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
          'disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none'
        }
      >
        {busy ? (
          <span className="flex items-center gap-2 text-[13px] leading-tight text-muted-foreground">
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            Adding your photos…
          </span>
        ) : (
          <>
            <ImagePlus aria-hidden="true" className="size-6 text-muted-foreground" />
            <span className="text-base text-foreground">Add photos</span>
            <span className="text-[13px] leading-tight text-muted-foreground">
              Pick several at once — JPG, PNG, or WebP
            </span>
          </>
        )}
      </button>

      {/* Mid-batch quota halt (D-07) — distinct from the per-file summary. */}
      {outOfSpace ? (
        <Alert variant="error" className="motion-reduce:transition-none">
          You’re out of space — remove some images to add more.
        </Alert>
      ) : null}

      {/* Per-file continue-on-error summary. */}
      {summary ? (
        <Alert variant="error" className="motion-reduce:transition-none">
          {summary}
        </Alert>
      ) : null}
    </div>
  );
}
