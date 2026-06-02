'use client';

/**
 * ReportQueue (06-UI-SPEC Surface 4, SAFE-02) — the /admin unreviewed report
 * queue + mark-reviewed + the per-row lock control. CHROME layer (Evergreen &
 * Copper, Inter): Tailwind utilities → `globals.css @theme` tokens + lucide
 * glyphs ONLY; NO template `.tmpl-*` tokens (two-layer isolation, SHARED-E).
 *
 * SERVER-DATA RULE (CLAUDE.md non-overlap): the report queue is SERVER data — it
 * lives in the TanStack Query cache keyed by `adminKeys.reports()`, seeded from
 * the RSC-loaded `initialReports`. It is NEVER mirrored into a Zustand store.
 *
 * MARK-REVIEWED (mirrors `message-inbox.tsx` delete: NON-optimistic): the
 * `mutationFn` calls `markReportReviewed(id)`; on success the row is removed from
 * the cache (it leaves the queue), `onError` surfaces a destructive Alert,
 * `onSettled` invalidates `adminKeys.reports()`. A polite live region announces
 * outcomes.
 *
 * REPORTER PRIVACY (T-06-21, LOAD-BEARING): the reporter is ALWAYS rendered as
 * "Anonymous report" — the stored subject is a hashed IP we never expose; this
 * component surfaces NO IP / hash field. The target is a "View live ↗" link only.
 *
 * Source: the seed-from-RSC + cache-only query idiom from `message-inbox.tsx`;
 * the mutation + Alert idiom from `editor/eye-toggle.tsx`; the admin keys from
 * `@/lib/query/admin-keys`; the mark-reviewed action from
 * `@/lib/admin/report-actions`; `siteUrl` from `@/lib/url`.
 */
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Check, ExternalLink, Flag, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import type { AdminReport } from '@/lib/admin/reports';
import { markReportReviewed } from '@/lib/admin/report-actions';
import { adminKeys } from '@/lib/query/admin-keys';
import { siteUrl } from '@/lib/url';

import { LockControl } from './lock-control';

const ACTION_ERROR = 'We couldn’t update that portfolio. Please try again.';

/**
 * Human labels for the `reports.reason` CHECK enum — the SAME map as the report
 * dialog (Surface 2). `auto_flagged` is a reserved automated value never offered
 * to humans, shown as "Auto-flagged" only if such a row ever surfaces (D-17).
 */
const REASON_LABELS: Record<string, string> = {
  spam: 'Spam or scam',
  harassment: 'Harassment or bullying',
  hate_speech: 'Hate speech',
  illegal_content: 'Illegal content',
  other: 'Something else',
  auto_flagged: 'Auto-flagged',
};

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? 'Something else';
}

/** A short relative timestamp, falling back to a locale date. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export interface ReportQueueProps {
  /** The RSC-loaded unreviewed reports (newest-first) — seeds the TanStack cache. */
  initialReports: AdminReport[];
}

