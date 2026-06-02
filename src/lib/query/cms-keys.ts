/**
 * CMS query-key factory — the single source of truth for every TanStack-Query
 * cache key in the dashboard editor (the FIRST key factory in the repo).
 *
 * TanStack Query owns ALL server data (portfolio, sections); these keys scope
 * the cache + drive `invalidateQueries` after a save/reorder/visibility write.
 * UI-only, ephemeral state (active section, dirty, drag) lives in the Zustand
 * store (`src/lib/stores/uiStore.ts`) — NEVER mirror server data into Zustand
 * (repo-root CLAUDE.md "TanStack Query v5 + Zustand — non-overlapping
 * responsibilities").
 *
 * NO `items` KEY ON PURPOSE: work/showcase items are stored INSIDE a section's
 * `content.items` JSONB array — there is no `items` table (04-RESEARCH Pitfall
 * 7). An item edit IS a section content write, so item mutations invalidate the
 * section's key (`cmsKeys.section(id)` / `cmsKeys.sections(portfolioId)`), never
 * a separate item key.
 *
 * Every member is `as const` so the literal tuples are usable as exact query
 * keys (RESEARCH Pattern 4).
 */
export const cmsKeys = {
  /** Root namespace for every CMS server-data cache. */
  all: ['cms'] as const,
  /** A single portfolio by its id. */
  portfolio: (id: string) => [...cmsKeys.all, 'portfolio', id] as const,
  /** The ordered section list for a portfolio (reorder/visibility invalidate this). */
  sections: (portfolioId: string) =>
    [...cmsKeys.all, 'sections', portfolioId] as const,
  /** One section by its id (a content/item edit invalidates this). */
  section: (sectionId: string) =>
    [...cmsKeys.all, 'section', sectionId] as const,
  /**
   * The owner's storage usage (`profiles.storage_used_bytes`) — the read-only
   * StorageMeter's key (D-09). An upload/remove invalidates this so the meter
   * re-reads the trigger-maintained usage. The meter NEVER writes this column
   * (protected, T-05-22) — invalidate to re-READ, never `setQueryData` the value.
   */
  storageUsed: (ownerId: string) =>
    [...cmsKeys.all, 'storage-used', ownerId] as const,
};
