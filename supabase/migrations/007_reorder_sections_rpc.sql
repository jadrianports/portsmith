-- =============================================================================
-- 007_reorder_sections_rpc.sql
--
-- WR-04 (atomic reorder): replace the application's non-atomic per-row UPDATE loop
-- (reorder-sections-action.ts) with a single SECURITY INVOKER function that writes
-- every affected section's contiguous `sort_order` in ONE statement — all rows
-- commit or none do. A mid-loop failure can no longer leave duplicate / gapped
-- `sort_order` values that corrupt the public read (which sorts `sort_order ASC`).
--
-- SECURITY INVOKER (NOT DEFINER — load-bearing): the function runs as the CALLER,
-- so the existing `sections.own_all` RLS policy applies exactly as it does to a
-- direct UPDATE. A caller can only reorder rows of a portfolio they own; the
-- explicit `portfolio_id = p_portfolio_id` predicate + RLS keep the write
-- owner-scoped, and a section id belonging to another tenant simply matches no row
-- (0-row effect for that id), never a cross-tenant write (T-04-05a).
--
-- The new contiguous order is `ordinality - 1` (0-based), so passing the FULL
-- ordered id list yields `sort_order` 0..n-1 with no gaps or collisions
-- (RESEARCH Pitfall 6: persist ALL affected rows, never just the moved one).
--
-- FORWARD migration (the local stack already has 001-006 applied). Apply with
-- `npx supabase migration up` — NEVER `db reset` (which wipes the jadrianports
-- founder seed).
-- =============================================================================
CREATE OR REPLACE FUNCTION reorder_sections(
  p_portfolio_id UUID,
  p_ordered_ids  UUID[]
)
RETURNS VOID
SET search_path = public, pg_temp
AS $$
  -- One statement: set each named section's contiguous 0-based sort_order from its
  -- position in the input array. RLS (SECURITY INVOKER) + the portfolio_id predicate
  -- scope the write to the caller's own portfolio; ids not in this portfolio (or not
  -- the caller's) match no row. There is no UNIQUE(portfolio_id, sort_order)
  -- constraint (001:132-142 — only UNIQUE(portfolio_id, type)), so the in-flight
  -- reordering never trips a transient-collision error.
  UPDATE public.sections AS s
     SET sort_order = o.ord - 1
    FROM unnest(p_ordered_ids) WITH ORDINALITY AS o(id, ord)
   WHERE s.id = o.id
     AND s.portfolio_id = p_portfolio_id;
$$ LANGUAGE sql SECURITY INVOKER;

COMMENT ON FUNCTION reorder_sections(UUID, UUID[]) IS
  'WR-04: atomically set contiguous 0-based sort_order for the given ordered '
  'section ids within one owner-scoped portfolio (SECURITY INVOKER — RLS applies).';
