'use client';

/**
 * UnsavedChangesGuard + useGuardedNavigate (04-UI-SPEC §14, CMS-07) — the
 * dual-path dirty-state guard that protects unsaved editor edits.
 *
 * App Router has NO navigation-blocking API — the old Pages-Router router-events
 * hook does NOT exist here (RESEARCH Pitfall 5). The working composite is
 * therefore two paths:
 *
 *   PATH 1 — IN-APP NAVIGATION (intercept at the click source):
 *     `useGuardedNavigate()` returns a `navigate(proceed)` function the editor
 *     calls at every in-app navigation source (selecting another section, the
 *     "back to sections" control, any in-app link). If the Zustand `dirty` flag is
 *     false it runs `proceed()` immediately; if dirty it instead opens a
 *     focus-trapped "You have unsaved changes" dialog offering Save and continue /
 *     Discard changes / Keep editing, and only runs `proceed()` after the user
 *     confirms (Discard) or saves (Save and continue). "Keep editing" is the
 *     default focus; Esc cancels to stay. There is no router-level block — the
 *     navigation simply doesn't happen until the user resolves the dialog.
 *
 *   PATH 2 — TAB CLOSE / REFRESH / HARD NAV (`beforeunload` fallback):
 *     while `dirty` is true a `beforeunload` listener is armed
 *     (`e.preventDefault(); e.returnValue = ''`) so the browser shows its generic
 *     "leave site?" prompt for the cases the in-app dialog can't intercept; the
 *     listener is REMOVED the moment the panel is clean. It fires ONLY when
 *     genuinely dirty (reassuring, not nagging).
 *
 * State source: the guard reads the EPHEMERAL Zustand `dirty` flag (UI-only state,
 * correctly NOT server data — CLAUDE.md non-overlap). The pending in-app proceed
 * callback is held in a module-scoped store so any guarded navigation source can
 * trigger the single shared dialog rendered by `<UnsavedChangesGuard />`.
 *
 * Token-driven chrome only (SHARED-E): the dialog is focus-trapped, Esc = Keep
 * editing (the safe default), focus returns to the trigger on close, and every
 * control carries the chrome focus ring. Zero inline hex, zero template-token reach.
 */
