'use client';

/**
 * PublishToggle (04-UI-SPEC §12, PUB-01 / PUB-02 / D-P4-02) — the publish moment.
 *
 * The header-bar primary control plus the ● Live / Draft status pairing — the
 * highest-stakes, calmest control in the app. It wires the owner's publish/
 * unpublish to `setPublished` (04-06) and reflects the result with the deliberate
 * "publish beat" / the calm "unpublish flip".
 *
 * THE CONFIRM ASYMMETRY (UI-SPEC §12 + Copywriting note, load-bearing):
 *   - Publish (Draft → Live): a brand-fill primary button, NO confirm — publishing
 *     is safe, reversible, and the whole goal. One click → setPublished(true).
 *   - Unpublish (Live → Draft): a GHOST button (NOT brand — it is a step-down that
 *     404s the public page) that REQUIRES a focus-trapped confirm dialog. The safe
 *     default-focus action is "Keep it live"; Esc cancels to it; only "Unpublish"
 *     (destructive) proceeds → setPublished(false).
 *
 * THE STATUS PILL (left of the control, color-independent — glyph + text + color):
 *   - Live:  a filled `--color-accent` ● dot (the scarce copper; the dot/glyph
 *            carries the accent, the WORDS use `--color-success` for AA small text)
 *            + a "Live" caption + a "View live ↗" link to siteUrl('/' + username).
 *   - Draft: a hollow `--color-border-strong` dot + a "Draft" caption in
 *            `--color-warning`.
 *
 * HOST-INDEPENDENT LIVE URL (PUB-03 / T-04-06c): the success copy + the "View live"
 * link derive their origin from `siteUrl()` (NEXT_PUBLIC_SITE_URL), NEVER a
 * hardcoded free-tier host literal and NEVER the request host — so the later
 * free-tier-host → real-domain switch is an env change only.
 *
 * MOTION (UI-SPEC Motion): the publish beat (hollow dot fills to ● Live with a
 * single soft pulse, the "View live ↗" fades in, the confirmation line rises) and
 * the calm unpublish flip (accent dot fades to hollow, a quiet warning caption) are
 * the only animations here. Under `prefers-reduced-motion: reduce` every transform/
 * pulse is dropped via `motion-reduce:` variants — state, color, and copy still
 * change (the information is identical; only the animation is removed).
 *
 * TWO-LAYER IDENTITY (SHARED-E): chrome tokens ONLY (Evergreen/Copper). No template
 * token is ever reached; no inline hex. Every focusable control carries the chrome
 * focus ring + a ≥44px touch target via the Button primitive / `min-h-11`.
 *
 * Source: composes `src/components/ui/button.tsx` (primary/ghost) + the
 * `src/components/ui/alert.tsx` error variant; the client-island-calls-action flow
 * mirrors `src/components/editor/section-form.tsx`; the live URL via
 * `src/lib/url.ts` `siteUrl()`; copy verbatim from 04-UI-SPEC §12 Copywriting.
 */
