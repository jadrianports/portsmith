-- =============================================================================
-- 019_page_view_source_and_insights.sql
-- Phase 15 (Operator Analytics & Abuse Observability) — Plan 15-02, Wave 1
--
-- TWO additive things, no destructive change to page_views (D-18):
--   (1) Source-attribution columns on `page_views` (utm_source, utm_medium) +
--       a created_at index. `referrer` and `country` columns already exist (001),
--       so the ALTER adds ONLY the two UTM columns. Both nullable, NO backfill —
--       existing rows get NULL (D-18: store raw host + raw UTM, bucket at READ time).
--       The existing `idx_page_views_portfolio (portfolio_id, created_at DESC)` (001)
--       already backs per-portfolio / owner reads; the new `idx_page_views_created_at`
--       backs the GLOBAL per-day series + total-in-window operator scans.
--   (2) FIVE is_admin-self-gated definer aggregate RPCs — the SOLE operator read
--       surface (D-16). They return ONLY aggregates (a count / top-N / per-day series
--       / per-bucket counts), NEVER raw rows. There is deliberately NO broad
--       `page_views admin select` RLS policy (D-16 forbids raw-row admin reads; the
--       definer RPCs keep admin's reach narrow).
--
-- DECISIONS:
--   D-16  operator reads via purpose-built definer aggregate RPCs returning ONLY
--         aggregates, each self-gating on the admin check — NOT a broad admin RLS
--         select policy, NOT service-role (T-06-W4: admin reads use authenticated
--         identity; the RPC self-gate is the real authorization).
--   D-17  fixed recent windows (no date-picker) — the p_days args carry the defaults.
--   D-18  additive source columns (utm_source/utm_medium) + an aggregate index; raw
--         host + raw UTM stored, bucketed at READ time. Regenerate database.ts after.
--
-- DEFINER POSTURE (mirrors 012_template_gating_rls.sql + 014_count_orphaned_if_revoked.sql
-- VERBATIM — T-15-03 / T-15-06): a definer function bypasses RLS, so the body's own gate
-- is the ONLY authorization. EACH function is `LANGUAGE plpgsql` + the definer marker +
-- an EMPTY search_path (which closes the search-path-hijack footgun — no unqualified
-- name resolves), with EVERY object reference `public.`-qualified, the FIRST
-- body statement the admin self-gate that raises 'Not authorized', and a
-- `GRANT EXECUTE … TO authenticated` footer (NEVER anon). Returns aggregates only.
--
-- FORWARD migration (after 018). No `db reset` required — runs forward with
-- `supabase migration up`.
-- =============================================================================

-- (1) Additive source columns (D-18). `referrer` + `country` already exist (001),
--     so this adds ONLY the two UTM columns. Both nullable, no backfill.
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS utm_medium TEXT;

-- An aggregate index backing the global per-day series + total-in-window operator
-- scans. (idx_page_views_portfolio (portfolio_id, created_at DESC) from 001 already
-- backs per-portfolio / owner reads; this one is for the cross-portfolio operator reads.)
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views (created_at DESC);

-- (2) total views in a fixed recent window (D-15/D-17). Aggregate scalar only.
CREATE OR REPLACE FUNCTION public.page_view_total_count(p_days INT DEFAULT 30)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Self-gate (DEFINER bypasses RLS — this is the REAL authorization).
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN (
    SELECT count(*) FROM public.page_views
     WHERE created_at >= now() - make_interval(days => p_days)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.page_view_total_count(INT) TO authenticated;

-- (3) top-N portfolios by views in the window — returns username + count (aggregates
--     only; never raw page_view rows). Joins page_views → portfolios → profiles.
CREATE OR REPLACE FUNCTION public.page_view_top_portfolios(p_days INT DEFAULT 30, p_limit INT DEFAULT 10)
RETURNS TABLE (username TEXT, views BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT pr.username, count(*)::bigint AS views
      FROM public.page_views v
      JOIN public.portfolios p ON p.id = v.portfolio_id
      JOIN public.profiles  pr ON pr.id = p.user_id
     WHERE v.created_at >= now() - make_interval(days => p_days)
     GROUP BY pr.username
     ORDER BY views DESC
     LIMIT p_limit;
END;
$$;
GRANT EXECUTE ON FUNCTION public.page_view_top_portfolios(INT, INT) TO authenticated;

-- (4) per-day views series (the trend the operator eyeballs). generate_series fills
--     empty days so the sparkline has a row per day across the window.
CREATE OR REPLACE FUNCTION public.page_view_daily_series(p_days INT DEFAULT 30)
RETURNS TABLE (day DATE, views BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    WITH days AS (
      SELECT generate_series(
        (now() - make_interval(days => p_days - 1))::date, now()::date, interval '1 day'
      )::date AS day
    )
    SELECT d.day, count(v.id)::bigint
      FROM days d
      LEFT JOIN public.page_views v ON v.created_at::date = d.day
     GROUP BY d.day
     ORDER BY d.day;
END;
$$;
GRANT EXECUTE ON FUNCTION public.page_view_daily_series(INT) TO authenticated;

-- (5) rate_limit_events grouped by bucket (abuse observability, ANLY-04). Counts only.
CREATE OR REPLACE FUNCTION public.rate_limit_events_by_bucket(p_days INT DEFAULT 7)
RETURNS TABLE (bucket TEXT, events BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT e.bucket, count(*)::bigint
      FROM public.rate_limit_events e
     WHERE e.created_at >= now() - make_interval(days => p_days)
     GROUP BY e.bucket
     ORDER BY count(*) DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rate_limit_events_by_bucket(INT) TO authenticated;

-- (6) report-volume per-day series (report spikes, ANLY-04). Same shape as (4) over
--     reports — the operator eyeballs the spike, no active alerting (D-15).
CREATE OR REPLACE FUNCTION public.report_volume_series(p_days INT DEFAULT 14)
RETURNS TABLE (day DATE, reports BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    WITH days AS (
      SELECT generate_series(
        (now() - make_interval(days => p_days - 1))::date, now()::date, interval '1 day'
      )::date AS day
    )
    SELECT d.day, count(r.id)::bigint
      FROM days d
      LEFT JOIN public.reports r ON r.created_at::date = d.day
     GROUP BY d.day
     ORDER BY d.day;
END;
$$;
GRANT EXECUTE ON FUNCTION public.report_volume_series(INT) TO authenticated;
