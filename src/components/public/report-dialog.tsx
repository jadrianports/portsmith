'use client';

/**
 * ReportDialog (SAFE-03 / D-15 / D-16 / UI-SPEC Surface 2 + "footer link").
 *
 * The single sanctioned safety affordance on the otherwise chrome-free public page
 * (TMPL-07 tension accepted): a muted "Report this page" `<button>` in the footer
 * that opens a Turnstile-gated, focus-trapped report dialog. The dialog POSTs the
 * `reportSchema` shape `{ portfolio_id, reason, details?, turnstile_token }` to
 * `/api/report` — the sole service-role writer (D-16). The client parse/validation
 * is UX only; the server re-parse is the real gate (D-02).
 *
 * BUNDLE SPLIT (36-04 / D-22/D-25): this trigger is a client component referenced by
 * EVERY template footer, so Next hoists it into the `/[username]` route's SHARED
 * first-load chunk. The heavy dialog body (the form + the reused `TurnstileWidget`,
 * ~13 kB gz) lives in `./report-form-dialog` and is pulled in via `next/dynamic` ONLY
 * when the user first opens the dialog — keeping it OUT of first load for every public
 * route. Registering the 5th template (`atelier`) had tipped the already-at-ceiling
 * public bundle over the ≤200 kB invariant; this split is the reclaim. `ssr: false` is
 * correct — the dialog is client-only (it never renders on the server / in the SSG
 * HTML; it only ever mounts after a click). `npm run check:bundle` is the regression
 * catch. DISCLOSURE, a11y, motion, and token-only styling are unchanged — they all live
 * in `ReportFormDialog`.
 *
 * A11y (hard, owned here): focus RETURNS to the footer trigger on close; the dialog's
 * own focus-trap / Esc / labelled controls live in `ReportFormDialog`.
 */
import { useCallback, useRef, useState } from 'react';

import dynamic from 'next/dynamic';

// Lazily-loaded heavy body — fetched on first open (client-only; never in first load).
const ReportFormDialog = dynamic(
  () => import('./report-form-dialog').then((m) => m.ReportFormDialog),
  { ssr: false },
);

export interface ReportDialogProps {
  /** The target portfolio id (from `data.settings.portfolio_id` in the footer). */
  portfolioId: string;
}

/**
 * The exported island: renders the muted footer "Report this page" trigger AND owns
 * the dialog open/close + focus-return. Rendered inside the footer subtree (under the
 * active template root — `.tmpl-minimal` / `.tmpl-editorial` / `.tmpl-aurora` /
 * `.tmpl-edgerunner-v2` / `.tmpl-atelier`) so THAT template's scoped
 * classes/keyframes/complete-value tokens apply — the same inline (non-portal)
 * approach as `project-modal.tsx`. Token-only (DEF-07-03-01) → template-agnostic.
 *
 * The trigger is a real `<button>` (the dialog is client-side — D-15), deliberately
 * quieter than the social links (mono 13px, `--muted-fg`, 44px hit area, cyan
 * `--ring` focus via `.tmpl-modal-close`); a subtle inline `flag` glyph precedes it.
 */
export function ReportDialog({ portfolioId }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // A11y: focus returns to the footer trigger on close.
    triggerRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="tmpl-modal-close"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          minHeight: '44px',
          padding: '0 4px',
          background: 'transparent',
          border: 'none',
          // Quieter than the social links: muted, mono 13px (the footer link voice).
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          letterSpacing: '0.04em',
          color: 'var(--muted-fg)',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {/* Subtle flag glyph (inline SVG — template layer, never the chrome icons). */}
        <svg
          aria-hidden="true"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
        Report this page
      </button>

      {open ? <ReportFormDialog portfolioId={portfolioId} onClose={close} /> : null}
    </>
  );
}