export function ReportQueue({ initialReports }: ReportQueueProps) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');

  const listKey = useMemo(() => adminKeys.reports(), []);

  // Seed the cache from the RSC-loaded rows once per load (server data lives in
  // the query cache, never component state for the list itself).
  useEffect(() => {
    queryClient.setQueryData<AdminReport[]>(listKey, initialReports);
  }, [queryClient, listKey, initialReports]);

  // Read the queue back from the cache (cache-only query — seeded by the effect +
  // initialData; the mark-reviewed mutation writes straight to the cache).
  const { data: reports = [] } = useQuery<AdminReport[]>({
    queryKey: listKey,
    queryFn: skipToken,
    initialData: () => initialReports,
    staleTime: Infinity,
  });

  // ── Mark reviewed (NON-optimistic — the row leaves the queue on success) ─────
  const reviewMutation = useMutation({
    mutationFn: (id: string) => markReportReviewed(id),
    onSuccess: (result, id) => {
      if (!result.ok) {
        setActionError(ACTION_ERROR);
        return;
      }
      setActionError(null);
      setAnnounce('Report marked reviewed.');
      queryClient.setQueryData<AdminReport[]>(listKey, (old) =>
        old?.filter((r) => r.id !== id),
      );
    },
    onError: () => setActionError(ACTION_ERROR),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  return (
    <>
      {/* Live region: mark-reviewed + lock outcomes announce politely. */}
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>

      {actionError ? (
        <Alert variant="error" className="mb-4">
          {actionError}
        </Alert>
      ) : null}

      {reports.length === 0 ? (
        // Empty state — "Queue clear", confident, never a void (inherited rule).
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldCheck aria-hidden="true" className="size-10 text-muted-foreground" />
          <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            Queue clear
          </h2>
          <p className="max-w-md text-base text-muted-foreground">
            No reports to review. You’re all caught up.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              busy={
                reviewMutation.isPending && reviewMutation.variables === report.id
              }
              onMarkReviewed={() => reviewMutation.mutate(report.id)}
              onLockOutcome={(msg) => setAnnounce(msg)}
              onLockError={() => setActionError(ACTION_ERROR)}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/** One queue card: reason · View-live · anonymous reporter · details · actions. */
function ReportCard({
  report,
  busy,
  onMarkReviewed,
  onLockOutcome,
  onLockError,
}: {
  report: AdminReport;
  busy: boolean;
  onMarkReviewed: () => void;
  onLockOutcome: (msg: string) => void;
  onLockError: () => void;
}) {
  const username = report.username;
  const liveHref = username ? siteUrl('/' + username) : null;

  return (
    <li className="list-none rounded-md border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {/* Reason — Label 14/600. */}
          <div className="flex items-center gap-2">
            <Flag aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              {reasonLabel(report.reason)}
            </span>
            {report.locked ? (
              // Color-independent suspended tag: lock glyph + "Suspended" text.
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 text-[13px] text-muted-foreground">
                Suspended
              </span>
            ) : null}
          </div>

          {/* Target — "View live ↗" (new tab) OR a muted note if the join broke. */}
          {liveHref && username ? (
            <a
              href={liveHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${username}’s page in a new tab`}
              className={
                'inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold ' +
                'text-foreground underline-offset-2 outline-none transition-colors ' +
                'hover:text-accent hover:underline focus-visible:outline-2 ' +
                'focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none'
              }
            >
              View live <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          ) : (
            <span className="text-[13px] text-muted-foreground">
              Target unavailable
            </span>
          )}

          {/* Reporter — ALWAYS "Anonymous report"; NEVER an IP / hash (T-06-21). */}
          <span className="text-[13px] text-muted-foreground">Anonymous report</span>
        </div>

        {/* Timestamp (tnum). */}
        <time
          dateTime={report.created_at}
          className="shrink-0 text-[13px] tabular-nums text-muted-foreground"
        >
          {relativeTime(report.created_at)}
        </time>
      </div>

      {/* Optional details — reporter free text, PLAIN TEXT (React escapes). */}
      {report.details && report.details.trim().length > 0 ? (
        <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed text-foreground">
          {report.details}
        </p>
      ) : null}

      {/* Actions: Mark reviewed + the lock control. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onMarkReviewed}
          disabled={busy}
          aria-label="Mark this report reviewed"
          className={
            'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm ' +
            'font-semibold text-foreground outline-none transition-colors ' +
            'hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 ' +
            'focus-visible:outline-ring disabled:cursor-not-allowed ' +
            'disabled:text-muted-foreground motion-reduce:transition-none'
          }
        >
          <Check aria-hidden="true" className="size-4" />
          Mark reviewed
        </button>

        {username ? (
          <LockControl
            username={username}
            locked={report.locked}
            onOutcome={onLockOutcome}
            onError={onLockError}
          />
        ) : null}
      </div>
    </li>
  );
}
