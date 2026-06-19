'use client';

/**
 * ImageUploader (05-UI-SPEC §1) — the generic, ratio-aware image field that
 * REPLACES `UrlInput` for the avatar (1:1), project image (16:9), and testimonial
 * photo (1:1) slots (D-07 / D-01). ONE component, a `kind` prop selects the slot's
 * aspect ratio, retina target, preview shape, and the `kind` posted to the route.
 *
 * The full client loop (RESEARCH "Client: fixed-ratio crop → WebP blob → upload"):
 *   pick → `assertRealImage` (decode + dimension-bomb guard, D-06) → fixed-ratio
 *   CropModal (`react-cropper`, cropperjs@1) → `getCroppedCanvas({target})` →
 *   `toBlob('image/webp', 0.8)` (client encode, NO Sharp — D-04) → POST
 *   FormData{ kind, file } to `/api/media/upload` → on 200 set the value to the
 *   returned Storage URL and call `onUploaded(url)`.
 *
 * It is a FIELD CONTROL (Pattern 2): it emits a URL string (+ alt text); it does
 * NOT call saveProfileAction / saveSectionAction — the surrounding form's existing
 * Save persists the URL. It preserves the `url-input.tsx` prop contract
 * (`value` / `onValueChange` / `error` / `helper`) so it drops into the same call
 * sites, and ADDS `kind`, `onUploaded`, and `alt` / `onAltChange` for image slots.
 *
 * Required alt-text (Pitfall 3 / D-13): when an image is present a REQUIRED alt
 * `<Input>` appears; the component surfaces alt via `onAltChange` and marks itself
 * invalid until alt is non-empty. The client check is UX — the section/profile
 * save's Zod alt refine is the authoritative gate.
 *
 * Two-layer identity (SHARED-E): Evergreen & Copper PLATFORM-CHROME tokens ONLY —
 * zero inline hex, zero reach into any portfolio-template theme. The uploaded image
 * is rendered here only as a chrome preview; the template's render is out of scope.
 *
 * The client-fetch + `useRef` request-id + status-state + `aria-live` idiom mirrors
 * `username-availability.tsx`; the inline destructive confirm mirrors
 * `item-card.tsx`; the crop-modal + image-added motion mirror the Phase-4 dialog +
 * saved-&-live beat, each with a `motion-reduce:` fallback.
 */
import 'cropperjs/dist/cropper.css';

import type Cropper from 'cropperjs';
import {
  CircleCheck,
  ImagePlus,
  LoaderCircle,
  Replace as ReplaceIcon,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Cropper as ReactCropper, type ReactCropperElement } from 'react-cropper';
import { useQueryClient } from '@tanstack/react-query';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
// D-11: the unsaved-session Storage-orphan free path (replace/remove before save).
import { freeUnsavedUpload } from '@/lib/cms/free-unsaved-upload-action';
import { cmsKeys } from '@/lib/query/cms-keys';
import {
  exceedsPixelCap,
  UPLOAD_KINDS,
  type ImageSlotConfig,
  type UploadKind,
} from '@/lib/media/upload-config';

/** The image kinds this uploader handles (résumé has its own uploader). `moodboard`
 *  (13.1-03, gap #3) is the gallery image slot the moodboard form uploads through. */
export type ImageUploadKind = Extract<
  UploadKind,
  'avatar' | 'project' | 'testimonial' | 'moodboard' | 'favicon' | 'og'
>;

/** Image-slot byte ceiling in whole MB, for the truthful "{N} MB" copy. */
function ceilingMb(cfg: ImageSlotConfig): number {
  return Math.floor(cfg.ceiling / (1024 * 1024));
}

/** Per-slot ratio hint copy (05-UI-SPEC Copywriting). */
const RATIO_HINT: Record<ImageUploadKind, string> = {
  avatar: 'Square — 1:1',
  testimonial: 'Square — 1:1',
  project: 'Landscape — 16:9',
  moodboard: 'Square — 1:1',
  // 29-02 (META-03 / META-04): the page-identity image slots.
  favicon: 'Square — 1:1',
  og: 'Landscape — 1.91:1',
};

