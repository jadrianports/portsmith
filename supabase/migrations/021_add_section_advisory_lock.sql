-- =============================================================================
-- 021_add_section_advisory_lock.sql
--
-- D-12 / WR-02 (CORRECTNESS FIX for migration 020).
--
-- Migration 020 claimed that computing `MAX(sort_order)+1` and INSERTing in ONE
-- statement made concurrent "Add section" clicks race-safe ("the second add observes
-- the first's row"). THAT PREMISE IS UNSOUND under PostgreSQL's default READ
-- COMMITTED isolation: each `add_section` RPC runs in its OWN transaction, and a
-- statement's `SELECT MAX(sort_order)` reads a snapshot that does NOT see another
-- in-flight transaction's UNCOMMITTED insert. Two RPCs that overlap therefore both
-- read the same MAX and both append MAX+1 — the exact lost-update the fix was meant
-- to prevent. (Reproduced: the 17-03 concurrency test is flaky on 020 — it trips
-- roughly 1-in-3 runs with two duplicate sort_order values, e.g. [7,7] vs [7,8].)
-- "Single statement" guarantees all-or-nothing WITHIN a transaction; it does NOT
-- provide isolation FROM concurrent transactions.
--
-- FIX: take a per-portfolio TRANSACTION-scoped advisory lock before the read, so
-- concurrent adds to the SAME portfolio serialize. The second caller blocks until
-- the first transaction commits (releasing the xact lock) and then observes the
-- committed row, so it reads the updated MAX and appends a DISTINCT sort_order.
--
--   * `pg_advisory_xact_lock` (NOT the session-scoped `pg_advisory_lock`) is the
--     PgBouncer-safe variant: the lock is released automatically on COMMIT, so it is
--     correct under Supabase's transaction-pooled connections. A session lock would
--     leak across pooled transactions.
--   * The lock key is `hashtext('add_section:' || p_portfolio_id)` — namespaced and
--     per-portfolio, so adds to DIFFERENT portfolios never serialize against each
--     other (a hash collision only ever causes a brief, correctness-preserving wait,
--     never a wrong result). Contention is limited to the rare case of two
--     simultaneous adds to the same portfolio and is held for microseconds.
--
-- Everything else is preserved verbatim from 020: SECURITY INVOKER (RLS applies —
-- the `sections own all` WITH CHECK still scopes the INSERT to the caller's own
-- portfolio, never a cross-tenant write); the row starts hidden (`visible = false`,
-- D-04); the orthogonal UNIQUE(portfolio_id, type) → 23505 axis is untouched (the
-- action still maps it to ALREADY_PRESENT). Signature and return type are unchanged,
-- so `src/types/database.ts` needs no regeneration.
--
-- FORWARD migration (020 already applied). Apply with `npx supabase migration up` —
-- NEVER `db reset` (wipes the jadrianports founder seed).
-- =============================================================================
CREATE OR REPLACE FUNCTION add_section(
  p_portfolio_id UUID,
  p_type         TEXT,
  p_content      JSONB
)
RETURNS UUID
SET search_path = public, pg_temp
AS $$
  -- (1) Serialize concurrent adds to THIS portfolio. Transaction-scoped, so it is
  --     released on commit (PgBouncer-safe). Non-final statement: executed for its
  --     side effect; its result is discarded.
  SELECT pg_advisory_xact_lock(hashtext('add_section:' || p_portfolio_id::text));

  -- (2) Append at MAX(sort_order)+1 for the owner's portfolio (COALESCE(..,-1)+1 ⇒ 0
  --     on an empty portfolio). With the lock held, no concurrent add can read a
  --     stale MAX. RLS (SECURITY INVOKER) + the `sections own all` WITH CHECK scope
  --     the INSERT to the caller's own portfolio. Last statement: its RETURNING id is
  --     the function's UUID result.
  INSERT INTO public.sections (portfolio_id, type, content, sort_order, visible)
  SELECT p_portfolio_id, p_type, p_content,
         COALESCE((SELECT MAX(sort_order) FROM public.sections
                   WHERE portfolio_id = p_portfolio_id), -1) + 1,
         false
  RETURNING id;
$$ LANGUAGE sql SECURITY INVOKER;

COMMENT ON FUNCTION add_section(UUID, TEXT, JSONB) IS
  'D-12 / WR-02: atomically append a new section at MAX(sort_order)+1 within one '
  'owner-scoped portfolio. Serialized per-portfolio via a transaction-scoped '
  'advisory lock (READ COMMITTED does not isolate a single statement from '
  'concurrent transactions — 020 was insufficient); starts hidden. SECURITY '
  'INVOKER — RLS applies. Concurrent adds get distinct contiguous sort_order.';
