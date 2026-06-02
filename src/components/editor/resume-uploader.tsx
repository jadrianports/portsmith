'use client';

/**
 * ResumeUploader (05-UI-SPEC §3) — the PDF résumé field that REPLACES the résumé
 * `UrlInput` in ProfileForm (D-07 / D-11). A separate, SIMPLER sibling of
 * `image-uploader.tsx`: a single PDF per user, surfaced as `profile.resume_url`.
 * It has NO crop modal and NO alt-text (D-11) — a résumé is a raw PDF, not an image.
 *
 * The full client loop (a stripped image-uploader flow):
 *   pick a PDF → POST FormData{ kind:'resume', file } to `/api/media/upload` → on
 *   200 set the value to the returned host-locked Storage URL + call onUploaded(url).
 * The route re-sniffs the bytes server-side regardless of the client `accept` filter
 * (magic-byte allowlist accepts ONLY `application/pdf` for kind=resume), so the
 * `accept="application/pdf"` here is a friendly pre-filter, never the boundary.
 *
 * It is a FIELD CONTROL (Pattern 2): it emits a URL string via onValueChange /
 * onUploaded; it does NOT call saveProfileAction. The surrounding ProfileForm's
 * existing Save persists `resume_url`, and the delete-then-upload (D-11/D-12) — the
 * prior PDF object being deleted on replace/clear — happens in `saveProfileAction`'s
 * delete-on-replace leg (Plan 04 Task 3), NOT here.
 *
 * It preserves the `url-input.tsx` prop contract (`value` / `onValueChange` /
 * `error?` / `helper?`) so it drops into the same call site, and ADDS `onUploaded?`.
 *
 * Two-layer identity (SHARED-E): Evergreen & Copper PLATFORM-CHROME tokens ONLY —
 * zero inline hex, zero reach into any portfolio-template theme. The client-fetch +
 * `useRef` request-id + status-state idiom mirrors `image-uploader.tsx` (itself the
 * `username-availability.tsx` idiom); the inline destructive Remove confirm mirrors
 * `item-card.tsx` / the image-uploader's confirm.
 */
import {
  CircleCheck,
  ExternalLink,
  FileText,
  LoaderCircle,
  Replace as ReplaceIcon,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { UPLOAD_KINDS, type FileSlotConfig } from '@/lib/media/upload-config';

/** Résumé byte ceiling in whole MB, for the truthful "{N} MB" copy. */
function ceilingMb(cfg: FileSlotConfig): number {
  return Math.floor(cfg.ceiling / (1024 * 1024));
}

/** ~2.2s success-beat hold (05-UI-SPEC Motion "résumé added"). */
const SUCCESS_BEAT_MS = 2200;

/** Friendly client-side reject copy (05-UI-SPEC error contract). */
type RejectMessage = string;

/** Map the route's typed error codes → the 05-UI-SPEC friendly résumé messages. */
function uploadErrorMessage(code: string | undefined, ceiling: number): RejectMessage {
  switch (code) {
    case 'unsupported_type':
      return 'That file isn’t a PDF. Please upload your résumé as a PDF.';
    case 'too_large':
      return `That PDF is too large. Try one under ${ceiling} MB.`;
    case 'quota_exceeded':
      return 'You’re out of storage. Remove a photo or your résumé to free up space.';
    default:
      return 'We couldn’t upload your résumé. Please try again.';
  }
}

/**
 * Derive a display filename from a Storage URL (the last path segment, decoded).
 * The stored object is `resumes/{sub}/resume/{nanoid}.pdf`; show the file part.
 * Falls back to a plain label if the URL doesn't parse.
 */
function filenameFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    const last = pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : 'résumé.pdf';
  } catch {
    return 'résumé.pdf';
  }
}

type Status = 'idle' | 'uploading' | 'uploaded' | 'error';

export interface ResumeUploaderProps {
  /** Controlled value: the current Storage URL ('' when empty). Mirrors UrlInput. */
  value: string;
  /** Change handler — receives the new URL string ('' on remove). Mirrors UrlInput. */
  onValueChange: (value: string) => void;
  /** Fired with the Storage URL on a successful upload (alongside onValueChange). */
  onUploaded?: (url: string) => void;
  /** Server-provided field error for `resume_url` (wins over local messaging). */
  error?: string;
  /** Field label. Defaults to "Résumé". */
  label?: string;
}

