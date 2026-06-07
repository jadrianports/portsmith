'use client';

/**
 * RemoveSectionConfirm (13.1-06 / UI-SPEC §8 / D-03 / D-05) — the uniform
 * destructive confirm guarding the rail-row "Remove section" affordance.
 *
 * It is UNIFORM across ALL section types including the original 7 (no
 * bootstrap-vs-added distinction — D-03; the schema has no such flag and the
 * templates null-guard a missing type, so a removed `hero` simply stops
 * rendering). Friction sits on the destructive direction only; default focus is
 * on the SAFE "Keep" action (the inline remove-ITEM confirm precedent,
 * `item-card.tsx:656-693` — `autoFocus` on Keep).
 *
 * Confirming fires `removeSectionAction(sectionId)` (SHARED-A: authenticated RLS
 * DELETE — NEVER service-role — + the D-05 server-recompute media free). While
 * in-flight it shows "Removing…" + `aria-busy`; on `{ ok:true }` it closes and
 * calls `onRemoved`; on `{ ok:false }` it surfaces a generic destructive Alert
 * and stays open. The action returns the discriminated union and never throws.
 *
 * Surface = a small focus-trapped centered dialog (the rail is narrow), reusing
 * the `unsaved-guard.tsx` focus-trap/Esc/focus-return idiom + the `item-card.tsx`
 * destructive tone (`role="alertdialog"`, `--color-destructive-bg` tint).
 *
 * TWO-LAYER ISOLATION (CLAUDE.md): PLATFORM CHROME only — Evergreen & Copper
 * `--color-*` tokens + `--font-sans` (Inter). No `.tmpl-*` reach, no inline hex.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { removeSectionAction } from '@/lib/cms/remove-section-action';

/** Copy (UI-SPEC §8 / Copywriting Contract — LOCKED). */
const COPY = {
  heading: 'Remove this section?',
  body: (sectionTitle: string) =>
    `This deletes the ${sectionTitle} section and its content from your portfolio. Any images it uses are freed from your storage. This can’t be undone.`,
  remove: 'Remove section',
  removing: 'Removing…',
  keep: 'Keep',
  error: 'We couldn’t remove that section. Please try again.',
} as const;

export interface RemoveSectionConfirmProps {
  /** The id of the section to delete (RLS + .eq scope the DELETE to the owner). */
  sectionId: string;
  /** The friendly section title woven into the body ("the {title} section"). */
  sectionTitle: string;
  /** The owner's username, passed straight to `removeSectionAction` for the revalidate. */
  username?: string;
  /** Cancel without removing (Keep / Esc / backdrop). */
  onClose: () => void;
  /** Fired after a successful remove so the shell can drop the row + clear selection. */
  onRemoved: (sectionId: string) => void;
}

/**
 * The uniform remove-section confirm dialog. Mount it only while open; it returns
 * focus to the trigger (the rail row's trash button) on unmount.
 */
export function RemoveSectionConfirm({
  sectionId,
  sectionTitle,
  username,
  onClose,
  onRemoved,
}: RemoveSectionConfirmProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remember the trigger; default focus on the SAFE "Keep" action; return focus
  // to the trigger on close (the unsaved-guard a11y idiom).
  useEffect(() => {
    triggerRef.current = document.activeElement;
    const safe = dialogRef.current?.querySelector<HTMLElement>(
      'button[data-dialog-default-focus]',
    );
    safe?.focus();
    return () => {
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, []);

  // Focus trap + Esc = Keep (the safe cancel). No-op while a remove is in-flight.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!removing) onClose();
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
    [onClose, removing],
  );

  async function handleRemove() {
    if (removing) return;
    setError(null);
    setRemoving(true);
    const result = await removeSectionAction(sectionId, username);
    if (result.ok) {
      onRemoved(sectionId);
      return;
    }
    // {ok:false} — keep the dialog open + surface the generic destructive Alert.
    setRemoving(false);
    setError(COPY.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !removing) onClose();
      }}
    >
      {/* Backdrop scrim. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/40 transition-opacity duration-100 motion-reduce:transition-none"
      />

      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-section-heading"
        aria-describedby="remove-section-body"
        onKeyDown={onKeyDown}
        style={{ fontFamily: 'var(--font-sans)' }}
        className={
          'font-sans relative z-10 w-full max-w-md rounded-lg border border-destructive/40 ' +
          'bg-destructive-bg p-5 shadow-card ' +
          'transition-[opacity,transform] duration-150 motion-reduce:transition-none'
        }
      >
        <h2
          id="remove-section-heading"
          className="text-base font-semibold text-foreground"
        >
          {COPY.heading}
        </h2>
        <p id="remove-section-body" className="mt-2 text-sm text-muted-foreground">
          {COPY.body(sectionTitle)}
        </p>

        {/* The generic failure Alert (kept inside the dialog, dialog stays open). */}
        {error ? (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-md bg-surface p-3 text-sm text-destructive"
          >
            <span>{error}</span>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          {/* Keep — the safe default-focus action. */}
          <button
            type="button"
            data-dialog-default-focus
            onClick={() => {
              if (!removing) onClose();
            }}
            disabled={removing}
            className={
              'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md ' +
              'border border-border bg-surface px-4 text-sm font-semibold text-foreground outline-none ' +
              'transition-colors hover:bg-surface-muted ' +
              'active:translate-y-px motion-reduce:active:translate-y-0 motion-reduce:transition-none ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
              'disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto'
            }
          >
            {COPY.keep}
          </button>

          {/* Remove section — the destructive proceed. */}
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            aria-busy={removing || undefined}
            className={
              'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md ' +
              'bg-destructive px-4 text-sm font-semibold text-brand-foreground outline-none ' +
              'transition-colors hover:bg-destructive ' +
              'active:translate-y-px motion-reduce:active:translate-y-0 motion-reduce:transition-none ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
              'disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto'
            }
          >
            {removing ? COPY.removing : COPY.remove}
          </button>
        </div>
      </div>
    </div>
  );
}