import { create } from 'zustand';
import { useCallback, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { useUIStore } from '@/lib/stores/uiStore';

/** Copy (04-UI-SPEC §14 Copywriting / Destructive-confirm — load-bearing). */
const COPY = {
  heading: 'You have unsaved changes',
  body: (section: string) =>
    `Your latest edits to ${section} haven't been saved. They won't appear on your page until you save.`,
  bodyGeneric:
    "Your latest edits haven't been saved. They won't appear on your page until you save.",
  saveAndContinue: 'Save and continue',
  discard: 'Discard changes',
  keepEditing: 'Keep editing', // the safe default-focus action
} as const;

/**
 * The pending in-app navigation, surfaced to the single shared dialog. UI-only
 * (it holds a callback to run once the user resolves the dirty prompt) — never
 * server data. `proceed` runs the intercepted navigation; `clear` dismisses.
 */
interface GuardState {
  /** The intercepted navigation to run on confirm/discard, or null when closed. */
  pending: (() => void) | null;
  /** Open the dialog with a navigation to run once resolved. */
  request: (proceed: () => void) => void;
  /** Close the dialog without navigating (Keep editing / Esc / backdrop). */
  clear: () => void;
}

const useGuardState = create<GuardState>((set) => ({
  pending: null,
  request: (proceed) => set({ pending: proceed }),
  clear: () => set({ pending: null }),
}));

/**
 * Returns a `navigate(proceed)` function for in-app navigation SOURCES. When the
 * panel is clean it runs `proceed()` immediately; when dirty it routes through the
 * shared "unsaved changes" dialog (Path 1). Read `dirty` live from the store on
 * each call so the guard reflects the CURRENT edit state.
 */
export function useGuardedNavigate(): (proceed: () => void) => void {
  const request = useGuardState((s) => s.request);
  return useCallback(
    (proceed: () => void) => {
      // Read the dirty flag live (not via a render-time subscription) so the latest
      // value gates the navigation at click time.
      const dirty = useUIStore.getState().dirty;
      if (!dirty) {
        proceed();
        return;
      }
      request(proceed);
    },
    [request],
  );
}

export interface UnsavedChangesGuardProps {
  /** The active section's label, woven into the dialog body ("edits to {section}"). */
  sectionLabel?: string;
  /**
   * Optional Save handler for "Save and continue" — runs the save, then proceeds.
   * When omitted, "Save and continue" falls back to proceeding without saving (the
   * SectionForm's own Save remains the canonical content write); the option is kept
   * so the dialog copy/affordance matches the UI-SPEC.
   */
  onSave?: () => Promise<void> | void;
}

/**
 * Mounts the `beforeunload` fallback (Path 2) and renders the single shared in-app
 * "unsaved changes" dialog (Path 1). Mount ONCE near the editor root.
 */
export function UnsavedChangesGuard({ sectionLabel, onSave }: UnsavedChangesGuardProps) {
  const dirty = useUIStore((s) => s.dirty);
  const setDirty = useUIStore((s) => s.setDirty);
  const pending = useGuardState((s) => s.pending);
  const clear = useGuardState((s) => s.clear);

  // ── Path 2: arm beforeunload WHILE dirty; remove it when clean. ──
  useEffect(() => {
    if (!dirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      // The modern + legacy incantation: preventDefault + a non-undefined
      // returnValue makes the browser show its generic leave-site prompt. Custom
      // text is ignored by every modern browser — that is expected.
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  // ── Path 1: the in-app dialog (only rendered when a guarded nav is pending). ──
  if (!pending) return null;

  function runPending() {
    const proceed = pending;
    clear();
    proceed?.();
  }

  async function handleSaveAndContinue() {
    if (onSave) {
      await onSave();
    }
    // The SectionForm clears `dirty` on a resolved save; proceed regardless so the
    // navigation isn't trapped if the save path is owned by the form island.
    runPending();
  }

  function handleDiscard() {
    // Discarding abandons the edits — the panel is no longer dirty.
    setDirty(false);
    runPending();
  }

  return (
    <DirtyDialog
      sectionLabel={sectionLabel}
      onSaveAndContinue={handleSaveAndContinue}
      onDiscard={handleDiscard}
      onKeepEditing={clear}
    />
  );
}

/**
 * The focus-trapped "unsaved changes" dialog (a11y: Esc = Keep editing, focus
 * returns to the trigger on close, default focus on the safe "Keep editing").
 */
function DirtyDialog({
  sectionLabel,
  onSaveAndContinue,
  onDiscard,
  onKeepEditing,
}: {
  sectionLabel?: string;
  onSaveAndContinue: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Remember the trigger; default focus on the SAFE action ("Keep editing").
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

  // Focus trap + Esc = Keep editing (the safe cancel).
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onKeepEditing();
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
    [onKeepEditing],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onKeepEditing();
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
        aria-labelledby="unsaved-dialog-heading"
        aria-describedby="unsaved-dialog-body"
        onKeyDown={onKeyDown}
        className={
          'relative z-10 w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-card ' +
          'transition-[opacity,transform] duration-150 motion-reduce:transition-none'
        }
      >
        <h2 id="unsaved-dialog-heading" className="text-base font-semibold text-foreground">
          {COPY.heading}
        </h2>
        <p id="unsaved-dialog-body" className="mt-2 text-sm text-muted-foreground">
          {sectionLabel ? COPY.body(sectionLabel) : COPY.bodyGeneric}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          {/* Keep editing — the safe default-focus action. */}
          <Button
            data-dialog-default-focus
            variant="ghost"
            onClick={onKeepEditing}
            className="sm:w-auto"
          >
            {COPY.keepEditing}
          </Button>

          {/* Save and continue — the primary path (save, then proceed). */}
          <Button variant="primary" onClick={onSaveAndContinue} className="sm:w-auto">
            {COPY.saveAndContinue}
          </Button>

          {/* Discard changes — the ghost-destructive proceed. */}
          <button
            type="button"
            onClick={onDiscard}
            className={
              'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-destructive px-4 ' +
              'text-sm font-semibold text-destructive outline-none transition-colors ' +
              'hover:bg-destructive-bg active:translate-y-px motion-reduce:active:translate-y-0 motion-reduce:transition-none ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto'
            }
          >
            {COPY.discard}
          </button>
        </div>
      </div>
    </div>
  );
}
