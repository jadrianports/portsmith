-- 029_analytics_events.sql
-- Phase 33 (Sharing, Analytics & Debt) — Plan 33-01.
--
-- A NET-NEW table for outbound-click / engagement events (ANLY-05 / D-09), sitting
-- BESIDE page_views — never inside it. D-09 / Pitfall 5: page_views and its route +
-- count queries are load-bearing and stay byte-untouched (no nullable event_type
-- column that would pollute every page_views COUNT(*)).
--
-- Mirrors the page_views security shape (001:207-216 + 004:222-228 + 005:187 WR-08):
--   • service-role route /api/event is the SOLE writer — NO public INSERT policy.
--   • owner reads their OWN events via the EXISTS-join own-SELECT policy (RLS boundary).
--   • anon gets a table-level SELECT REVOKE backstop (WR-08) — it is a PII-adjacent,
--     no-public-view table; anon must never read it.
--
-- category is a SOFT-ENUM (TEXT, NO CHECK) for social/contact/project/other (D-10),
-- derived SERVER-SIDE in /api/event from destination_host — never trusted from the
-- client. No raw IP, no UTM is ever persisted here (D-09).

-- =============================================================================
-- 1. analytics_events table  (a SEPARATE table beside page_views; D-09)
-- =============================================================================
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  destination_host TEXT,
  category TEXT NOT NULL,        -- soft-enum: social/contact/project/other (D-10) — NO CHECK
  path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- (portfolio_id, created_at DESC) supports the 30d owner aggregation (mirrors
-- idx_page_views_portfolio at 001:216).
CREATE INDEX idx_analytics_events_portfolio ON analytics_events(portfolio_id, created_at DESC);

-- =============================================================================
-- 2. RLS  (own-SELECT only; service-role route is the sole writer — D-09 / T-33-01)
-- =============================================================================
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Own SELECT — EXISTS join to portfolios owner (byte-mirror of "page_views own select",
-- 004:222-228). NO public INSERT policy: the /api/event service-role route is the ONLY
-- writer (bypasses RLS). The owner reads their OWN events through PostgREST as the
-- authenticated role.
CREATE POLICY "analytics_events own select"
  ON analytics_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM portfolios
    WHERE portfolios.id = analytics_events.portfolio_id
      AND portfolios.user_id = auth.uid()
  ));

-- =============================================================================
-- 3. Explicit base grants  (self-contained — do NOT rely on platform defaults)
-- =============================================================================
-- New public tables must GRANT their base privileges explicitly rather than lean on
-- the Supabase platform-default ALTER DEFAULT PRIVILEGES: a local `supabase db reset`
-- (and some CI/restore paths) do NOT reapply those defaults to freshly-created tables,
-- so the own-select RLS policy above would have no base SELECT to build on (42501).
-- service_role is the sole writer (the /api/event route, D-09); authenticated reads
-- its own rows via the own-select policy (RLS restricts rows; the grant enables access).
GRANT SELECT ON analytics_events TO authenticated;
GRANT INSERT, SELECT ON analytics_events TO service_role;

-- =============================================================================
-- 4. anon SELECT REVOKE backstop  (WR-08 defense-in-depth; T-33-01)
-- =============================================================================
-- This is a no-public-view, PII-adjacent table. Like page_views/messages (005:187),
-- REVOKE anon's base SELECT so a future stray "public read" policy or RLS regression
-- cannot expose events to anon. authenticated keeps its base SELECT (RLS restricts
-- rows; it does not grant table access — the own-select policy needs the base grant).
REVOKE SELECT ON analytics_events FROM anon;