import { ExternalLink, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { setPublished } from '@/lib/cms/publish-action';
import { siteUrl } from '@/lib/url';

/** Copy (UI-SPEC §12 Copywriting — load-bearing). */
const COPY = {
  publish: 'Publish',
  publishing: 'Publishing…',
  unpublish: 'Unpublish',
  unpublishing: 'Unpublishing…',
  viewLive: 'View live ↗',
  live: 'Live',
  draft: 'Draft',
  error: 'We couldn’t update your page. Please try again.',
  nowPrivate: 'Your page is now private — visitors see a 404.',
  // Dialog (UI-SPEC §12 Destructive/confirm).
  dialogHeading: 'Unpublish your page?',
  dialogBody:
    'Your portfolio will go offline and visitors will see a 404. You can publish again any time.',
  dialogConfirm: 'Unpublish',
  dialogCancel: 'Keep it live', // safe default-focus action
} as const;

export interface PublishToggleProps {
  /** The owner's username — used for the live URL + the "View live ↗" link. */
  username: string;
  /** Whether the portfolio is currently published (the server-truth initial state). */
  initialPublished: boolean;
}

type Phase = 'idle' | 'publishing' | 'unpublishing';

export function PublishToggle({ username, initialPublished }: PublishToggleProps) {
  const [published, setPublishedState] = useState(initialPublished);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  // The post-publish confirmation line ("…live at {url}") / the calm
  // unpublish confirmation ("…now private"). Cleared on the next action.
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const busy = phase !== 'idle';
  const liveUrl = siteUrl('/' + username);
  // Display the URL without the protocol noise — host + path is what the user reads.
  const liveUrlDisplay = liveUrl.replace(/^https?:\/\//, '');

  /** Publish (Draft → Live) — frictionless, no confirm. The publish beat. */
  async function handlePublish() {
    if (busy) return;
    setError(null);
    setNotice(null);
    setPhase('publishing');
    try {
      const result = await setPublished(true);
      if (result.ok) {
        setPublishedState(true);
        setNotice(`Your portfolio is live at ${liveUrlDisplay}`);
      } else {
        setError(result.error ?? COPY.error);
      }
    } catch {
      setError(COPY.error);
    } finally {
      setPhase('idle');
    }
  }

  /** Unpublish (Live → Draft) — only after the confirm. The calm flip. */
  async function handleUnpublish() {
    if (busy) return;
    setConfirmOpen(false);
    setError(null);
    setNotice(null);
    setPhase('unpublishing');
    try {
      const result = await setPublished(false);
      if (result.ok) {
        setPublishedState(false);
        setNotice(COPY.nowPrivate);
      } else {
        setError(result.error ?? COPY.error);
      }
    } catch {
      setError(COPY.error);
    } finally {
      setPhase('idle');
    }
  }

  // The notice is success/warning depending on which way we flipped.
  const noticeIsPrivate = notice === COPY.nowPrivate;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status pill (left): glyph + text + color (color-independence). */}
        <StatusPill published={published} username={username} liveUrl={liveUrl} />

        {/* Control (right): Publish (no confirm) when Draft; Unpublish (confirm) when Live. */}
        <div className="flex items-center">
          {published ? (
            <Button
              variant="ghost"
              loading={phase === 'unpublishing'}
              disabled={busy}
              onClick={() => setConfirmOpen(true)}
              className="w-auto"
            >
              {phase === 'unpublishing' ? (
                <>
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin motion-reduce:animate-none"
                  />
                  <span>{COPY.unpublishing}</span>
                </>
              ) : (
                COPY.unpublish
              )}
            </Button>
          ) : (
            <Button
              variant="primary"
              loading={phase === 'publishing'}
              disabled={busy}
              onClick={handlePublish}
              className="w-auto"
            >
              {phase === 'publishing' ? (
                <>
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin motion-reduce:animate-none"
                  />
                  <span>{COPY.publishing}</span>
                </>
              ) : (
                COPY.publish
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Error → the UI-SPEC Alert. */}
      {error ? <Alert variant="error">{error}</Alert> : null}

      {/* Confirmation line: the publish beat ("…live at {url}", success) or the
          calm unpublish caption ("…now private", warning). Announced politely. */}
      {notice ? (
        <p
          aria-live="polite"
          className={
            'text-[13px] leading-tight transition-opacity duration-200 motion-reduce:transition-none ' +
            (noticeIsPrivate ? 'text-warning' : 'text-success')
          }
        >
          {notice}
        </p>
      ) : null}

      {confirmOpen ? (
        <UnpublishConfirmDialog
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleUnpublish}
        />
      ) : null}
    </div>
  );
}

/** The ● Live / Draft status pill — glyph + text + color (color-independence). */
function StatusPill({
  published,
  username,
  liveUrl,
}: {
  published: boolean;
  username: string;
  liveUrl: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* The dot carries the accent (Live) / the strong border (Draft); the
          accompanying WORD carries the AA-compliant small-text color. */}
      <span
        aria-hidden="true"
        className={
          'inline-block size-2.5 rounded-full transition-[background-color,box-shadow] duration-300 motion-reduce:transition-none ' +
          (published
            ? 'bg-accent motion-safe:animate-pulse'
            : 'border border-border-strong bg-transparent')
        }
      />
      <span
        className={
          'text-[13px] font-medium leading-tight ' +
          (published ? 'text-success' : 'text-warning')
        }
      >
        {published ? COPY.live : COPY.draft}
      </span>
      {published ? (
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={
            'inline-flex items-center gap-1 text-[13px] leading-tight text-foreground underline-offset-2 outline-none ' +
            'transition-opacity duration-200 hover:text-accent hover:underline motion-reduce:transition-none ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
          }
        >
          <span>{COPY.viewLive}</span>
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only"> (opens {username}’s public page in a new tab)</span>
        </a>
      ) : null}
    </div>
  );
}

/**
 * The unpublish confirm dialog (UI-SPEC §12 + a11y: focus-trapped, Esc = the safe
 * "Keep it live" action, focus returns to the trigger on close, default focus on
 * the safe action).
 */
function UnpublishConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Remember the trigger so focus can return to it on close.
  useEffect(() => {
    triggerRef.current = document.activeElement;
    // Default focus on the SAFE action ("Keep it live" — the first focusable in the
    // reversed action row) — UI-SPEC a11y. The Button primitive is presentational
    // (no ref forwarding), so reach it through the dialog container.
    const safe = dialogRef.current?.querySelector<HTMLElement>(
      'button[data-dialog-default-focus]',
    );
    safe?.focus();
    return () => {
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, []);

  // Focus trap + Esc = cancel-to-safe.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onCancel],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      // The backdrop click cancels to the safe action.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* Backdrop. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/40 transition-opacity duration-100 motion-reduce:transition-none"
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unpublish-dialog-heading"
        aria-describedby="unpublish-dialog-body"
        onKeyDown={onKeyDown}
        className={
          'relative z-10 w-full max-w-sm rounded-md border border-border bg-surface p-5 shadow-card ' +
          'transition-[opacity,transform] duration-150 motion-reduce:transition-none'
        }
      >
        <h2
          id="unpublish-dialog-heading"
          className="text-base font-semibold text-foreground"
        >
          {COPY.dialogHeading}
        </h2>
        <p id="unpublish-dialog-body" className="mt-2 text-sm text-muted-foreground">
          {COPY.dialogBody}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          {/* Keep it live — the safe default-focus action. */}
          <Button
            data-dialog-default-focus
            variant="primary"
            onClick={onCancel}
            className="sm:w-auto"
          >
            {COPY.dialogCancel}
          </Button>
          {/* Unpublish — the destructive proceed action. */}
          <button
            type="button"
            onClick={onConfirm}
            className={
              'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-destructive px-4 ' +
              'text-sm font-semibold text-destructive outline-none transition-colors ' +
              'hover:bg-destructive-bg active:translate-y-px motion-reduce:active:translate-y-0 motion-reduce:transition-none ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto'
            }
          >
            {COPY.dialogConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