/** Per-slot preview shape (05-UI-SPEC B-2/B-3/B-4 — 4px-aligned layout constants). */
const PREVIEW_CLASS: Record<ImageUploadKind, string> = {
  avatar: 'size-22 rounded-full',
  testimonial: 'size-14 rounded-full',
  project: 'aspect-[16/9] w-full max-w-80 rounded-md',
  // A square gallery tile (1:1) on a rounded card — the moodboard grid swatch shape.
  moodboard: 'aspect-square w-full max-w-40 rounded-md',
  // 29-02 (META-03): a small square favicon chip — the browser-tab icon preview.
  favicon: 'size-16 rounded-md',
  // 29-02 (META-04): a 1.91:1 social-share card preview.
  og: 'aspect-[1.91/1] w-full max-w-80 rounded-md',
};

/** ~2.2s success-beat hold (05-UI-SPEC Motion "image added"). */
const SUCCESS_BEAT_MS = 2200;

const ALT_HELPER =
  'Describe this photo in a few words. This helps people using screen readers and shows if the image can’t load.';
const ALT_REQUIRED_ERROR = 'Add a short description of this photo before saving.';

/** Friendly client-side reject copy (05-UI-SPEC error contract). */
type RejectMessage = string;

/** Map the route's typed error codes → the 05-UI-SPEC friendly messages. */
function uploadErrorMessage(code: string | undefined, ceiling: number): RejectMessage {
  switch (code) {
    case 'unsupported_type':
      return 'That file type isn’t allowed. Please upload a JPG, PNG, or WebP image.';
    case 'too_large':
      return `That image is too large. Try one under ${ceiling} MB.`;
    case 'quota_exceeded':
      return 'You’re out of storage. Remove a photo or your résumé to free up space.';
    default:
      return 'We couldn’t upload your photo. Please try again.';
  }
}

type Status = 'idle' | 'validating' | 'cropping' | 'uploading' | 'uploaded' | 'error';

export interface ImageUploaderProps {
  /** Which slot — drives aspect / retina target / ceiling / preview shape / wire kind. */
  kind: ImageUploadKind;
  /** Controlled value: the current Storage URL ('' when empty). Mirrors UrlInput. */
  value: string;
  /** Change handler — receives the new URL string ('' on remove). Mirrors UrlInput. */
  onValueChange: (value: string) => void;
  /** Fired with the Storage URL on a successful upload (alongside onValueChange). */
  onUploaded?: (url: string) => void;
  /** Controlled alt text for the required accessibility description (image slots). */
  alt?: string;
  /** Alt-text change handler — the surrounding form persists it (section/profile). */
  onAltChange?: (alt: string) => void;
  /** Server-provided field error for this slot's URL (wins over local messaging). */
  error?: string;
  /** Field label (e.g. "Avatar", "Project image"). Defaults to "Photo". */
  label?: string;
  /**
   * D-11: the surrounding form's LAST-SAVED baseline URL for this slot (the
   * TanStack-cache persisted value). When a replace/remove supersedes the bound
   * `value`, the superseded object is freed ONLY when it differs from this
   * baseline — the persisted value and any restore target are never freed here
   * (the WR-03 on-save diff already handles persisted-object churn). Omit it (or
   * leave it '') when there is no persisted baseline yet (a brand-new, never-saved
   * field) — then every superseded in-session URL is safely freed.
   */
  persistedValue?: string;
}

