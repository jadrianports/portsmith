-- =============================================================================
-- 020_add_section_atomic.sql
--
-- D-12 / WR-02 (atomic append): replace the application's non-atomic
-- read-then-insert in addSectionAction (add-section-action.ts read MAX(sort_order)
-- in one statement, then INSERT in another) with a single SECURITY INVOKER function
-- that computes `MAX(sort_order)+1` and INSERTs the new section in ONE statement.
-- Two near-simultaneous "Add section" clicks can no longer both read the same MAX
-- and produce a non-deterministic rail/public order: the MAX sub-select and the
-- INSERT are evaluated as one statement, so the second add observes the first's row.
--
-- There is NO `UNIQUE(portfolio_id, sort_order)` constraint (001:132-142 — only
-- `UNIQUE(portfolio_id, type)`), so equal `sort_order` values never raise a DB
-- error; the failure mode this fixes is non-deterministic ORDER, not a constraint
-- violation. The orthogonal `UNIQUE(portfolio_id, type)` axis is unchanged: a
-- duplicate-type add still collides → Postgres 23505 (the action maps it to
-- ALREADY_PRESENT).
--
-- SECURITY INVOKER (NOT DEFINER — load-bearing): the function runs as the CALLER,
-- so the existing `sections.own_all` RLS policy applies exactly as it does to a
-- direct INSERT (mirroring the 007_reorder_sections_rpc.sql precedent). The
-- `sections own all` WITH CHECK scopes the INSERT to the owner — a caller can only
-- add a row to a portfolio they own; a `p_portfolio_id` belonging to another tenant
-- fails the WITH CHECK (RLS rejection) exactly as a direct insert would, never a
-- cross-tenant write (T-17-12B). This is the authenticated RLS write path, never
-- service-role.
--
-- The row starts hidden (`visible = false`, D-04) — a freshly-added section is not
-- shown on the public page until the owner toggles it. The content is the
-- Zod-validated seed the action re-parses BEFORE calling this RPC (the write gate is
-- unchanged; this RPC only changes how `sort_order` is computed).
--
-- FORWARD migration (the local stack already has 001-019 applied). Apply with
-- `npx supabase migration up` — NEVER `db reset` (which wipes the jadrianports
-- founder seed). After applying, regenerate `src/types/database.ts`.
-- =============================================================================
CREATE OR REPLACE FUNCTION add_section(
  p_portfolio_id UUID,
  p_type         TEXT,
  p_content      JSONB
)
RETURNS UUID
SET search_path = public, pg_temp
AS $$
  -- One statement: append the new section at MAX(sort_order)+1 for the owner's
  -- portfolio (COALESCE(..., -1)+1 ⇒ 0 on an empty portfolio). RLS (SECURITY
  -- INVOKER) + the `sections own all` WITH CHECK scope the INSERT to the caller's
  -- own portfolio. The MAX sub-select and the INSERT are evaluated together, so two
  -- concurrent adds cannot both read the same MAX and collide into a duplicate /
  -- non-deterministic sort_order. A duplicate `type` still trips
  -- UNIQUE(portfolio_id, type) → 23505 (the orthogonal axis, unchanged).
  INSERT INTO public.sections (portfolio_id, type, content, sort_order, visible)
  SELECT p_portfolio_id, p_type, p_content,
         COALESCE((SELECT MAX(sort_order) FROM public.sections
                   WHERE portfolio_id = p_portfolio_id), -1) + 1,
         false
  RETURNING id;
$$ LANGUAGE sql SECURITY INVOKER;

COMMENT ON FUNCTION add_section(UUID, TEXT, JSONB) IS
  'D-12 / WR-02: atomically append a new section at MAX(sort_order)+1 within one '
  'owner-scoped portfolio in a single statement (SECURITY INVOKER — RLS applies); '
  'starts hidden. Concurrent adds get distinct contiguous sort_order.';
