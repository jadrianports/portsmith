'use client';

/**
 * LockControl (06-UI-SPEC Surface 4, SAFE-02) — the high-consequence takedown +
 * restore control on a /admin queue row. CHROME layer (Evergreen & Copper,
 * Inter): `globals.css @theme` tokens + lucide glyphs ONLY; NO template
 * `.tmpl-*` tokens (two-layer isolation, SHARED-E).
 *
 * SUSPEND (destructive — requires a focus-trapped confirm, friction sits on the
 * takedown): a `lock` "Suspend portfolio" button opens a confirm dialog
 * (mirrors the Phase-4 unpublish-confirm: `--color-destructive-bg` tint,
 * `role="alertdialog"`, focus trap, Esc cancels, focus returns to the trigger,
 * DEFAULT FOCUS on the safe "Cancel"). The dialog carries the decided consequence
 * copy + an optional "Reason (optional)" input recorded as `locked_reason`. On
 * confirm it calls `lockPortfolio(username, reason)` (the service-role action) —
 * the public page 404s within minutes.
 *
 * RESTORE (lower-consequence): when already locked, a brand "Restore access"
 * button + a LIGHTER inline confirm ("Restore {username}'s access?" → Restore /
 * Cancel) calls `unlockPortfolio(username)`.
 *
 * COLOR-INDEPENDENCE (UI-SPEC a11y, LOAD-BEARING): the locked state carries the
 * `lock` glyph + a "Suspended" sense (here the Restore affordance + the queue
 * card's "Suspended" text tag) — never color alone. Every action is 44px with an
 * explicit aria-label; outcomes announce via the parent's polite live region.
 *
 * Source: the focus-trapped confirm dialog from `editor/publish-toggle.tsx`
 * (UnpublishConfirmDialog); the action-call flow from `eye-toggle.tsx`; the
 * lock/unlock actions from `@/lib/admin/lock-action`.
 */
import { Lock, Unlock } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { lockPortfolio, unlockPortfolio } from '@/lib/admin/lock-action';

const COPY = {
  suspend: 'Suspend portfolio',
  restore: 'Restore access',
  cancel: 'Cancel',
  suspendHeading: 'Suspend this portfolio?',
  reasonLabel: 'Reason (optional)',
} as const;

export interface LockControlProps {
  /** The target portfolio's owner username. */
  username: string;
  /** Whether the target is currently suspended (drives suspend vs restore). */
  locked: boolean;
  /** Announce a polite outcome through the parent's live region. */
  onOutcome: (message: string) => void;
  /** Surface the parent's generic action-error Alert. */
  onError: () => void;
}

type Phase = 'idle' | 'suspending' | 'restoring';

