/**
 * Admin query-key factory — the single source of truth for the TanStack-Query
 * cache keys backing the /admin Trust-and-Safety report queue (SAFE-02, 06-07).
 *
 * Mirrors the `cmsKeys` / `inboxKeys` factory shape: every member is `as const`
 * so the literal tuples are usable as exact query keys, and the `reports()` key
 * scopes the unreviewed-report queue cache. A mark-reviewed mutation invalidates
 * `adminKeys.reports()` so the row leaves the queue.
 *
 * SERVER-DATA RULE (CLAUDE.md non-overlap): TanStack Query owns the report queue
 * (server data) keyed here; the admin surface's ephemeral UI state (which
 * confirm dialog is open) lives in component state, NEVER mirrored into this
 * cache or a Zustand store.
 */
export const adminKeys = {
  /** Root namespace for every admin server-data cache. */
  all: ['admin'] as const,
  /** The unreviewed report queue (mark-reviewed invalidates this). */
  reports: () => [...adminKeys.all, 'reports'] as const,
  /**
   * The /admin/templates gating surface (GATE-04, 12-05): all templates + their
   * grant lists. A visibility flip / grant / revoke mutation invalidates this so
   * the panel re-reads the authenticated admin-RLS `getTemplateGating()` snapshot.
   */
  templateGating: () => [...adminKeys.all, 'template-gating'] as const,
};
