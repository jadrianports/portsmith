'use client';

/**
 * SharePanel (DIST-01 + DIST-02 UI half / D-05) — the ONE unified Share surface,
 * opened from a Share control in the editor header. Three coherent blocks in a single
 * disclosure popover (the "here's my page" mental bucket):
 *
 *   1. LIVE PUBLIC URL — a selectable, host-independent readback (`siteUrl('/' +
 *      username)`, D-06) + Copy (with the Check/Copy confirm-state) + a feature-
 *      detected native Share. Mirrors `payoff-step.tsx` VERBATIM (the proven
 *      copy-link idiom): the URL ORIGIN is `NEXT_PUBLIC_SITE_URL`, NEVER the request
 *      Host, so the displayed/copied/QR'd URL can't be poisoned by a forged Host.
 *   2. DOWNLOADABLE QR — the server-generated SVG string (rendered by `src/lib/qr.ts`
 *      in the RSC boundary, threaded down as the `qrSvg` prop). This panel NEVER
 *      imports `qrcode` (zero QR lib on the dashboard client bundle, D-06); it renders
 *      the static SVG markup and offers a Download via a client Blob → object URL.
 *   3. DRAFT-SHARE LINK — generate / copy / revoke, wired to Plan 02's SHARED-A owner
 *      actions (`generateDraftShare` / `revokeDraftShare`). The panel holds the live
 *      `{ url, expiresAt }` from the action return (no server pre-read on mount — the
 *      single rotating link is materialized on demand, D-03).
 *
 * TWO-LAYER IDENTITY (SHARED-E): chrome single-layer ONLY (Evergreen/Copper, Inter) —
 * NO `templates/*` import, NO template token. The copper accent is confined to
 * focus/active/link-hover (NEVER a fill), per the accent-scarcity rule.
 *
 * NOT a Modal (no Modal primitive exists — the payoff-step note): a disclosure
 * popover built from chrome primitives, with Escape-to-close, a focus trap, an
 * outside-click close, and `aria-expanded`/`aria-controls` on the trigger.
 */
import {
  Check,
  Copy,
  Download,
  QrCode,
  RotateCw,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  generateDraftShare,
  revokeDraftShare,
} from '@/lib/cms/draft-share-action';
import { siteUrl } from '@/lib/url';

/** Copy (chrome-only; curly apostrophes match the payoff-step grain). */
const COPY = {
  trigger: 'Share',
  title: 'Share your page',
  close: 'Close',
  publicHeading: 'Your public page',
  copy: 'Copy link',
  copied: 'Link copied',
  share: 'Share',
  shareTitle: 'My portfolio',
  copyFallback: 'Copy the link above to share your page.',
  qrHeading: 'QR code',
  qrHint: 'Download a QR code that links to your public page — for a slide, card, or print.',
  qrDownload: 'Download QR',
  draftHeading: 'Private draft link',
  draftHint:
    'Generate a private link so someone can preview your unpublished draft. It expires in 7 days; revoke it anytime.',
  draftGenerate: 'Generate draft link',
  draftRegenerate: 'Regenerate',
  draftRevoke: 'Revoke',
  draftCopied: 'Draft link copied',
  draftWorking: 'Working…',
} as const;

export interface SharePanelProps {
  /** The owner's username — the public URL + QR target are `siteUrl('/' + username)`. */
  username: string;
  /**
   * The server-generated QR SVG document string (from `src/lib/qr.ts`, rendered in
   * the dashboard RSC and threaded through EditorShell). A STATIC markup string —
   * this client panel never imports `qrcode` (D-06 bundle invariant).
   */
  qrSvg: string;
}

/** The draft-share link state the panel surfaces (materialized on demand, D-03). */
interface DraftLinkState {
  url: string;
  expiresAt: string;
}

