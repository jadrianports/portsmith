-- 004_rls_policies.sql
-- Phase 1 (Security & Data Foundation) — Plan 01-07 — handoff T4 (RLS policies)
--
-- FND-01: Row-Level Security is THE tenant boundary. Every one of the 12 tables
-- has RLS ENABLED and an explicit, minimal policy set. A table with RLS on and
-- NO policy denies all access by default — the safe failure mode — so the
-- server-only tables (messages/page_views/rate_limit_events) deliberately get NO
-- INSERT policy and the anon/authenticated client can never write them directly.
--
-- SOURCE OF TRUTH (transcribed from the corrected spec):
--   docs/02-security-rls.md "Table policies" — the per-table owner/public/admin
--     policy set, with the review corrections applied:
--       • public SELECT policies check `locked = false` (via portfolio_is_public)
--       • messages/page_views have NO public INSERT (ADR-004 — service-role only)
--       • username/column immutability is the trigger's job, NOT WITH CHECK
--   docs/decisions.md ADR-004 — messages/page_views written only by the
--     server-side service-role contact/render routes; no public INSERT.
--
-- DEPENDS ON:
--   001_initial_schema.sql — the 12 tables + owner-join columns
--     (portfolios.user_id; portfolio_settings/sections/blog_posts/messages/
--      page_views.portfolio_id; section_history.section_id -> sections.portfolio_id)
--   002_functions_triggers.sql — portfolio_is_public(p_portfolio_id UUID)
--     (SECURITY DEFINER STABLE; published = true AND deleted_at IS NULL AND
--      locked = false). Referenced by every public SELECT policy below.
--
-- SCOPE: ENABLE RLS + owner/public/admin POLICIES ONLY. The FND-02 public-read
-- column-safety layer — REVOKE anon table SELECT + column-level GRANT +
-- security_invoker=true public views — lands in 005_public_views.sql. This file
-- creates NO views, does NO REVOKE, and does NO column-level GRANT.
--
-- DEFENSE-IN-DEPTH (D-07): the base-table public SELECT policies created here on
-- profiles/portfolios/portfolio_settings/sections/blog_posts are RETAINED as the
-- THIRD security layer even though anon will read through the 005 views — with
-- security_invoker=true the anon caller's RLS still applies, so these policies
-- remain the independent backstop behind the column GRANT and the view column list.
--
-- APPLY DEFERRAL: Docker / the Supabase CLI are not installed on this machine, so
-- this migration is AUTHORED here and APPLIED in Plan 01-08 (the blocking schema
-- apply); the behavioural RLS proof (cross-tenant denial, no-anon-INSERT, the
-- FND-02 negative anon column-read) is the Plan 01-09 integration suite.

-- =============================================================================
-- Turn RLS ON for all 12 tables — no exceptions.
-- (A table with RLS on and no policy denies all by default — the safe default.)
-- =============================================================================
ALTER TABLE templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views        ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_history   ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- profiles
--   • Public SELECT — published = true AND deleted_at IS NULL AND locked = false
--   • Own SELECT    — auth.uid() = id (owner sees their profile even unpublished)
--   • Own UPDATE    — USING + WITH CHECK auth.uid() = id; COLUMN protection is the
--                     enforce_protected_profile_columns trigger's job, NOT WITH CHECK
--   • Admin SELECT / UPDATE — EXISTS (admin self-lookup)
--   • NO public/user INSERT or DELETE — INSERT is handle_new_user (SECURITY
--     DEFINER); deletion cascades from auth.users.
-- =============================================================================
CREATE POLICY "profiles public select"
  ON profiles FOR SELECT
  USING (published = true AND deleted_at IS NULL AND locked = false);

CREATE POLICY "profiles own select"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles own update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles admin select"
  ON profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

CREATE POLICY "profiles admin update"
  ON profiles FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- =============================================================================
-- portfolios
--   • Public SELECT — portfolio_is_public(id)
--   • Own ALL       — auth.uid() = user_id (USING + WITH CHECK)
-- =============================================================================
CREATE POLICY "portfolios public select"
  ON portfolios FOR SELECT
  USING (portfolio_is_public(id));

CREATE POLICY "portfolios own all"
  ON portfolios FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- portfolio_settings
--   • Public SELECT — portfolio_is_public(portfolio_id)
--   • Own ALL       — EXISTS join to portfolios owner
-- =============================================================================
CREATE POLICY "portfolio_settings public select"
  ON portfolio_settings FOR SELECT
  USING (portfolio_is_public(portfolio_id));

