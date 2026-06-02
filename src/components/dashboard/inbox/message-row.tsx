'use client';

/**
 * MessageRow (06-UI-SPEC Surface 3, CONT-02) — one row in the dashboard inbox +
 * its expandable detail. CHROME layer (Evergreen & Copper, Inter) — Tailwind
 * utilities → `globals.css @theme` tokens ONLY; NO template `.tmpl-*` tokens
 * (two-layer isolation, SHARED-E).
 *
 * UNREAD SIGNAL (color-independent, LOAD-BEARING UI-SPEC §"color independence"):
 * an unread row carries THREE independent signals so color is never the only cue:
 *   1. a single `--color-accent` (copper) `--radius-full` dot, ONLY on unread rows
 *      (the sanctioned scarce-accent status-dot use #2 — NEVER a copper row flood);
 *   2. a weight/color delta — unread sender + subject render in
 *      `--color-foreground` weight 600; read rows drop to weight 400 /
 *      `--color-muted-foreground`;
 *   3. a visually-hidden "Unread" text + an accessible row name ("…, unread").
 *
 * DETAIL: sender + email + timestamp + the body rendered as PLAIN TEXT (React
 * escapes — `sender_name`/`subject`/`body` are untrusted input; T-06-05, never
 * `dangerouslySetInnerHTML`). Actions (44px, aria-labels):
 *   - Reply — a real `<a>` to `safeHref(mailto:…, {allowMailto:true})` (no platform
 *     relay, D-03; copper link-hover);
 *   - Mark read / Mark unread — toggles `is_read` (optimistic, owned by the parent);
 *   - Delete — destructive `trash-2` + an INLINE confirm mirroring `item-card.tsx`
 *     ("Delete this message?" → "Delete message" / "Keep message", default focus
 *     "Keep message").
 *
 * Source: the row layout + 44px icon-button + focus-ring idiom from
 * `editor/section-list-row.tsx` / `editor/eye-toggle.tsx`; the inline destructive
 * confirm from `editor/item-card.tsx`; `safeHref` from `@/lib/safe-url`.
 */
import { CornerUpLeft, Mail, MailOpen, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { safeHref } from '@/lib/safe-url';
import type { InboxMessage } from '@/lib/cms/inbox';

/** A short relative timestamp ("just now", "2h ago", "3d ago") falling back to a date. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export interface MessageRowProps {
  message: InboxMessage;
  /** Whether this row's detail is open (the parent owns single-open selection). */
  open: boolean;
  /** Whether a mutation on this row is in flight (disables its actions). */
  busy: boolean;
  /** Open/close this row's detail. */
  onToggleOpen: () => void;
  /** Toggle `is_read` (the parent runs the optimistic mark-read mutation). */
  onToggleRead: (next: boolean) => void;
  /** Delete this message (the parent runs the non-optimistic delete mutation). */
  onDelete: () => void;
}

