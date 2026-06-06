-- =============================================================================
-- 010_seed_aurora_template.sql
--
-- 11-04 Wave-C / PIPE-07: ship public template #3 — `aurora` ("Aurora Rose"), the
-- real Lovable→Portsmith dogfood (the `marketing-girl` export, translated). This
-- migration adds DATA only — a new `templates` ROW (never a new column, no schema
-- change) — the SAME "a new template = a folder + a registry line + a seeded ROW, NO
-- schema change" contract the editorial seed (008) established.
--
-- This is a SINGLE, SIMPLE forward-only INSERT (unlike 008): there is NO FK re-pin
-- dance (the minimal id was already pinned to …0001 by 008; aurora is a FRESH row no
-- existing portfolio references) and NO `initialize_portfolio()` change (new accounts
-- STAY on editorial — D-P7-09: aurora is operator-curated, opt-in via the template
-- switch, never a bootstrap default).
--
-- PINNED UUID (Option B — D-P7-13 / RESEARCH Pitfall 3 + Pitfall 6).
-- `templates.id` defaults to `gen_random_uuid()` (`001:36`), so an unpinned seed would
-- get a RANDOM id per environment and the public read could not resolve the slug
-- WITHOUT a request-time `templates` lookup (which breaks the ISR'd `/[username]` page).
-- The public read maps `portfolios.template_id → slug` from the STATIC map co-located
-- with the registry (`src/components/templates/registry.ts` TEMPLATE_UUIDS). The literal
-- UUID THIS migration pins MUST equal that map exactly:
--     aurora = 00000000-0000-4000-8000-000000000003
-- (after minimal …0001 / editorial …0002). If they ever diverge, `slugForTemplateId`
-- falls back to `'minimal'` and the switch path silently degrades (T-07-02).
--
-- IDEMPOTENCY. The seed uses `ON CONFLICT (slug) DO NOTHING`, so re-applying 010 is a
-- clean no-op (INSERT 0).
--
-- NOTE (Pitfall 6): the seeded `spec` JSONB is INFORMATIONAL. The render/field-gate path
-- uses the LOCAL `specRegistry` (`src/components/templates/aurora/spec.ts`), never this
-- row. We still seed an accurate shape mirroring `aurora/spec.ts`: the 12 supported
-- soft-enum types (the BROADEST template — all except `blog_preview`), incl. the 5
-- marketer-vertical types (education/metrics/services/moodboard/certifications, the
-- 11-04 Step-C1 additions); `blog_preview` unsupported (D-19); `['default']`-only presets.
--
-- FORWARD migration (the local stack already has 001-009 applied). No `db reset`.
-- =============================================================================

INSERT INTO templates (id, slug, name, description, spec)
VALUES (
  '00000000-0000-4000-8000-000000000003',
  'aurora',
  'Aurora',
  'A warm, rosy single-scroll marketer template — gradient accents, soft glass cards, and the broadest section coverage.',
  '{
    "sections": {
      "hero":           { "supported": true,  "fields": ["heading", "subheading", "cta_text", "cta_url", "background_image"] },
      "about":          { "supported": true,  "fields": ["bio", "avatar", "avatar_alt"] },
      "education":      { "supported": true,  "fields": ["heading", "items"] },
      "experience":     { "supported": true,  "fields": ["company", "role", "start_date", "end_date", "description"] },
      "metrics":        { "supported": true,  "fields": ["heading", "subheading", "items"] },
      "projects":       { "supported": true,  "fields": ["title", "description", "image", "image_alt", "tech_stack", "live_url", "repo_url"] },
      "services":       { "supported": true,  "fields": ["heading", "subheading", "items"] },
      "skills":         { "supported": true,  "fields": ["heading", "groups"] },
      "testimonials":   { "supported": true,  "fields": ["name", "quote", "avatar", "avatar_alt", "stars", "company"] },
      "moodboard":      { "supported": true,  "fields": ["heading", "subheading", "items", "palette"] },
      "certifications": { "supported": true,  "fields": ["heading", "items"] },
      "contact":        { "supported": true,  "fields": ["heading", "subheading"] },
      "blog_preview":   { "supported": false, "fields": [] }
    },
    "color_presets": ["default"],
    "font_presets":  ["default"]
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
