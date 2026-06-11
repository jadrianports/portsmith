'use client';

/**
 * RegisterOwnUsername (15-05, D-06) — the self-view-exclusion WRITER.
 *
 * The page-view beacon (`src/components/portfolio/beacon.tsx`) skips a view when the
 * first path segment (the `[username]`) is in `localStorage['portsmith-own-usernames']`
 * (D-06 — the owner viewing their own portfolio / a draft preview should not inflate
 * their own count). The DASHBOARD is the writer of that list (RESEARCH OQ-3): mounting
 * this tiny client island on `/dashboard` registers the signed-in owner's username so
 * THIS browser stops counting their self-views.
 *
 * CONTRACT — must match the beacon byte-for-byte (a mismatch silently breaks the
 * exclusion):
 *   • key   = `portsmith-own-usernames` (the beacon's `OWN_USERNAMES_KEY`)
 *   • value = a JSON STRING ARRAY of usernames — the beacon does
 *             `JSON.parse(localStorage.getItem(key) ?? '[]')` and `owners.includes(seg)`.
 *
 * MERGE, never clobber (OQ-3): a shared browser used by more than one account must
 * ACCUMULATE every owner's username, so a second account signing in does not erase the
 * first's exclusion. We read the existing array (parse-guarded), append the username
 * only when absent, and write the merged array back. A parse error resets to a
 * single-entry array (the safe state — at least the current owner is excluded).
 *
 * Renders `null` — no visual surface (it is a write-only effect). The username is
 * RSC-resolved from the verified profile row on the dashboard and passed in as a prop.
 */
import { useEffect } from 'react';

/** The self-view list key — MUST equal the beacon's `OWN_USERNAMES_KEY` (D-06). */
const OWN_USERNAMES_KEY = 'portsmith-own-usernames';

export interface RegisterOwnUsernameProps {
  /** The signed-in owner's username (RSC-resolved from the verified profile row). */
  username: string;
}

export function RegisterOwnUsername({ username }: RegisterOwnUsernameProps) {
  useEffect(() => {
    if (!username) return;

    try {
      // Read the existing list (the beacon's exact shape: a JSON string array).
      let owners: string[] = [];
      const raw = localStorage.getItem(OWN_USERNAMES_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          owners = parsed.filter((u): u is string => typeof u === 'string');
        }
      }

      // Merge — only write when this username is not already registered (OQ-3).
      if (!owners.includes(username)) {
        localStorage.setItem(OWN_USERNAMES_KEY, JSON.stringify([...owners, username]));
      }
    } catch {
      // A parse/storage error: reset to a single-entry array so at least the
      // current owner is excluded (the safe state). If storage is blocked entirely
      // this throws again and is swallowed — self-view exclusion is best-effort
      // (the consequence of a miss is only an inflated own-view count, T-15-15).
      try {
        localStorage.setItem(OWN_USERNAMES_KEY, JSON.stringify([username]));
      } catch {
        /* storage unavailable — nothing to do (best-effort exclusion) */
      }
    }
  }, [username]);

  return null;
}
