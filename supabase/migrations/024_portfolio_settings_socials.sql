-- =============================================================================
-- 024_portfolio_settings_socials.sql
-- Phase 24 (SET-01..04) — additive `socials` JSONB + `location` + `phone` on
-- `portfolio_settings`, backfilled from the five fixed `*_url` columns (D-04/D-05).
--
-- ADDITIVE ONLY — the site is LIVE (D-04). The 5 old `*_url` columns AND the existing
-- public-view columns are KEPT unchanged; the 4 live templates still read them until
-- P25 cuts the renderers over and removes them. NO DROP anywhere in this migration.
--
-- No Postgres CHECK on `socials` — Zod (`contactSocialsSettingsSchema`,
-- src/lib/validations/settings.ts) is the sole gate (D-01), consistent with the
-- schemaless-JSONB-gated-only-by-Zod convention for `sections.content`.
-- =============================================================================

-- 1) Additive columns. `socials` is NOT NULL DEFAULT '[]' so reads never null-check
--    the array shape; `location`/`phone` are nullable TEXT (free-form, D-10).
-- D-01
ALTER TABLE portfolio_settings
  ADD COLUMN IF NOT EXISTS socials  JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS phone    TEXT;

-- 2) One-time backfill: build the ordered socials array from the 5 fixed columns,
--    preserving the old fixed display order, SKIPPING null/empty, mapping
--    twitter_url -> platform 'x' (D-05). The `ord` 1..5 VALUES list pins the order;
--    the `WHERE ps.socials = '[]'` guard makes a re-run idempotent (cannot duplicate).
-- D-05
UPDATE portfolio_settings AS ps
SET socials = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('platform', src.platform, 'url', src.url) ORDER BY src.ord), '[]'::jsonb)
  FROM (
    VALUES
      (1, 'github',   ps.github_url),
      (2, 'linkedin', ps.linkedin_url),
      (3, 'x',        ps.twitter_url),   -- twitter_url -> 'x' (D-05)
      (4, 'dribbble', ps.dribbble_url),
      (5, 'website',  ps.website_url)
  ) AS src(ord, platform, url)
  WHERE src.url IS NOT NULL AND btrim(src.url) <> ''
)
WHERE ps.socials = '[]'::jsonb;   -- idempotent: only backfill untouched rows

-- 3) Extend the anon column GRANT + the public view with the new presentational
--    columns (D-15 — non-breaking). socials/location/phone are INTENDED-public
--    presentational data; no private column lives on this table (email/role/
--    storage_used_bytes/locked live on `profiles`). The OLD *_url columns +
--    email_public STAY in the view (P25 removes them when templates cut over).
--
--    CREATE OR REPLACE VIEW is safe here because the change is purely additive —
--    the new columns are APPENDED at the END of the select list (trailing-only,
--    Pitfall 5); Postgres rejects renaming/reordering/dropping existing view
--    columns under REPLACE, but allows trailing additions.
-- D-15
GRANT SELECT (socials, location, phone) ON portfolio_settings TO anon;

CREATE OR REPLACE VIEW public.public_portfolio_settings
  WITH (security_invoker = true) AS
  SELECT portfolio_id, theme_mode, visitor_theme_toggle, color_preset, font_preset,
         page_title, meta_description, og_image_url, favicon_url,
         github_url, linkedin_url, twitter_url, dribbble_url, website_url, email_public,
         socials, location, phone
  FROM public.portfolio_settings
  WHERE portfolio_is_public(portfolio_id);

GRANT SELECT ON public.public_portfolio_settings TO anon;
