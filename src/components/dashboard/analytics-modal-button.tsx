'use client';

/**
 * AnalyticsModalButton (ANLY-UX-FIX) — relocates the glanceable owner analytics out
 * of the persistent dashboard banner (which ate vertical space above the editor on
 * every visit) into an on-demand modal opened from a header control.
 *
 * The button is styled to match its sibling editor-header controls (Messages /
 * Settings / Preview): a bordered chrome pill with a leading lucide glyph, copper
 * accent on hover/focus ONLY (never a fill — the accent-scarcity rule), focus-visible
 * ring. The modal renders the EXISTING presentational `AnalyticsCard` verbatim — the
 * analytics shape is loaded server-side by the dashboard RSC and threaded down as a
 * plain serializable prop (the card holds no state and fetches nothing, so it renders
 * fine inside this client island; `owner-analytics` itself stays server-only — only
 * its TYPE is imported here, which is erased at compile).
 *
 * A11y: role="dialog" + aria-modal, labelled by the card's own heading; Escape and a
 * backdrop click close; body scroll is locked while open; focus moves to the close
 * button on open and returns to the trigger on close; Tab is trapped within the panel.
 * Chrome tokens only (Inter + Evergreen/Copper), reduced-motion-safe.
 */
import { LineChart, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AnalyticsCard } from '@/components/dashboard/analytics-card';
import type { OwnerAnalytics } from '@/lib/analytics/owner-analytics';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface AnalyticsModalButtonProps {
  analytics: OwnerAnalytics;
}

export function AnalyticsModalButton({ analytics }: AnalyticsModalButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  // Scroll-lock + focus-on-open + return-focus-on-close + Escape + a Tab trap.
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Defer to after paint so the dialog node exists.
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.getClientRects().length > 0 || el === document.activeElement);
      if (focusables.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const activeInTrap = active instanceof HTMLElement && focusables.includes(active);
      if (!activeInTrap) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
      // Return focus to the trigger (fall back to the captured element).
      (triggerRef.current ?? previouslyFocused)?.focus();
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={
          'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-4 ' +
          'text-sm font-semibold text-foreground outline-none transition-colors ' +
          'hover:border-border-strong hover:text-accent ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
          'motion-reduce:transition-none'
        }
      >
        <LineChart aria-hidden="true" className="size-3.5" />
        <span>Analytics</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center p-4"
          style={{ background: 'color-mix(in srgb, var(--color-foreground) 45%, transparent)' }}
          onClick={close}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-analytics-heading"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className={
              'relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border ' +
              'bg-background p-4 shadow-card outline-none sm:p-6'
            }
          >
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close analytics"
              className={
                'absolute right-3 top-3 flex size-9 items-center justify-center rounded-md ' +
                'text-muted-foreground outline-none transition-colors hover:text-foreground ' +
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
                'motion-reduce:transition-none'
              }
            >
              <X aria-hidden="true" className="size-5" />
            </button>

            <AnalyticsCard {...analytics} />
          </div>
        </div>
      ) : null}
    </>
  );
}
