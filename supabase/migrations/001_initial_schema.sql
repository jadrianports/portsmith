-- 001_initial_schema.sql
-- Phase 1 (Security & Data Foundation) — Plan 01-05 — handoff T2
--
-- The complete 12-table Portsmith schema: columns, CHECK constraints, indexes,
-- and foreign keys, plus the idempotent `minimal` template seed row.
--
-- SOURCE OF TRUTH: idea/portsmith-handoff/portsmith-handoff/docs/01-data-model.md
-- (transcribed verbatim) with the design-review changes from docs/decisions.md:
--   ADR-012  profiles.bio -> profiles.headline (short SEO/card tagline)
--   ADR-005  rate_limit_events table added (Postgres-based rate limiting)
--   ADR-009  blog_posts.body is Tiptap JSON (JSONB), not HTML
--   ADR-011  sections keeps UNIQUE(portfolio_id, type) for the MVP (deliberate + reversible)
--
-- CMS-08 (soft enum): sections.type is TEXT NOT NULL with NO enumerating CHECK
-- constraint. The Zod discriminated union (Plan 01-03) is the sole gate for
-- section types, so a future profession's section type needs no migration.
--
-- Phase-1 exclusions (per docs/01 + CONTEXT D-04): NO `username_set` column on
-- profiles (Phase 2, social-login only) and NO `turnstile_token` column on
-- messages (the spent token has no storage value).
--
-- SCOPE: This migration creates TABLES + INDEXES + the minimal template seed ONLY.
-- It enables NO RLS, creates NO policies, NO functions, NO triggers, and NO
-- storage buckets — those land in Plans 01-06 (functions/triggers/storage) and
-- 01-07 (RLS + security_invoker public views + column grants).
--
-- Migration order (FK dependency order, per docs/01 "Migration order"):
--   templates -> profiles -> portfolios -> portfolio_settings -> sections ->
--   blog_posts -> messages -> rate_limit_events -> page_views -> announcements ->
--   reports -> section_history

-- =============================================================================
-- 1. templates  (admin-managed; must exist before portfolios — FK target)
-- =============================================================================
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  spec JSONB NOT NULL,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  three_js_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. profiles  (extends auth.users; row created on signup by handle_new_user — Plan 06)
--    Protected columns (guarded by the Plan 06 trigger): username, role, locked,
--    locked_reason, storage_used_bytes, deleted_at, email, created_at.
-- =============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL CHECK (
    length(username) >= 3
    AND length(username) <= 30
    AND username ~ '^[a-z][a-z0-9-]*$'
  ),
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  headline TEXT,                        -- short tagline; SEO + cards (max 500, enforced in Zod)
  avatar_url TEXT,
  resume_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  published BOOLEAN NOT NULL DEFAULT false,
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_reason TEXT,
  storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_deleted ON profiles(deleted_at) WHERE deleted_at IS NOT NULL;

-- =============================================================================
-- 3. portfolios  (one per user — UNIQUE on user_id enforces the free-tier cap)
-- =============================================================================
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. portfolio_settings  (theme, fonts, SEO, social links — one row per portfolio)
--    `email_public` is the INTENDED-public contact email; it is distinct from the
--    private `profiles.email` that must never leak through the public views.
-- =============================================================================
CREATE TABLE portfolio_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL UNIQUE REFERENCES portfolios(id) ON DELETE CASCADE,
  theme_mode TEXT NOT NULL DEFAULT 'dark' CHECK (theme_mode IN ('light', 'dark')),
  visitor_theme_toggle BOOLEAN NOT NULL DEFAULT true,
  color_preset TEXT NOT NULL DEFAULT 'default',
  font_preset TEXT NOT NULL DEFAULT 'default',
  page_title TEXT,
  meta_description TEXT,
  og_image_url TEXT,
  favicon_url TEXT,
  github_url TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,
  dribbble_url TEXT,
  website_url TEXT,
  email_public TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 5. sections  (up to one section per type per portfolio; content is JSONB)
--    CMS-08: `type` is TEXT NOT NULL with NO enumerating CHECK — the Zod union
--    (Plan 01-03) is the sole gate. The only constraint here is the deliberate,
--    reversible UNIQUE(portfolio_id, type) (ADR-011).
-- =============================================================================
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(portfolio_id, type)
);