export function ResumeUploader({
  value,
  onValueChange,
  onUploaded,
  error,
  label = 'Résumé',
}: ResumeUploaderProps) {
  const cfg = UPLOAD_KINDS.resume as FileSlotConfig;
  const ceiling = ceilingMb(cfg);

  const [status, setStatus] = useState<Status>('idle');
  const [rejectMsg, setRejectMsg] = useState<RejectMessage | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ignore a stale upload response if the user re-picked before it resolved.
  const reqId = useRef(0);

  const hasResume = value.trim() !== '';

  // Re-settle the success beat back to a resting state after ~2.2s.
  useEffect(() => {
    if (status !== 'uploaded') return;
    const t = setTimeout(() => setStatus('idle'), SUCCESS_BEAT_MS);
    return () => clearTimeout(t);
  }, [status]);

  const openPicker = useCallback(() => {
    setRejectMsg(null);
    fileInputRef.current?.click();
  }, []);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setRejectMsg(null);

      // Client pre-check: byte ceiling (the route re-enforces server-side at 413).
      if (file.size > cfg.ceiling) {
        setStatus('idle');
        setRejectMsg(`That PDF is too large. Try one under ${ceiling} MB.`);
        return;
      }

      setStatus('uploading');
      const myReq = ++reqId.current;

      try {
        const fd = new FormData();
        fd.append('kind', 'resume');
        fd.append('file', file, file.name || 'resume.pdf');

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

        // Swap the value (the prior PDF is deleted by saveProfileAction's
        // delete-on-replace leg, Plan 04 Task 3 — not here) and fire the beat.
        onValueChange(url);
        onUploaded?.(url);
        setStatus('uploaded');
      } catch {
        if (myReq !== reqId.current) return;
        setStatus('error');
        setRejectMsg('We couldn’t upload your résumé. Please try again.');
      }
    },
    [cfg.ceiling, ceiling, onUploaded, onValueChange],
  );

  const doRemove = useCallback(() => {
    setConfirmRemove(false);
    if (value) onValueChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setStatus('idle');
  }, [onValueChange, value]);

  const busy = status === 'uploading';

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>

      {/* Hidden native file input — labeled by the dropzone button's accessible name. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          // Reset so re-picking the same file re-fires onChange.
          e.target.value = '';
        }}
      />

      {!hasResume ? (
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
              Uploading…
            </span>
          ) : (
            <>
              <Upload aria-hidden="true" className="size-6 text-muted-foreground" />
              <span className="text-base text-foreground">Upload your résumé (PDF)</span>
              <span className="text-[13px] leading-tight text-muted-foreground">
                PDF only, up to {ceiling} MB.
              </span>
            </>
          )}
        </button>
      ) : (
        /* ── Uploaded / has-résumé: a file card with Open ↗ + Replace + Remove. */
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
            <FileText aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-base text-foreground" title={filenameFromUrl(value)}>
              {filenameFromUrl(value)}
            </span>
            <a
              href={value}
              target="_blank"
              rel="noopener"
              aria-label="Open résumé in a new tab"
              className={
                'inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm px-1 text-sm ' +
                'text-muted-foreground underline outline-none transition-colors ' +
                'hover:text-accent ' +
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
              }
            >
              Open <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={openPicker}
              disabled={busy}
              aria-label="Replace résumé"
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
              aria-label="Remove résumé"
              className="w-auto hover:text-destructive"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Remove
            </Button>
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
              Uploading…
            </p>
          ) : null}

          {/* Inline destructive remove-confirm (mirrors item-card.tsx / image-uploader). */}
          {confirmRemove ? (
            <div
              role="alertdialog"
              aria-label="Remove your résumé?"
              className="rounded-md border border-border bg-destructive-bg px-4 py-3 motion-reduce:transition-none"
            >
              <p className="text-sm font-semibold text-foreground">Remove your résumé?</p>
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
          <span>Résumé added — it’s on your page</span>
        </p>
      ) : null}

      {/* Reject / upload-error message (color + glyph + text + a solution path). The
          server fieldError (e.g. a bad-scheme resume_url) wins over local messaging. */}
      {error ? (
        <Alert variant="error" className="motion-reduce:transition-none">
          {error}
        </Alert>
      ) : rejectMsg ? (
        <Alert variant="error" className="motion-reduce:transition-none">
          {rejectMsg}
        </Alert>
      ) : null}
    </div>
  );
}
