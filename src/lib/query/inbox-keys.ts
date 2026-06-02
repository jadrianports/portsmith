/**
 * Inbox query-key factory — the single source of truth for the TanStack-Query
 * cache keys backing the dashboard message inbox (CONT-02, 06-05).
 *
 * Mirrors the `cmsKeys` factory shape (`src/lib/query/cms-keys.ts`): every member
 * is `as const` so the literal tuples are usable as exact query keys, and the
 * `list(portfolioId)` key scopes the cache to ONE owner's portfolio (the
 * authenticated, RLS-scoped read already returns owner-only rows — the key just
 * partitions the cache by portfolio so a future multi-portfolio world stays
 * correct, and so `invalidateQueries` after a mark-read / delete targets the
 * right list).
 *
 * SERVER-DATA RULE (CLAUDE.md non-overlap): TanStack Query owns the message list
 * (server data) keyed here; the inbox's ephemeral UI state (which row is open,
 * the delete-confirm flag) lives in component state, NEVER mirrored into this
 * cache or a Zustand store.
 */
export const inboxKeys = {
  /** Root namespace for every inbox server-data cache. */
  all: ['inbox'] as const,
  /** The owner's message list for a portfolio (mark-read / delete invalidate this). */
  list: (portfolioId: string) => [...inboxKeys.all, 'list', portfolioId] as const,
};