export function LockControl({
  username,
  locked: initialLocked,
  onOutcome,
  onError,
}: LockControlProps) {
  const [locked, setLocked] = useState(initialLocked);
  const [phase, setPhase] = useState<Phase>('idle');
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const busy = phase !== 'idle';

  async function handleSuspend(reason: string) {
    if (busy) return;
    setConfirmSuspend(false);
    setPhase('suspending');
    try {
      const result = await lockPortfolio(username, reason);
      if (result.ok) {
        setLocked(true);
        onOutcome(`${username}’s portfolio is suspended.`);
      } else {
        onError();
      }
    } catch {
      onError();
    } finally {
      setPhase('idle');
    }
  }

  async function handleRestore() {
    if (busy) return;
    setConfirmRestore(false);
    setPhase('restoring');
    try {
      const result = await unlockPortfolio(username);
      if (result.ok) {
        setLocked(false);
        onOutcome(`${username}’s access is restored.`);
      } else {
        onError();
      }
    } catch {
      onError();
    } finally {
      setPhase('idle');
    }
  }

  if (locked) {
    // Restore affordance + the lighter inline confirm.
    return confirmRestore ? (
      <span
        role="alertdialog"
        aria-label={`Restore ${username}’s access?`}
        className="inline-flex flex-wrap items-center gap-2 rounded-md bg-surface-muted px-3 py-2"
      >
        <span className="text-sm font-semibold text-foreground">
          Restore {username}’s access?
        </span>
        <Button
          type="button"
          variant="primary"
          onClick={handleRestore}
          disabled={busy}
          className="w-auto"
        >
          {COPY.restore}
        </Button>
        <Button
          type="button"
          variant="ghost"
          autoFocus
          onClick={() => setConfirmRestore(false)}
          disabled={busy}
          className="w-auto"
        >
          {COPY.cancel}
        </Button>
      </span>
    ) : (
      <button
        type="button"
        onClick={() => setConfirmRestore(true)}
        disabled={busy}
        aria-label={`Restore ${username}’s access`}
        className={
          'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-brand px-3 ' +
          'text-sm font-semibold text-brand outline-none transition-colors ' +
          'hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
          'focus-visible:outline-ring disabled:cursor-not-allowed motion-reduce:transition-none'
        }
      >
        <Unlock aria-hidden="true" className="size-4" />
        {COPY.restore}
      </button>
    );
  }

  // Not locked: the destructive Suspend button + its required confirm dialog.
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmSuspend(true)}
        disabled={busy}
        aria-label={`Suspend ${username}’s portfolio`}
        className={
          'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-destructive px-3 ' +
          'text-sm font-semibold text-destructive outline-none transition-colors ' +
          'hover:bg-destructive-bg focus-visible:outline-2 focus-visible:outline-offset-2 ' +
          'focus-visible:outline-ring disabled:cursor-not-allowed motion-reduce:transition-none'
        }
      >
        <Lock aria-hidden="true" className="size-4" />
        {COPY.suspend}
      </button>

      {confirmSuspend ? (
        <SuspendConfirmDialog
          username={username}
          onCancel={() => setConfirmSuspend(false)}
          onConfirm={handleSuspend}
        />
      ) : null}
    </>
  );
}

/**
 * The suspend confirm dialog (UI-SPEC Surface 4 + a11y: focus-trapped, Esc =
 * the safe Cancel, focus returns to the trigger on close, DEFAULT FOCUS on the
 * safe "Cancel"). Mirrors `publish-toggle.tsx`'s UnpublishConfirmDialog, plus an
 * optional "Reason (optional)" input recorded as `locked_reason`.
 */
function SuspendConfirmDialog({
  username,
  onCancel,
  onConfirm,
}: {
  username: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    triggerRef.current = document.activeElement;
    // Default focus on the SAFE action ("Cancel") — friction sits on the takedown.
    const safe = dialogRef.current?.querySelector<HTMLElement>(
      'button[data-dialog-default-focus]',
    );
    safe?.focus();
    return () => {
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
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
        'button:not([disabled]), a[href], input, textarea, [tabindex]:not([tabindex="-1"])',
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
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/40 transition-opacity duration-100 motion-reduce:transition-none"
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="suspend-dialog-heading"
        aria-describedby="suspend-dialog-body"
        onKeyDown={onKeyDown}
        className={
          'relative z-10 w-full max-w-md rounded-lg border border-border bg-destructive-bg p-6 shadow-card ' +
          'transition-[opacity,transform] duration-150 motion-reduce:transition-none'
        }
      >
        <h2
          id="suspend-dialog-heading"
          className="text-base font-semibold text-foreground"
        >
          {COPY.suspendHeading}
        </h2>
        <p id="suspend-dialog-body" className="mt-2 text-sm text-muted-foreground">
          This takes {username}’s page offline immediately — visitors will see a 404
          — and signs the owner out. Use this for abuse or policy violations. You can
          restore access later.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-[13px] font-semibold text-foreground">
            {COPY.reasonLabel}
          </span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={
              'w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground ' +
              'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
            }
          />
        </label>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          {/* Cancel — the safe default-focus action. */}
          <Button
            data-dialog-default-focus
            variant="primary"
            onClick={onCancel}
            className="sm:w-auto"
          >
            {COPY.cancel}
          </Button>
          {/* Suspend portfolio — the destructive proceed action. */}
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            className={
              'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-destructive px-4 ' +
              'text-sm font-semibold text-destructive outline-none transition-colors ' +
              'hover:bg-destructive-bg active:translate-y-px motion-reduce:active:translate-y-0 motion-reduce:transition-none ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto'
            }
          >
            <Lock aria-hidden="true" className="size-4" />
            {COPY.suspend}
          </button>
        </div>
      </div>
    </div>
  );
}
