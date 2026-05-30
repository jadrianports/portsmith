-- 005_public_views.sql
-- Phase 1 (Security & Data Foundation) — Plan 01-07 — FND-02 (public-read column safety)
--
-- THE signature security control of Phase 1. Anonymous public reads are exposed
-- ONLY through `security_invoker = true` views that select PUBLIC columns
-- exclusively, over a base surface where anon has a table-wide SELECT REVOKE plus
-- a column-level GRANT of public columns only. This SUPERSEDES the handoff's
-- base-table public-SELECT design (docs/02-security-rls.md), which leaks
-- email / role / storage_used_bytes (CONTEXT D-05).
--
-- THE THREE-LAYER FND-02 STACK (per 01-RESEARCH.md "security_invoker view +
-- column GRANT + base RLS" — verified against the PostgreSQL CREATE VIEW docs):
--   LAYER 1  REVOKE SELECT ON <base> FROM anon  (D-06: no table-wide anon access)
--            + GRANT SELECT (<public cols only>) ON <base> TO anon.
--            REQUIRED: a security_invoker view resolves base-relation access as
--            the INVOKING (anon) role "as if the base relations had been
--            referenced directly" — so a full-table REVOKE *alone* makes the view
--            return nothing for anon (01-RESEARCH.md Pitfall 1). The column GRANT
--            threads the needle: anon can reach EXACTLY the public columns and no
--            more, even with a crafted `select=*` straight at the base table.
--   LAYER 2  CREATE VIEW public.<view> WITH (security_invoker = true) AS
--            SELECT <public cols only> ... WHERE <public-visibility predicate>;
--            + GRANT SELECT ON public.<view> TO anon (the invoker still needs
--            SELECT on the view object itself). NEVER the DEFINER variant — a
--            definer-rights view runs as the (superuser) owner and BYPASSES base
--            RLS, re-opening the exact leak D-05 forbids (01-RESEARCH.md Pitfall 2).
--   LAYER 3  base-table RLS public policies from 004_rls_policies.sql are RETAINED
--            (D-07 defense-in-depth). With security_invoker=true the anon caller's
--            RLS still applies through the view — the third independent layer. This
--            file does NOT create, alter, or drop any RLS policy.
--
-- DEPENDS ON:
--   001_initial_schema.sql        — profiles / portfolios / portfolio_settings /
--                                    sections columns (the public vs private split).
--   002_functions_triggers.sql    — portfolio_is_public(p_portfolio_id UUID)
--                                    (SECURITY DEFINER STABLE; published=true AND
--                                     deleted_at IS NULL AND locked=false).
--   004_rls_policies.sql          — the retained base-table RLS public policies
--                                    (LAYER 3). RLS must already be enabled.
--
-- PRIVATE COLUMNS THAT MUST NEVER REACH ANON (tests/integration/_setup.ts
-- PRIVATE_PROFILE_COLUMNS): email, role, storage_used_bytes, locked,
-- locked_reason, deleted_at, created_at (+ updated_at). NONE of these appear in
-- any view SELECT list or in any anon column GRANT below. The Plan 01-09
-- negative test (anon `select=*` → KEY ABSENCE) is the acceptance gate (D-08).
--
-- email_public CAVEAT: portfolio_settings.email_public is the INTENDED-public
-- contact email and IS exposed; the private profiles.email is the one that must
-- never leak. They are different columns on different tables — do not confuse them.
--
-- APPLY DEFERRAL: Docker / the Supabase CLI are not installed on this machine, so
-- this migration is AUTHORED here and APPLIED in Plan 01-08 (the blocking schema
-- apply); behavioural proof (the FND-02 negative anon column-read, cross-tenant
-- denial, no-anon-INSERT) is the Plan 01-09 RLS integration suite.

-- =============================================================================
-- public_profiles
--   Public columns: id, username, display_name, headline, avatar_url,
--                   resume_url, published.
--   EXCLUDES (private): email, role, locked, locked_reason, storage_used_bytes,
--                       deleted_at, created_at, updated_at.
--   Visibility: published = true AND deleted_at IS NULL AND locked = false
--               (the same public-visibility predicate as portfolio_is_public).
-- =============================================================================
REVOKE SELECT ON public.profiles FROM anon;
GRANT  SELECT (id, username, display_name, headline, avatar_url, resume_url, published)
       ON public.profiles TO anon;

CREATE VIEW public.public_profiles
  WITH (security_invoker = true) AS
  SELECT id, username, display_name, headline, avatar_url, resume_url, published
  FROM public.profiles
  WHERE published = true
    AND deleted_at IS NULL
    AND locked = false;

GRANT SELECT ON public.public_profiles TO anon;

-- =============================================================================
-- public_portfolios
--   Public columns: id, user_id, template_id, created_at.
--     (user_id is the FK already exposed everywhere — needed to join the public
--      surfaces; it is not sensitive. No private columns exist on this table.)
--   Visibility: portfolio_is_public(id)  — only published/non-deleted/non-locked.
-- =============================================================================
REVOKE SELECT ON public.portfolios FROM anon;
GRANT  SELECT (id, user_id, template_id, created_at)
       ON public.portfolios TO anon;

CREATE VIEW public.public_portfolios
  WITH (security_invoker = true) AS
  SELECT id, user_id, template_id, created_at
  FROM public.portfolios
  WHERE portfolio_is_public(id);

GRANT SELECT ON public.public_portfolios TO anon;

-- =============================================================================
-- public_portfolio_settings
--   Public columns: portfolio_id (join key) + all presentational columns
--                   (theme/color/font/SEO/social/email_public).
--     email_public is INTENDED public; profiles.email is the private one.
--   No private columns exist on this table (no id needed publicly; portfolio_id
--   is the join key). Visibility: portfolio_is_public(portfolio_id).
-- =============================================================================
REVOKE SELECT ON public.portfolio_settings FROM anon;
GRANT  SELECT (
         portfolio_id, theme_mode, visitor_theme_toggle, color_preset, font_preset,
         page_title, meta_description, og_image_url, favicon_url,
         github_url, linkedin_url, twitter_url, dribbble_url, website_url, email_public
       )
       ON public.portfolio_settings TO anon;

CREATE VIEW public.public_portfolio_settings
  WITH (security_invoker = true) AS
  SELECT portfolio_id, theme_mode, visitor_theme_toggle, color_preset, font_preset,
         page_title, meta_description, og_image_url, favicon_url,
         github_url, linkedin_url, twitter_url, dribbble_url, website_url, email_public
  FROM public.portfolio_settings
  WHERE portfolio_is_public(portfolio_id);

GRANT SELECT ON public.public_portfolio_settings TO anon;

-- =============================================================================
-- public_sections
--   Public columns: id, portfolio_id, type, sort_order, visible, content.
--   Visibility: visible = true AND portfolio_is_public(portfolio_id)
--     — hidden (visible=false) sections NEVER appear publicly, even on an
--       otherwise public portfolio (guards the "hidden sections are private" test).
-- =============================================================================
REVOKE SELECT ON public.sections FROM anon;
GRANT  SELECT (id, portfolio_id, type, sort_order, visible, content)
       ON public.sections TO anon;

CREATE VIEW public.public_sections
  WITH (security_invoker = true) AS
  SELECT id, portfolio_id, type, sort_order, visible, content
  FROM public.sections
  WHERE visible = true
    AND portfolio_is_public(portfolio_id);

GRANT SELECT ON public.public_sections TO anon;

-- =============================================================================
-- public_blog_posts  (authored now for symmetry — 01-RESEARCH.md Open Question 2)
--   Blog is a Phase 2 feature, but the public read surface is authored here so the
--   topology is consistent and the Layer-2 blog read assertion can exist. Same
--   three-layer stack as the four required surfaces.
--   Public columns: id, portfolio_id, title, slug, body, excerpt,
--                   cover_image_url, cover_image_alt, meta_title,
--                   meta_description, tags, published_at.
--     EXCLUDES the draft-only `published` flag and internal created_at/updated_at.
--   Visibility: published = true AND portfolio_is_public(portfolio_id).
-- =============================================================================
REVOKE SELECT ON public.blog_posts FROM anon;
GRANT  SELECT (
         id, portfolio_id, title, slug, body, excerpt,
         cover_image_url, cover_image_alt, meta_title, meta_description,
         tags, published_at
       )
       ON public.blog_posts TO anon;

CREATE VIEW public.public_blog_posts
  WITH (security_invoker = true) AS
  SELECT id, portfolio_id, title, slug, body, excerpt,
         cover_image_url, cover_image_alt, meta_title, meta_description,
         tags, published_at
  FROM public.blog_posts
  WHERE published = true
    AND portfolio_is_public(portfolio_id);

GRANT SELECT ON public.public_blog_posts TO anon;