/** Format the 7-day expiry as a friendly absolute date (locale, date-only). */
function formatExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function SharePanel({ username, qrSvg }: SharePanelProps) {
  // The host-independent public URL (D-06) — NEVER the request Host.
  const liveUrl = siteUrl('/' + username);
  // The protocol-stripped readback (host + path is what the user reads).
  const liveUrlDisplay = liveUrl.replace(/^https?:\/\//, '');

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [draftCopied, setDraftCopied] = useState(false);
  // navigator.share is detected on the MOUNTED client (undefined during SSR); the
  // Share button renders only when present (mounts false, flips true post-hydration).
  const [canShare, setCanShare] = useState(false);

  // The draft-share link state + its in-flight transitions (gen/revoke).
  const [draftLink, setDraftLink] = useState<DraftLinkState | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // Re-settle the copy confirmations back after ~2.2s (the chrome saved-beat grain).
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);
  useEffect(() => {
    if (!draftCopied) return;
    const t = setTimeout(() => setDraftCopied(false), 2200);
    return () => clearTimeout(t);
  }, [draftCopied]);

  // Focus the Close button when the panel opens (focus-trap entry point).
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Escape-to-close + outside-click-to-close while open. On close, restore focus to
  // the trigger (the disclosure-popover a11y contract).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  /** Copy the live public URL → the confirmed "Link copied" state (announced). */
  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        setCopyFailed(true);
        return;
      }
      await navigator.clipboard.writeText(liveUrl);
      setCopyFailed(false);
      setCopied(true);
    } catch {
      setCopyFailed(true);
    }
  }, [liveUrl]);

  /** Native Web Share (supported devices only) — the public URL, no social SDK. */
  const handleShare = useCallback(async () => {
    try {
      await navigator.share({ title: COPY.shareTitle, url: liveUrl });
    } catch {
      // The user cancelled the share sheet, or it failed — a no-op (never an error UI).
    }
  }, [liveUrl]);

  /** Copy the draft-share link to the clipboard (its own confirm-state). */
  const handleCopyDraft = useCallback(async () => {
    if (!draftLink) return;
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) return;
      await navigator.clipboard.writeText(draftLink.url);
      setDraftCopied(true);
    } catch {
      // A blocked clipboard write — the selectable field above is the fallback.
    }
  }, [draftLink]);

  /**
   * Download the server-generated QR SVG as a file via a client Blob → object URL →
   * a synthetic `<a download>` click. The SVG is static markup passed as a prop — no
   * QR library runs on the client (D-06). Revoke the object URL after the click.
   */
  const handleDownloadQr = useCallback(() => {
    try {
      const blob = new Blob([qrSvg], { type: 'image/svg+xml' });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${username || 'portfolio'}-qr.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // A blocked download (rare) — the QR is still visible on screen to scan/photo.
    }
  }, [qrSvg, username]);

  /** Generate (or rotate) the private draft-share link via the SHARED-A owner action. */
  const handleGenerateDraft = useCallback(() => {
    setDraftError(null);
    startTransition(async () => {
      const result = await generateDraftShare();
      if (result.ok) {
        setDraftLink({ url: result.url, expiresAt: result.expiresAt });
      } else {
        setDraftError(result.error ?? 'Something went wrong. Please try again.');
      }
    });
  }, []);

  /** Revoke the active draft-share link instantly via the SHARED-A owner action. */
  const handleRevokeDraft = useCallback(() => {
    setDraftError(null);
    startTransition(async () => {
      const result = await revokeDraftShare();
      if (result.ok) {
        setDraftLink(null);
        setDraftCopied(false);
      } else {
        setDraftError(result.error ?? 'Something went wrong. Please try again.');
      }
    });
  }, []);

  return (
    <div className="relative">
      {/* The Share trigger — the chrome header-control idiom (border, hover:text-accent,
          focus-ring), matching its Messages/Settings/Preview siblings. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        className={
          'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-4 ' +
          'text-sm font-semibold text-foreground outline-none transition-colors ' +
          'hover:border-border-strong hover:text-accent ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
          'motion-reduce:transition-none'
        }
      >
        <Share2 aria-hidden="true" className="size-3.5" />
        <span>{COPY.trigger}</span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-label={COPY.title}
          className={
            'absolute right-0 top-full z-50 mt-2 flex w-[min(92vw,22rem)] flex-col gap-5 ' +
            'rounded-md border border-border bg-surface p-4 shadow-[var(--shadow-card)]'
          }
        >
          {/* Header row: title + Close (the focus-trap entry point). */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold leading-tight text-foreground">
              {COPY.title}
            </h2>
            <button
              ref={closeRef}
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label={COPY.close}
              className={
                'inline-flex min-h-11 items-center justify-center rounded-md px-2 ' +
                'text-muted-foreground outline-none transition-colors hover:text-accent ' +
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
                'motion-reduce:transition-none'
              }
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>

          {/* ── Block 1: the live public URL + copy + native share ──────────────── */}
          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold leading-tight text-foreground">
              {COPY.publicHeading}
            </h3>
            <p className="select-all break-all rounded-sm bg-surface-muted px-3 py-2 text-sm leading-normal text-foreground">
              {liveUrlDisplay}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={handleCopy}
                className="w-auto"
                aria-label={copied ? COPY.copied : COPY.copy}
              >
                {copied ? (
                  <>
                    <Check aria-hidden="true" className="size-4" />
                    <span>{COPY.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy aria-hidden="true" className="size-4" />
                    <span>{COPY.copy}</span>
                  </>
                )}
              </Button>
              {canShare ? (
                <Button variant="ghost" onClick={handleShare} className="w-auto">
                  <Share2 aria-hidden="true" className="size-4" />
                  <span>{COPY.share}</span>
                </Button>
              ) : null}
            </div>
            {/* Polite announcement of the copy confirmation (word, not color alone). */}
            <span aria-live="polite" className="sr-only">
              {copied ? COPY.copied : ''}
            </span>
            {copyFailed ? (
              <p className="text-[13px] leading-tight text-muted-foreground">
                {COPY.copyFallback}
              </p>
            ) : null}
          </section>

          {/* ── Block 2: the downloadable server-SVG QR ─────────────────────────── */}
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight text-foreground">
              <QrCode aria-hidden="true" className="size-4" />
              {COPY.qrHeading}
            </h3>
            <p className="text-[13px] leading-tight text-muted-foreground">{COPY.qrHint}</p>
            {/* The static server-generated SVG (D-06) — rendered as markup, never via a
                client QR lib. White plate so a dark-mode chrome surface keeps it scannable. */}
            <div
              className="mx-auto w-40 max-w-full rounded-sm bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
              // eslint-disable-line react/no-danger — qrSvg is server-generated static
              // markup from src/lib/qr.ts (no user content); the sanctioned static-SVG path.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              role="img"
              aria-label={`QR code for ${liveUrlDisplay}`}
            />
            <div className="flex">
              <Button variant="ghost" onClick={handleDownloadQr} className="w-auto">
                <Download aria-hidden="true" className="size-4" />
                <span>{COPY.qrDownload}</span>
              </Button>
            </div>
          </section>

          {/* ── Block 3: the private draft-share link (gen / copy / revoke) ─────── */}
          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold leading-tight text-foreground">
              {COPY.draftHeading}
            </h3>
            <p className="text-[13px] leading-tight text-muted-foreground">{COPY.draftHint}</p>

            {draftLink ? (
              <>
                <p className="select-all break-all rounded-sm bg-surface-muted px-3 py-2 text-sm leading-normal text-foreground">
                  {draftLink.url}
                </p>
                <p className="text-[13px] leading-tight text-muted-foreground">
                  Expires {formatExpiry(draftLink.expiresAt)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    onClick={handleCopyDraft}
                    className="w-auto"
                    aria-label={draftCopied ? COPY.draftCopied : COPY.copy}
                  >
                    {draftCopied ? (
                      <>
                        <Check aria-hidden="true" className="size-4" />
                        <span>{COPY.draftCopied}</span>
                      </>
                    ) : (
                      <>
                        <Copy aria-hidden="true" className="size-4" />
                        <span>{COPY.copy}</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleGenerateDraft}
                    disabled={pending}
                    className="w-auto"
                  >
                    <RotateCw aria-hidden="true" className="size-4" />
                    <span>{pending ? COPY.draftWorking : COPY.draftRegenerate}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleRevokeDraft}
                    disabled={pending}
                    className="w-auto"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    <span>{pending ? COPY.draftWorking : COPY.draftRevoke}</span>
                  </Button>
                </div>
                <span aria-live="polite" className="sr-only">
                  {draftCopied ? COPY.draftCopied : ''}
                </span>
              </>
            ) : (
              <div className="flex">
                <Button
                  variant="ghost"
                  onClick={handleGenerateDraft}
                  disabled={pending}
                  className="w-auto"
                >
                  <Share2 aria-hidden="true" className="size-4" />
                  <span>{pending ? COPY.draftWorking : COPY.draftGenerate}</span>
                </Button>
              </div>
            )}

            {draftError ? (
              <p role="alert" className="text-[13px] leading-tight text-muted-foreground">
                {draftError}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
