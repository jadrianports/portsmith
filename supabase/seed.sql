-- seed.sql
-- Phase 1 (Security & Data Foundation) — Plan 01-08 — handoff T6 (dev seed)
--
-- Loaded automatically after migrations during `supabase db reset`
-- (config.toml: [db.seed] enabled = true, sql_paths = ["./seed.sql"]).
--
-- PURPOSE: local-development fixtures that the Layer-2 RLS integration suite
-- (Plan 01-09) can rely on. Per 01-RESEARCH.md Open Question 3 (RESOLVED), the
-- two RLS test users (A and B) are NOT seeded here — they are created at test
-- time by `tests/integration/_setup.ts` via `auth.admin.createUser(...)`, which
-- exercises the real `handle_new_user` trigger and confirmed email flow. Seeding
-- `auth.users` directly here would bypass that trigger and is therefore avoided.
--
-- So seed.sql provides ONLY the non-auth fixture every local stack needs: the
-- `minimal` template row. (A portfolio cannot initialize without a template —
-- see docs/03 initialize_portfolio.)
--
-- IDEMPOTENT: every statement uses `ON CONFLICT ... DO NOTHING` so repeated
-- `supabase db reset` runs are safe, and this is harmless alongside migration
-- 001's identical minimal-template insert (same `ON CONFLICT (slug) DO NOTHING`
-- shape — whichever runs first wins, the other no-ops).

-- =============================================================================
-- minimal template (mirrors 001_initial_schema.sql; idempotent on slug)
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
