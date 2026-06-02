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
 * DISCLOSURE = a focus-trapped MODAL, not an inline panel (UI-SPEC Surface 2
 * decision): it reuses the EXACT dialog a11y + motion contract the work-item modal
 * (`project-modal.tsx`, 06-04) already needs — one pattern, not two. It is a LIGHTER
 * dialog (no hero image, smaller surface, a restrained magenta/violet edge-glow) but
 * shares the shell + the shipped `.tmpl-*` scoped keyframes (reduced-motion-safe).
 *
 * TURNSTILE / SUBMIT idiom mirrors `contact-form.tsx` (06-02): the reused
 * `TurnstileWidget` mounts into the reserved 65px slot; submit is disabled until a
 * token is set; a failed/rejected submit bumps `resetSignal` so a fresh single-use
 * token mints (Pitfall 5). Every non-ok response (400/429/500) is handled IDENTICALLY
 * with the generic error copy — the reporter never sees the rate-limit policy (D-04).
 *
 * REASON OPTIONS: the `<option>` VALUES are the `reportSchema` enum members
 * (`spam`/`harassment`/`hate_speech`/`illegal_content`/`other`); the LABELS are the
 * decided human strings. The reserved `auto_flagged` value is NEVER offered (D-17).
 *
 * TWO-LAYER ISOLATION (D-17): [TMPL] scoped `var(--token)` + the shipped `.tmpl-*`
 * classes ONLY — NO platform-chrome `ui/*` / `globals.css` classes. (The reused
 * `TurnstileWidget` carries its own shared challenge plumbing — sanctioned shared
 * infra, not chrome.) All copy is verbatim from the UI-SPEC Surface 2 contract.
 *
 * A11y (hard): `role="dialog"` + `aria-modal="true"` + accessible name "Report this
 * page"; focus moves into the dialog on open and is TRAPPED; Esc closes; focus
 * RETURNS to the footer trigger on close; real `<label for>` on the reason select +
 * details; submit/cancel are 44px; reduced-motion shows the dialog in place.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { TurnstileWidget } from '@/components/auth/turnstile-widget';

/** The focusable selectors for the focus trap (mirrors `project-modal.tsx`). */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The human-reportable reasons — VALUES are the `reportSchema` enum members; LABELS
 *  are the decided UI-SPEC strings. NO `auto_flagged` (reserved, D-17). */
const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam or scam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'illegal_content', label: 'Illegal content' },
  { value: 'other', label: 'Something else' },
];

/** Shared field-label style (mono, muted, uppercase) — verbatim from contact-form.tsx. */
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  lineHeight: 1.4,
  color: 'var(--muted-fg)',
};

/** Shared field style — verbatim from contact-form.tsx (magenta focus ring via
 *  `.tmpl-contact-field`). */
const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-muted)',
  border: '1px solid var(--border)',
  fontFamily: 'var(--font-body)',
  fontWeight: 400,
  fontSize: '16px',
  lineHeight: 1.6,
  color: 'var(--fg)',
};

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

interface ReportFormDialogProps {
  portfolioId: string;
  onClose: () => void;
}

/**
 * The presentational dialog — a lighter sibling of the work-item modal. Focus-trapped,
 * Esc-closable, click-scrim closes. Reuses the shipped `.tmpl-modal-*` enter keyframes
 * (reduced-motion-safe: the dialog renders its final visible state without them).
 */
