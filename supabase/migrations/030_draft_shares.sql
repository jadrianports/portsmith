-- 030_draft_shares.sql
-- Phase 33 (Sharing, Analytics & Debt) — Plan 33-01.
--
-- The DB-backed, REVOCABLE draft-share token store (DIST-02 / D-01..D-03). A single
-- rotating link per portfolio: the PK on portfolio_id means an UPSERT overwrites the
-- token (D-03 — regenerate instantly kills the old token). Revoke = null revoked_at /
-- delete the row (D-01 — instant, server-side, never a stateless JWT denylist).
--
-- Token model (33-PATTERNS.md §030 / RESEARCH OQ-1 RESOLVED):
--   • portfolio_id PK → UPSERT-rotates the single link (D-03)
--   • token UNIQUE    → the recipient lookup key (D-01)
--   • expires_at      → the fixed ~7-day window, enforced on READ (D-02)
--   • revoked_at      → nullable; null = active (D-01)
--
-- Analog: 028_showcase_opt_in.sql — own-row RLS, NO protected-columns trigger carve-out
-- (this is a NEW table, not a profiles identity column; same reasoning 028 left
-- showcase_opt_in off the enforce_protected_profile_columns guard).
--
-- TWO read paths:
--   • owner generate/revoke  → AUTHENTICATED RLS (own_all policy; createClient(), never
--     service-role) via draft-share-action.ts (Plan 02).
--   • recipient token read   → supabaseAdmin (RLS bypassed — the recipient is anonymous,
--     has no session; the token IS the authz). The ONE sanctioned service-role read added
--     this phase, gated by a valid/non-expired/non-revoked token lookup (Plan 02).

-- =============================================================================
-- 1. draft_shares table  (1-row-per-portfolio; PK enables UPSERT-rotate; D-03)
-- =============================================================================
CREATE TABLE draft_shares (
  portfolio_id UUID PRIMARY KEY REFERENCES portfolios(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,            -- the recipient lookup key (D-01)
  expires_at TIMESTAMPTZ NOT NULL,       -- fixed ~7-day window, enforced on read (D-02)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ                 -- nullable; null = active (D-01)
);

-- =============================================================================
-- 2. RLS  (own_all — owner generate/revoke via authenticated RLS; D-01 / T-33-02)
-- =============================================================================
ALTER TABLE draft_shares ENABLE ROW LEVEL SECURITY;

-- Own ALL — EXISTS join to portfolios owner (mirror of the messages/page_views
-- own-policy join, 004:188-228). The owner generate/revoke write goes through
-- AUTHENTICATED RLS (createClient(), NEVER service-role). The token READ in Plan 02
-- uses supabaseAdmin (RLS bypassed — recipient has no session).
CREATE POLICY "draft_shares own all"
  ON draft_shares FOR ALL
  USING (EXISTS (
    SELECT 1 FROM portfolios
    WHERE portfolios.id = draft_shares.portfolio_id
      AND portfolios.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM portfolios
    WHERE portfolios.id = draft_shares.portfolio_id
      AND portfolios.user_id = auth.uid()
  ));

-- =============================================================================
-- 3. anon SELECT REVOKE backstop  (WR-08 defense-in-depth)
-- =============================================================================
-- draft_shares holds the opaque preview token; anon must never read it through
-- PostgREST. The recipient read is the supabaseAdmin (service-role) token-gated path,
-- not an anon table read. REVOKE the anon base SELECT as the defense-in-depth wall.
-- authenticated keeps its base SELECT so the own_all policy returns the owner's row.
REVOKE SELECT ON draft_shares FROM anon;