export function MessageRow({
  message,
  open,
  busy,
  onToggleOpen,
  onToggleRead,
  onDelete,
}: MessageRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sender = message.sender_name.trim() || 'Someone';
  const hasSubject = !!message.subject && message.subject.trim().length > 0;
  const unread = !message.is_read;
  const replyHref = safeHref(`mailto:${encodeURIComponent(message.sender_email)}`, {
    allowMailto: true,
  });

  return (
    <li className="list-none border-b border-border last:border-b-0">
      {/* The row button: unread dot · sender + subject · timestamp. Opening it
          reveals the detail (mirrors the editor's list-selects-into-detail). */}
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        aria-label={`Open message from ${sender}, ${unread ? 'unread' : 'read'}`}
        className={
          'flex w-full items-center gap-3 bg-surface px-3 py-3 text-left outline-none ' +
          'transition-colors hover:bg-surface-muted ' +
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ' +
          'motion-reduce:transition-none'
        }
      >
        {/* Unread dot — a single copper `--radius-full` dot, ONLY on unread rows
            (scarce accent). A fixed-width slot keeps read/unread rows aligned. */}
        <span aria-hidden="true" className="flex w-2 shrink-0 justify-center">
          {unread ? (
            <span className="size-2 rounded-full bg-accent" />
          ) : null}
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span
              className={
                'truncate text-sm ' +
                (unread
                  ? 'font-semibold text-foreground'
                  : 'font-normal text-muted-foreground')
              }
            >
              {sender}
            </span>
            {unread ? (
              // Visually-hidden "Unread" text — color is never the only signal.
              <span className="sr-only">Unread</span>
            ) : null}
          </span>
          <span
            className={
              'truncate text-base ' +
              (unread ? 'text-foreground' : 'text-muted-foreground')
            }
          >
            {hasSubject ? (
              message.subject
            ) : (
              <span className="text-muted-foreground">(no subject)</span>
            )}
          </span>
        </span>

        <time
          dateTime={message.created_at}
          className="shrink-0 text-[13px] tabular-nums text-muted-foreground"
        >
          {relativeTime(message.created_at)}
        </time>
      </button>

      {/* Detail — sender + email + timestamp + body (plain text), then actions. */}
      {open ? (
        <div className="border-t border-border bg-surface px-4 py-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-foreground">{sender}</p>
            <p className="text-[13px] text-muted-foreground">{message.sender_email}</p>
            <p className="text-[13px] tabular-nums text-muted-foreground">
              {new Date(message.created_at).toLocaleString()}
            </p>
          </div>

          {/* Body — PLAIN TEXT (React escapes). `whitespace-pre-wrap` preserves the
              sender's line breaks without any HTML interpolation (T-06-05). */}
          <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed text-foreground">
            {message.body}
          </p>

          {confirmDelete ? (
            // Inline destructive confirm (mirrors item-card.tsx) — default focus on
            // the safe "Keep message" action.
            <div
              role="alertdialog"
              aria-label="Delete this message?"
              className="mt-4 rounded-md bg-destructive-bg px-4 py-3"
            >
              <p className="text-sm font-semibold text-foreground">
                Delete this message?
              </p>
              <p className="mt-1 text-[13px] leading-tight text-muted-foreground">
                This permanently removes it from your inbox. This can’t be undone.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setConfirmDelete(false);
                    onDelete();
                  }}
                  disabled={busy}
                  className="w-auto bg-destructive hover:bg-destructive"
                >
                  Delete message
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  autoFocus
                  onClick={() => setConfirmDelete(false)}
                  className="w-auto"
                >
                  Keep message
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-1">
              {/* Reply — a real mailto link (no relay, D-03). Omitted only if the
                  email somehow fails the safe-href guard. Copper link-hover. */}
              {replyHref ? (
                <a
                  href={replyHref}
                  aria-label={`Reply to ${sender} by email`}
                  className={
                    'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm ' +
                    'font-semibold text-foreground outline-none transition-colors ' +
                    'hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 ' +
                    'focus-visible:outline-ring motion-reduce:transition-none'
                  }
                >
                  <CornerUpLeft aria-hidden="true" className="size-4" />
                  Reply
                </a>
              ) : null}

              {/* Mark read / Mark unread — toggles is_read (optimistic in parent). */}
              <button
                type="button"
                onClick={() => onToggleRead(unread)}
                disabled={busy}
                aria-label={
                  unread
                    ? `Mark message from ${sender} as read`
                    : `Mark message from ${sender} as unread`
                }
                className={
                  'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm ' +
                  'font-semibold text-foreground outline-none transition-colors ' +
                  'hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 ' +
                  'focus-visible:outline-ring disabled:cursor-not-allowed ' +
                  'disabled:text-muted-foreground motion-reduce:transition-none'
                }
              >
                {unread ? (
                  <MailOpen aria-hidden="true" className="size-4" />
                ) : (
                  <Mail aria-hidden="true" className="size-4" />
                )}
                {unread ? 'Mark read' : 'Mark unread'}
              </button>

              {/* Delete — destructive (NOT copper); opens the inline confirm. */}
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                aria-label={`Delete message from ${sender}`}
                className={
                  'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm ' +
                  'font-semibold text-muted-foreground outline-none transition-colors ' +
                  'hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 ' +
                  'focus-visible:outline-ring disabled:cursor-not-allowed motion-reduce:transition-none'
                }
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}
