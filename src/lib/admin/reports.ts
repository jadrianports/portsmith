/**
 * Admin report-queue read (SAFE-02, 06-07) — the unreviewed `reports` queue, read
 * via the AUTHENTICATED admin cookie/RLS client.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ READ BOUNDARY (T-06-W4, LOAD-BEARING):                                        │
 * │ The /admin queue READ uses the AUTHENTICATED `createClient()` — NEVER         │
 * │ `supabaseAdmin`. The `reports admin all` RLS policy (004:263, USING           │
 * │ is_admin()) already lets an admin read every report; service-role is RESERVED │
 * │ for the lock WRITE (lock-action.ts) ONLY. Using service-role here would       │
 * │ over-expose and bypass the very RLS that proves only admins read reports.     │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Each report's target `username` is resolved by the join
 * `reports → portfolios → profiles` so the operator can open the live page. The
 * reporter is NEVER carried here — the table stores no reporter identity (only a
 * hashed IP lived briefly as a rate-limit subject in `rate_limit_events`, never on
 * `reports`), and the UI renders "Anonymous report" regardless. The queue is
 * ordered newest-first and reuses `idx_reports_unreviewed`.
 *
 * `import 'server-only'` keeps the cookie/RLS read out of any client bundle.
 */
import 'server-only';

import { createClient } from '@/lib/supabase/server';

/**
 * The report-row shape the /admin queue renders. `reason` is the raw enum value
 * (the UI maps it to a human label); `details` is untrusted reporter free text
 * rendered as PLAIN TEXT (React escapes). `username` / `locked` come from the
 * joined target profile so the operator can View live + see suspended state. The
 * reporter identity is intentionally ABSENT — never selected, never rendered.
 */
export interface AdminReport {
  id: string;
  portfolio_id: string;
  reason: string;
  details: string | null;
  created_at: string;
  /** The target portfolio's owner username (joined), null only if the join breaks. */
  username: string | null;
  /** Whether the target is currently suspended (drives the lock-control state). */
  locked: boolean;
}

/** The raw joined row shape Supabase returns before flattening. */
interface RawReportRow {
  id: string;
  portfolio_id: string;
  reason: string;
  details: string | null;
  created_at: string;
  portfolios: { profiles: { username: string | null; locked: boolean } | null } | null;
}

/**
 * Read the unreviewed report queue (newest-first), resolving each report's target
 * username + locked state via the join. AUTHENTICATED admin RLS read (NOT
 * service-role — T-06-W4). Returns `[]` on a read error (the surface shows a calm
 * load-error / empty state rather than throwing).
 */
export async function getUnreviewedReports(): Promise<AdminReport[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reports')
    .select(
      'id, portfolio_id, reason, details, created_at, portfolios(profiles(username, locked))',
    )
    .eq('reviewed', false)
    .order('created_at', { ascending: false });

  if (error) return [];

  return ((data ?? []) as unknown as RawReportRow[]).map((r) => ({
    id: r.id,
    portfolio_id: r.portfolio_id,
    reason: r.reason,
    details: r.details,
    created_at: r.created_at,
    username: r.portfolios?.profiles?.username ?? null,
    locked: r.portfolios?.profiles?.locked ?? false,
  }));
}
