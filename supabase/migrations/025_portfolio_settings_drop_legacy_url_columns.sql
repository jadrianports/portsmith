-- =============================================================================
-- 025_portfolio_settings_drop_legacy_url_columns.sql
-- Phase 25 (SET-05) — the FINAL cutover wave (templates-first, D-10): now that all
-- 4 live templates + every reader consume `settings.socials`/`email_public`/
-- `location`/`phone` (Plans 25-01 + 25-02), DROP the 5 legacy fixed `*_url` columns
-- from `portfolio_settings` AND remove them from the public view.
--
-- Forward-only, no pre-drop assertion gate (D-11 — the 024 backfill already moved
-- the data into `socials`; PITR covers the worst case).
--
-- MANDATORY ORDERING (Postgres rules, RESEARCH D.2 / CITED postgresql.org/docs
-- sql-createview.html):
--   (a) `CREATE OR REPLACE VIEW` can ONLY APPEND trailing columns — it cannot
--       REMOVE/reorder existing view columns. Removing a column => DROP VIEW + recreate.
--   (b) A base-table column a view depends on cannot be dropped while the view exists
--       (Postgres raises "cannot drop column … because other objects depend on it").
-- So: DROP VIEW → recreate WITHOUT the 5 *_url → re-GRANT anon → ALTER TABLE DROP COLUMN.
-- =============================================================================

-- 1) DROP the view: it depends on the 5 *_url columns we are about to drop, and we
--    cannot REMOVE columns from a view via CREATE OR REPLACE (only append). (D-10/D-11)
DROP VIEW IF EXISTS public.public_portfolio_settings;

-- 2) RECREATE the view WITHOUT the 5 `*_url` columns. Keep the EXACT intended public
--    allowlist: the non-secret presentational columns + email_public/socials/location/
--    phone. NO email/role/storage_used_bytes/locked (those live on `profiles`, not this
--    table) — the recreate must NOT widen exposure (V4 access control / CR-01 view
--    allowlist invariant, T-25-07). security_invoker preserved (the view runs as the
--    querying role so RLS + portfolio_is_public still gate it).
CREATE VIEW public.public_portfolio_settings
  WITH (security_invoker = true) AS
  SELECT portfolio_id, theme_mode, visitor_theme_toggle, color_preset, font_preset,
         page_title, meta_description, og_image_url, favicon_url,
         email_public, socials, location, phone
  FROM public.portfolio_settings
  WHERE portfolio_is_public(portfolio_id);

-- 3) RE-GRANT anon SELECT on the recreated view. MANDATORY: DROP VIEW dropped the
--    view's grant — omitting this 500s every public portfolio (the cookie-less anon
--    read returns permission-denied; Pitfall 2 / the "db reset drops role grants"
--    failure class, T-25-08). The per-column GRANT on portfolio_settings(socials,
--    location, phone) from 024 stays valid (those base columns aren't dropped).
GRANT SELECT ON public.public_portfolio_settings TO anon;

-- 4) NOW the base-table columns have no dependent view — drop the 5 legacy columns.
--    The 024 backfill already migrated their values into `socials` (twitter_url -> 'x').
ALTER TABLE portfolio_settings
  DROP COLUMN IF EXISTS github_url,
  DROP COLUMN IF EXISTS linkedin_url,
  DROP COLUMN IF EXISTS twitter_url,
  DROP COLUMN IF EXISTS dribbble_url,
  DROP COLUMN IF EXISTS website_url;