CREATE INDEX idx_sections_portfolio ON sections(portfolio_id);

-- =============================================================================
-- 6. blog_posts  (Phase 2 — schema defined now for FK stability)
--    `body` is Tiptap document JSON (ADR-009), not HTML.
-- =============================================================================
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  body JSONB NOT NULL,                  -- Tiptap document JSON, not HTML
  excerpt TEXT,
  cover_image_url TEXT,
  cover_image_alt TEXT,
  meta_title TEXT,
  meta_description TEXT,
  tags TEXT[] DEFAULT '{}',
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(portfolio_id, slug)
);

CREATE INDEX idx_blog_posts_portfolio ON blog_posts(portfolio_id);
CREATE INDEX idx_blog_posts_published ON blog_posts(portfolio_id, published, published_at DESC);

-- =============================================================================
-- 7. messages  (contact-form submissions; written ONLY by the service-role
--    contact route — there is no public INSERT policy. ADR-004.)
--    The draft's `turnstile_token` column is intentionally dropped.
-- =============================================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_portfolio ON messages(portfolio_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages(portfolio_id, is_read) WHERE is_read = false;

-- =============================================================================
-- 8. rate_limit_events  (ADR-005 — Postgres-based rate limiting, no external infra)
-- =============================================================================
CREATE TABLE rate_limit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket TEXT NOT NULL,                 -- e.g. 'content_save', 'signup'
  subject TEXT NOT NULL,                -- the thing being limited (user_id, ip hash, portfolio_id)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_lookup ON rate_limit_events(bucket, subject, created_at DESC);

-- =============================================================================
-- 9. page_views  (Phase 3 — schema defined now; no public INSERT policy, logged
--    server-side during render. Not used in the MVP.)
-- =============================================================================
CREATE TABLE page_views (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  referrer TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_views_portfolio ON page_views(portfolio_id, created_at DESC);

-- =============================================================================
-- 10. announcements  (admin panel — Phase 3)
-- =============================================================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 11. reports  (admin panel — Phase 3)
-- =============================================================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('auto_flagged','hate_speech','illegal_content','spam','harassment','other')),
  details TEXT,
  reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_unreviewed ON reports(reviewed, created_at DESC) WHERE reviewed = false;

-- =============================================================================
-- 12. section_history  (populated by the save_section_history trigger — Plan 06;
--     pruned to the 10 most-recent rows per section. Revert UI is Phase 2.)
-- =============================================================================
CREATE TABLE section_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_section_history_section ON section_history(section_id, created_at DESC);

-- =============================================================================
-- Seed: the `minimal` template
--
-- Inserted by the migration ITSELF (not only by seed.sql) because a portfolio
-- cannot initialize without a template row (initialize_portfolio, docs/03), and
-- production must have the minimal template, not just the dev seed.
--
-- Idempotent via ON CONFLICT (slug) DO NOTHING so it is safe on re-`db reset`
-- and safe alongside any seed.sql that inserts the same row.
--
-- The `spec` JSONB supports all seven MVP section types (hero, about, projects,
-- testimonials, experience, contact, blog_preview) and declares the color/font
-- presets, exactly as in docs/01-data-model.md.
-- =============================================================================
INSERT INTO templates (slug, name, description, spec)
VALUES (
  'minimal',
  'Minimal',
  'The default single-scroll portfolio template — clean, developer-flavored, and hard to make ugly.',
  '{
    "sections": {
      "hero":         { "supported": true, "fields": ["heading", "subheading", "cta_text", "cta_url", "background_image"] },
      "about":        { "supported": true, "fields": ["bio", "skills", "avatar", "avatar_alt"] },
      "projects":     { "supported": true, "fields": ["title", "description", "image", "image_alt", "tech_stack", "live_url", "repo_url"] },
      "testimonials": { "supported": true, "fields": ["name", "quote", "avatar", "avatar_alt", "stars", "company"] },
      "experience":   { "supported": true, "fields": ["company", "role", "start_date", "end_date", "description"] },
      "contact":      { "supported": true, "fields": ["heading", "subheading"] },
      "blog_preview": { "supported": true, "fields": ["heading", "post_count"] }
    },
    "color_presets": ["default", "ocean", "warm", "monochrome"],
    "font_presets":  ["default", "mono", "serif", "editorial"]
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