CREATE POLICY "portfolio_settings own all"
  ON portfolio_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM portfolios
    WHERE portfolios.id = portfolio_settings.portfolio_id
      AND portfolios.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM portfolios
    WHERE portfolios.id = portfolio_settings.portfolio_id
      AND portfolios.user_id = auth.uid()
  ));

-- =============================================================================
-- sections
--   • Public SELECT — visible = true AND portfolio_is_public(portfolio_id)
--     (hidden sections never appear publicly)
--   • Own ALL       — EXISTS join to portfolios owner
-- =============================================================================
CREATE POLICY "sections public select"
  ON sections FOR SELECT
  USING (visible = true AND portfolio_is_public(portfolio_id));

CREATE POLICY "sections own all"
  ON sections FOR ALL
  USING (EXISTS (
    SELECT 1 FROM portfolios
    WHERE portfolios.id = sections.portfolio_id
      AND portfolios.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM portfolios
    WHERE portfolios.id = sections.portfolio_id
      AND portfolios.user_id = auth.uid()
  ));

-- =============================================================================
-- blog_posts
--   • Public SELECT — published = true AND portfolio_is_public(portfolio_id)
--   • Own ALL       — EXISTS join to portfolios owner
-- =============================================================================
CREATE POLICY "blog_posts public select"
  ON blog_posts FOR SELECT
  USING (published = true AND portfolio_is_public(portfolio_id));

CREATE POLICY "blog_posts own all"
  ON blog_posts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM portfolios
    WHERE portfolios.id = blog_posts.portfolio_id
      AND portfolios.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM portfolios
    WHERE portfolios.id = blog_posts.portfolio_id
      AND portfolios.user_id = auth.uid()
  ));

-- =============================================================================
-- messages
--   • NO INSERT policy at all — inserts come ONLY from the contact API route
--     using the service-role key (which bypasses RLS). ADR-004: a public INSERT
--     policy would let anyone with the anon key POST straight to Supabase and
--     bypass Turnstile + rate limiting.
--   • Own SELECT / UPDATE / DELETE — EXISTS join to portfolios owner.
--     (UPDATE marks read; DELETE lets owners clear their inbox.)
-- =============================================================================
CREATE POLICY "messages own select"
  ON messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM portfolios
    WHERE portfolios.id = messages.portfolio_id
      AND portfolios.user_id = auth.uid()
  ));

CREATE POLICY "messages own update"
  ON messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM portfolios
    WHERE portfolios.id = messages.portfolio_id
      AND portfolios.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM portfolios
    WHERE portfolios.id = messages.portfolio_id
      AND portfolios.user_id = auth.uid()
  ));

CREATE POLICY "messages own delete"
  ON messages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM portfolios
    WHERE portfolios.id = messages.portfolio_id
      AND portfolios.user_id = auth.uid()
  ));

-- =============================================================================
-- page_views
--   • NO INSERT policy — logged server-side with the service-role key (ADR-004).
--   • Own SELECT — EXISTS join to portfolios owner.
-- =============================================================================
CREATE POLICY "page_views own select"
  ON page_views FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM portfolios
    WHERE portfolios.id = page_views.portfolio_id
      AND portfolios.user_id = auth.uid()
  ));

-- =============================================================================
-- templates
--   • Public SELECT — is_active = true
--   • Admin ALL     — role check
-- =============================================================================
CREATE POLICY "templates public select"
  ON templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "templates admin all"
  ON templates FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- =============================================================================
-- announcements
--   • Authenticated SELECT — is_active = true AND auth.uid() IS NOT NULL
--   • Admin ALL            — role check
-- =============================================================================
CREATE POLICY "announcements authenticated select"
  ON announcements FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

CREATE POLICY "announcements admin all"
  ON announcements FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- =============================================================================
-- reports
--   • Admin ALL only — inserts come from the keyword-flagging SECURITY DEFINER
--     function, never from a client; only admins read/triage.
-- =============================================================================
CREATE POLICY "reports admin all"
  ON reports FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- =============================================================================
-- section_history
--   • Own SELECT — join sections -> portfolios, check user_id = auth.uid()
--   • NO user INSERT / UPDATE / DELETE — populated only by the
--     save_section_history trigger (SECURITY DEFINER context).
-- =============================================================================
CREATE POLICY "section_history own select"
  ON section_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM sections
    JOIN portfolios ON portfolios.id = sections.portfolio_id
    WHERE sections.id = section_history.section_id
      AND portfolios.user_id = auth.uid()
  ));

-- =============================================================================
-- rate_limit_events
--   • NO client policies at all — read and written only by server-side
--     service-role code (ADR-005). RLS-enabled + no policy = deny-all = safe.
-- =============================================================================
-- (intentionally no policies)