export function ImageUploader({
  kind,
  value,
  onValueChange,
  onUploaded,
  alt,
  onAltChange,
  error,
  label = 'Photo',
  persistedValue,
}: ImageUploaderProps) {
  const cfg = UPLOAD_KINDS[kind] as ImageSlotConfig;
  const ceiling = ceilingMb(cfg);
  const queryClient = useQueryClient();

  /**
   * Invalidate the read-only StorageMeter's owner-scoped query so it RE-READS the
   * trigger-maintained `storage_used_bytes` after this upload/remove changed usage.
   * This is a READ refresh, never a write of the protected column (T-05-22): we
   * match the `cmsKeys.storageUsed(...)` key by its stable `'storage-used'` segment
   * (the owner id is not known here — the predicate matches any owner's meter key,
   * and only the mounted owner's query exists in this client's cache).
   */
  const refreshStorageMeter = useCallback(() => {
    void queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey[0] === cmsKeys.all[0] &&
        q.queryKey[1] === 'storage-used',
    });
  }, [queryClient]);

  /**
   * D-11: free a SUPERSEDED unsaved Storage object (best-effort). The object is
   * freed ONLY when it is non-empty AND differs from the persisted baseline — so
   * the last-saved URL and any restore target are never deleted (the WR-03 on-save
   * diff owns persisted-object churn; this path owns unsaved-session churn — the
   * two stay disjoint). The server action is idempotent + own-folder-guarded, so a
   * stale/foreign URL is a safe no-op; we fire-and-forget and never block the UI on
   * it, then refresh the meter once the now-decremented usage settles.
   */
  const freeIfUnsaved = useCallback(
    (superseded: string) => {
      if (superseded === '' || superseded === persistedValue) return;
      void freeUnsavedUpload(superseded)
        .then(() => refreshStorageMeter())
        .catch(() => {
          // The action never rejects in practice (no-throw primitive); a transport
          // failure leaves the orphan for the WR-01 log + eventual sweep. Swallow —
          // a failed best-effort free must never surface to the user.
        });
    },
    [persistedValue, refreshStorageMeter],
  );

  // D-11: always-current bound value, so the unmount belt can free a still-held
  // unsaved URL without re-subscribing the cleanup on every keystroke.
  const currentValueRef = useRef(value);
  useEffect(() => {
    currentValueRef.current = value;
  }, [value]);
  const persistedValueRef = useRef(persistedValue);
  useEffect(() => {
    persistedValueRef.current = persistedValue;
  }, [persistedValue]);

  const [status, setStatus] = useState<Status>('idle');
  const [rejectMsg, setRejectMsg] = useState<RejectMessage | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [altTouched, setAltTouched] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<ReactCropperElement>(null);
  // Ignore a stale upload response if the user re-picked before it resolved.
  const reqId = useRef(0);

  const altId = useId();
  const altValue = alt ?? '';
  const hasImage = value.trim() !== '';
  const altInvalid = hasImage && altValue.trim() === '';

  // Re-settle the success beat back to a resting "uploaded" state after ~2.2s.
  useEffect(() => {
    if (status !== 'uploaded') return;
    const t = setTimeout(() => setStatus('idle'), SUCCESS_BEAT_MS);
    return () => clearTimeout(t);
  }, [status]);

  // Free the object URL backing the crop stage when it changes / unmounts.
  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  // D-11 belt (reconcile-on-unmount): if the field is torn down while still holding
  // an UNSAVED URL that differs from the persisted baseline, free it. This catches
  // the case where the user uploads then navigates away / collapses the section
  // without ever replacing, removing, or saving. Reads refs so it fires once on
  // unmount with the LATEST held value (not the mount-time value); after a save the
  // baseline equals the held value, so the saved object is correctly left intact.
  // The server action is idempotent + own-folder-guarded — safe as fire-and-forget.
  useEffect(() => {
    return () => {
      const held = currentValueRef.current;
      const persisted = persistedValueRef.current;
      if (held !== '' && held !== persisted) {
        void freeUnsavedUpload(held).catch(() => {});
      }
    };
    // Mount-once: the refs always carry the current values at unmount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPicker = useCallback(() => {
    setRejectMsg(null);
    fileInputRef.current?.click();
  }, []);

  /**
   * Decode the picked file + run the dimension-bomb guard (D-06) BEFORE crop. The
   * `Image.decode()` throws for a non-decodable file; the pure pixel-cap predicate
   * (Plan-01 spine) rejects an absurd decoded size. UX defense-in-depth — the route
   * byte-ceiling is the authoritative image-bomb backstop.
   */
  const assertRealImage = useCallback(async (file: File): Promise<void> => {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode(); // throws if not a real, decodable image
      if (exceedsPixelCap(img.naturalWidth, img.naturalHeight)) {
        throw new Error('too_large');
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setRejectMsg(null);
      setStatus('validating');

      // Client pre-check: byte ceiling (the route re-enforces server-side).
      if (file.size > cfg.ceiling) {
        setStatus('idle');
        setRejectMsg(`That image is too large. Try one under ${ceiling} MB.`);
        return;
      }

      try {
        await assertRealImage(file);
      } catch (e) {
        setStatus('idle');
        setRejectMsg(
          e instanceof Error && e.message === 'too_large'
            ? `That image is too large. Try one under ${ceiling} MB.`
            : 'That file isn’t an image we can use. Choose a JPG, PNG, or WebP.',
        );
        return;
      }

      // Validation passed — read as a data URL so the canvas is never
      // cross-origin-tainted (toBlob would otherwise throw), then open the modal.
      const reader = new FileReader();
      reader.onload = () => {
        setCropSrc(reader.result as string);
        setStatus('cropping');
      };
      reader.onerror = () => {
        setStatus('idle');
        setRejectMsg('That file isn’t an image we can use. Choose a JPG, PNG, or WebP.');
      };
      reader.readAsDataURL(file);
    },
    [assertRealImage, cfg.ceiling, ceiling],
  );

  /**
   * "Use photo": crop → retina-target canvas → WebP blob → POST. Mirrors the
   * RESEARCH `produceWebp` contract; the route re-sniffs the bytes regardless.
   */
  const handleUsePhoto = useCallback(async () => {
    const cropper = cropperRef.current?.cropper as Cropper | undefined;
    if (!cropper) return;

    setStatus('uploading');
    const myReq = ++reqId.current;
    // D-11: the URL currently bound is the one this new upload supersedes. Capture
    // it BEFORE the async swap so we can free it (iff it was an unsaved in-session
    // object) once the new URL lands.
    const superseded = value;

    try {
      const canvas = cropper.getCroppedCanvas({
        width: cfg.target.width,
        height: cfg.target.height,
        imageSmoothingQuality: 'high',
        fillColor: '#fff',
      });
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('encode_failed'))),
          'image/webp',
          0.8,
        ),
      );

      const fd = new FormData();
      fd.append('kind', kind);
      fd.append('file', blob, 'image.webp');

      const res = await fetch('/api/media/upload', { method: 'POST', body: fd });

      // A newer pick/upload superseded this one — drop the stale response.
      if (myReq !== reqId.current) return;

      if (!res.ok) {
        let code: string | undefined;
        try {
          code = (await res.json())?.error;
        } catch {
          code = undefined;
        }
        setStatus('error');
        setRejectMsg(uploadErrorMessage(code, ceiling));
        return;
      }

      const { url } = (await res.json()) as { url: string };
      if (myReq !== reqId.current) return;

      // Close the modal, swap the value, fire the success beat.
      if (cropSrc) {
        URL.revokeObjectURL(cropSrc);
        setCropSrc(null);
      }
      // D-11: free the object this upload just superseded (best-effort, gated on
      // `superseded !== '' && superseded !== persistedValue`). Fired BEFORE the
      // value swap so the replaced in-session orphan is reclaimed and
      // storage_used_bytes stays accurate; the persisted baseline is never freed.
      freeIfUnsaved(superseded);
      // WR-02: advance the belt's tracked value to the NEW url synchronously, so an
      // unmount before the `value` effect commits cannot re-free the superseded URL
      // (same race as doRemove). The belt frees `currentValueRef.current` only when
      // it differs from the persisted baseline, so setting it to `url` is correct:
      // an unsaved `url` still gets freed on a later unmount, the superseded one
      // never double-fires.
      currentValueRef.current = url;
      onValueChange(url);
      onUploaded?.(url);
      setRejectMsg(null); // WR-05: clear any prior error so it can't coexist with the success beat
      setStatus('uploaded');
      // The route's Storage write incremented usage — re-read the meter.
      refreshStorageMeter();
    } catch {
      if (myReq !== reqId.current) return;
      setStatus('error');
      setRejectMsg('We couldn’t upload your photo. Please try again.');
    }
  }, [
    cfg.target.height,
    cfg.target.width,
    cropSrc,
    kind,
    ceiling,
    onUploaded,
    onValueChange,
    refreshStorageMeter,
    freeIfUnsaved, // D-11
    value, // D-11: the superseded URL captured at call start
  ]);

  const cancelCrop = useCallback(() => {
    if (cropSrc) {
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
    setStatus('idle');
    // Allow re-picking the same file after a cancel.
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [cropSrc]);

  const doRemove = useCallback(() => {
    setConfirmRemove(false);
    if (value) {
      // D-11: removing an UNSAVED object frees it (gated on `!== persistedValue`),
      // so a remove-before-save leaves no orphan. The persisted value is never
      // freed here — clearing the field unsets the form reference, and the WR-03
      // on-save diff reclaims the persisted object when that empty state is saved.
      freeIfUnsaved(value);
      // WR-02: clear the belt's tracked value SYNCHRONOUSLY. `onValueChange('')`
      // only updates `currentValueRef` after the parent re-renders and the
      // `value` effect runs — but the parent (ItemManager.remove) may unmount
      // this uploader on the SAME tick, before that effect commits. Without this
      // line the unmount belt would read the just-freed URL from the stale ref
      // and fire a SECOND freeUnsavedUpload for the same object (idempotent, but
      // it races the AFTER-DELETE storage_used_bytes trigger).
      currentValueRef.current = '';
      onValueChange('');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setStatus('idle');
  }, [onValueChange, value, freeIfUnsaved]);

  const busy = status === 'validating' || status === 'uploading';

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>

      {/* Hidden native file input — labeled by the dropzone button's accessible name.
          `data-testid="{kind}-uploader"` lets the e2e drive the real pick→crop→upload
          slice via Playwright `setInputFiles` (e2e/media-upload.spec.ts). */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        data-testid={`${kind}-uploader`}
        className="sr-only"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          // Reset so re-picking the same file re-fires onChange.
          e.target.value = '';
        }}
      />

      {!hasImage ? (
        /* ── Empty / rest: the considered dashed dropzone (AddItemCard affordance). */
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
              {status === 'uploading' ? 'Uploading…' : 'Checking your image…'}
            </span>
          ) : (
            <>
              <ImagePlus aria-hidden="true" className="size-6 text-muted-foreground" />
              <span className="text-base text-foreground">Upload a photo</span>
              <span className="text-[13px] leading-tight text-muted-foreground">
                {RATIO_HINT[kind]}
              </span>
            </>
          )}
        </button>
      ) : (
        /* ── Uploaded / has-image: preview + Replace + Remove + required alt. */
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- chrome preview of
                a host-locked Storage URL; the template render is out of scope. */}
            <img
              src={value}
              alt=""
              className={
                `${PREVIEW_CLASS[kind]} shrink-0 border border-border object-cover ` +
                'transition-opacity duration-200 motion-reduce:transition-none'
              }
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={openPicker}
                disabled={busy}
                aria-label="Replace photo"
                className="w-auto"
              >
                <ReplaceIcon aria-hidden="true" className="size-4" />
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmRemove(true)}
                disabled={busy}
                aria-label="Remove photo"
                className="w-auto hover:text-destructive"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Remove
              </Button>
            </div>
          </div>

          {/* Uploading-while-replacing inline status. */}
          {busy ? (
            <p
              aria-live="polite"
              className="flex items-center gap-1.5 text-[13px] leading-tight text-muted-foreground"
            >
              <LoaderCircle
                aria-hidden="true"
                className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
              />
              {status === 'uploading' ? 'Uploading…' : 'Checking your image…'}
            </p>
          ) : null}

          {/* Required alt-text Input (Pitfall 3 — the server refine is the real gate). */}
          <Input
            id={altId}
            label="Alt text"
            value={altValue}
            aria-required="true"
            aria-invalid={altTouched && altInvalid ? true : undefined}
            helper={ALT_HELPER}
            error={altTouched && altInvalid ? ALT_REQUIRED_ERROR : error}
            onChange={(e) => onAltChange?.(e.target.value)}
            onBlur={() => setAltTouched(true)}
          />

          {/* Inline destructive remove-confirm (mirrors item-card.tsx). */}
          {confirmRemove ? (
            <div
              role="alertdialog"
              aria-label="Remove this photo?"
              className="rounded-md border border-border bg-destructive-bg px-4 py-3 motion-reduce:transition-none"
            >
              <p className="text-sm font-semibold text-foreground">Remove this photo?</p>
              <p className="mt-1 text-[13px] leading-tight text-muted-foreground">
                This will delete it from your portfolio. This can’t be undone after you save.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={doRemove}
                  className="w-auto bg-destructive hover:bg-destructive"
                >
                  Remove
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  autoFocus
                  onClick={() => setConfirmRemove(false)}
                  className="w-auto"
                >
                  Keep
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Success beat: accent circle-check glyph + success caption (color + glyph + text). */}
      {status === 'uploaded' ? (
        <p
          aria-live="polite"
          className={
            'flex items-center gap-1.5 rounded-sm bg-success-bg px-2 py-1 text-[13px] ' +
            'leading-tight text-success transition-opacity duration-200 motion-reduce:transition-none'
          }
        >
          <CircleCheck aria-hidden="true" className="size-3.5 shrink-0 text-accent" />
          <span>Photo added — it’s on your page</span>
        </p>
      ) : null}

      {/* Reject / upload-error message (color + glyph + text + a solution path). */}
      {rejectMsg ? (
        <Alert variant="error" className="motion-reduce:transition-none">
          {rejectMsg}
        </Alert>
      ) : null}

      {/* ── CropModal: focus-trapped, ratio-LOCKED, no freeform crop (D-03). */}
      {cropSrc ? (
        <CropModal
          src={cropSrc}
          aspect={cfg.aspect}
          cropperRef={cropperRef}
          uploading={status === 'uploading'}
          onUsePhoto={handleUsePhoto}
          onCancel={cancelCrop}
        />
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */

interface CropModalProps {
  src: string;
  aspect: number;
  cropperRef: React.RefObject<ReactCropperElement | null>;
  uploading: boolean;
  onUsePhoto: () => void;
  onCancel: () => void;
}

/**
 * CropModal (05-UI-SPEC §2) — the signature surface: a focus-trapped dialog with
 * the slot's aspect ratio LOCKED via `react-cropper` (cropperjs@1). No ratio
 * selector exists — the slot decides (D-03, the "hard-to-make-ugly" guarantee).
 * `Esc` cancels; the dialog mirrors the Phase-4 dialog motion with a motion-reduce
 * fallback.
 */
function CropModal({
  src,
  aspect,
  cropperRef,
  uploading,
  onUsePhoto,
  onCancel,
}: CropModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Esc cancels; focus moves into the dialog on open (Phase-4 dialog contract).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className={
        'fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 ' +
        'crop-backdrop-enter'
      }
      onClick={(e) => {
        // Click on the backdrop (not the dialog) cancels.
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          'flex w-full max-w-lg flex-col gap-4 rounded-lg border border-border bg-surface p-6 ' +
          'shadow-card outline-none crop-dialog-enter'
        }
      >
        {/* Header: title + 44px close. */}
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            Position your photo
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className={
              'flex size-11 shrink-0 items-center justify-center rounded-sm text-muted-foreground ' +
              'outline-none hover:text-foreground ' +
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
            }
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        {/* Stage: the ratio-LOCKED cropper on a surface-muted backing. */}
        <div className="overflow-hidden rounded-md bg-surface-muted">
          <ReactCropper
            ref={cropperRef}
            src={src}
            aspectRatio={aspect}
            viewMode={1}
            guides
            background={false}
            responsive
            autoCropArea={1}
            checkOrientation
            dragMode="move"
            style={{ height: 300, width: '100%' }}
          />
        </div>

        {/* Zoom affordance label (cropperjs native wheel/pinch zoom on the stage). */}
        <p className="flex items-center gap-1.5 text-[13px] leading-tight text-muted-foreground">
          <ZoomIn aria-hidden="true" className="size-3.5 shrink-0" />
          <span>Scroll or pinch on the image to zoom.</span>
        </p>

        {/* Footer: Cancel (ghost) + Use photo (brand). */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} className="w-auto">
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onUsePhoto}
            loading={uploading}
            className="w-auto"
          >
            Use photo
          </Button>
        </div>
      </div>
    </div>
  );
}
