/**
 * Username-change cooldown constants + date formatting (HANDLE-01 / D-06).
 *
 * A PLAIN module (NOT 'use server') so it can export non-async values — the 30-day
 * window constant and a pure date formatter. The change action is a `'use server'`
 * module and Next 16 Turbopack rejects sync exports from those, so the constant and the
 * formatter live here and are imported by change-username-action.ts (the same precedent
 * as keeping non-async helpers out of the action file — 30-RESEARCH.md Pitfall 10).
 */

/** The username-change cooldown window: one change per 30 days (D-06). */
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Format a next-allowed timestamp as a human date for the D-08 cooldown copy
 * (e.g. "June 19, 2026"). Pure — takes the next-allowed epoch ms and returns the
 * localized date string. The next-allowed instant is `oldest-in-window event +
 * THIRTY_DAYS_MS`; callers without an owner-readable ledger row pass the conservative
 * upper bound `Date.now() + THIRTY_DAYS_MS` (the latest the user could need to wait).
 */
export function formatNextAllowedDate(nextAllowedMs: number): string {
  return new Date(nextAllowedMs).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