function ReportFormDialog({ portfolioId, onClose }: ReportFormDialogProps) {
  const titleId = useId();
  const introId = useId();
  const reasonId = useId();
  const detailsId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [reason, setReason] = useState<string>(REASON_OPTIONS[0].value);
  const [details, setDetails] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [state, setState] = useState<SubmitState>('idle');

  const submitting = state === 'submitting';
  // Submit is disabled until a Turnstile token is set (the widget contract).
  const canSubmit = !!token && !submitting;

  // Generic error copy — IDENTICAL for 400/429/500 (D-04, never leak the cap).
  const errorCopy = 'We couldn’t submit your report. Please try again in a moment.';

  // Esc closes; focus moves into the dialog on open; focus is trapped within it.
  useEffect(() => {
    const dialog = dialogRef.current;
    // Move focus into the dialog on open (focus-trap entry).
    dialog?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // Trap Tab/Shift+Tab inside the dialog.
      const focusables = dialog
        ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
            (el) => el.offsetParent !== null || el === document.activeElement,
          )
        : [];
      if (focusables.length === 0) {
        e.preventDefault();
        dialog?.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || active === dialog) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || submitting) return;
    setState('submitting');

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          portfolio_id: portfolioId,
          reason,
          // details is optional — send only when non-empty.
          ...(details.trim() ? { details: details.trim() } : {}),
          turnstile_token: token,
        }),
      });

      if (res.ok) {
        setState('success');
        return;
      }
      // Any non-ok (400/429/500 — IDENTICAL handling, never leak the cap, D-04).
      throw new Error('submit_failed');
    } catch {
      setState('error');
      // Mint a fresh Turnstile token for the next attempt (Pitfall 5 — single-use).
      setToken(null);
      setResetSignal((n) => n + 1);
    }
  }

  return (
    <div
      className="tmpl-modal-backdrop tmpl-modal-backdrop-enter"
      onClick={(e) => {
        // Click on the scrim (not the dialog) closes.
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        // Same backdrop language as the work-item modal, dialed down.
        background:
          'radial-gradient(120% 80% at 50% 120%, rgba(255, 45, 149, 0.08) 0%, rgba(140, 30, 255, 0.05) 35%, transparent 70%), color-mix(in srgb, var(--bg) 82%, transparent)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={introId}
        tabIndex={-1}
        className="tmpl-project-modal tmpl-project-modal-enter"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          width: 'min(480px, 92vw)',
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: '28px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          // Restrained magenta/violet edge-glow (lighter than the work-item modal —
          // it is a utility, not the hero).
          boxShadow:
            '0 0 0 1px var(--accent), 0 18px 44px -22px rgba(255, 45, 149, 0.35), 0 0 60px -34px rgba(157, 92, 255, 0.45)',
          outline: 'none',
        }}
      >
        {/* The static sunset top-hairline (decorative; survives reduced-motion — the
            sweep is gated under no-preference in theme.css). */}
        <span
          aria-hidden="true"
          className="tmpl-modal-hairline"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            borderTopLeftRadius: 'var(--radius-lg)',
            borderTopRightRadius: 'var(--radius-lg)',
            background: 'var(--sunset-gradient)',
          }}
        />

        {/* Header: heading + 44px close. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
            <h2
              id={titleId}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 'clamp(1.5rem, 4vw, 1.75rem)',
                lineHeight: 1.2,
                color: 'var(--fg)',
                margin: 0,
              }}
            >
              Report this page
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tmpl-modal-close"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              height: '44px',
              flexShrink: 0,
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--muted-fg)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {/* Tiny inline × glyph (template layer — never the chrome icon vocabulary). */}
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Success state — replace the form body with the decided thanks copy. */}
        {state === 'success' ? (
          <div
            className="tmpl-contact-success-pulse"
            aria-live="polite"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '20px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
            }}
          >
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--success)"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: '2px' }}
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: 1.6,
                color: 'var(--fg)',
                margin: 0,
              }}
            >
              Thanks — your report has been submitted. We&rsquo;ll take a look.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            aria-busy={submitting}
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            {/* The decided intro line. */}
            <p
              id={introId}
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: 1.6,
                color: 'var(--muted-fg)',
                margin: 0,
              }}
            >
              Tell us what&rsquo;s wrong with this page. Reports are reviewed by a person.
            </p>

            {/* Reason select — option VALUES are the enum members, LABELS the human strings. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor={reasonId} style={labelStyle}>
                Reason
              </label>
              <select
                id={reasonId}
                name="reason"
                required
                disabled={submitting}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="tmpl-contact-field"
                style={fieldStyle}
              >
                {REASON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Optional details. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor={detailsId} style={labelStyle}>
                Add details (optional)
              </label>
              <textarea
                id={detailsId}
                name="details"
                rows={4}
                maxLength={2000}
                disabled={submitting}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="tmpl-contact-field"
                style={{ ...fieldStyle, resize: 'vertical', minHeight: '96px' }}
              />
            </div>

            {/* Real Turnstile widget in the reserved 65px slot (no CLS — same as contact). */}
            <div style={{ minHeight: '65px', display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '100%' }}>
                <TurnstileWidget onToken={setToken} resetSignal={resetSignal} />
              </div>
            </div>

            {/* Generic error (IDENTICAL for 400/429/500 — D-04), role="alert". */}
            {state === 'error' ? (
              <p
                role="alert"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 400,
                  fontSize: '16px',
                  lineHeight: 1.6,
                  color: 'var(--destructive)',
                  margin: 0,
                }}
              >
                {errorCopy}
              </p>
            ) : null}

            {/* Actions: magenta "Submit report" + a "Cancel" ghost (cyan focus). */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <button
                type="submit"
                disabled={!canSubmit}
                aria-busy={submitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  minHeight: '44px',
                  padding: '0 24px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  opacity: canSubmit ? 1 : 0.6,
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '16px',
                  boxShadow: '0 8px 28px -12px rgba(255,45,149,0.38)',
                }}
              >
                {submitting ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="tmpl-contact-spinner"
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        border: '2px solid var(--bg)',
                        borderTopColor: 'transparent',
                        display: 'inline-block',
                      }}
                    />
                    Sending…
                  </>
                ) : (
                  'Submit report'
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="tmpl-modal-close"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '44px',
                  padding: '0 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--muted-fg)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '16px',
                  outline: 'none',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */

export interface ReportDialogProps {
  /** The target portfolio id (from `data.settings.portfolio_id` in the footer). */
  portfolioId: string;
}

/**
 * The exported island: renders the muted footer "Report this page" trigger AND owns
 * the dialog open/close + focus-return. Rendered inside the footer subtree (under the
 * `.tmpl-minimal` root) so the scoped template classes/keyframes apply — the same
 * inline (non-portal) approach as `project-modal.tsx`.
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
