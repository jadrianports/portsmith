-- =============================================================================
-- 032_seed_atelier_template.sql
--
-- 36-02 / CTPL-01: ship public template #5 (live) — `atelier` ("Atelier"), the
-- gallery-forward creative template (v2.8 "Show the Work"), a FAITHFUL 1:1 clone of the
-- dark-editorial Lovable export (`lovable-exports/atelier/`). This migration adds DATA
-- only — a new `templates` ROW (never a new column, no schema change) — the SAME "a new
-- template = a folder + a registry line + a seeded ROW, NO schema change" contract the
-- editorial (008) / aurora (010) / edgerunner-v2 (016) seeds established.
--
-- A SINGLE, SIMPLE forward-only INSERT. `atelier` ships `visibility = 'public'` (D-10
-- default), so — UNLIKE the restricted edgerunner-v2 (016) — there is NO `template_grants`
-- row and NO portfolio switch step. It is a FRESH row no existing portfolio references,
-- and `initialize_portfolio()` is unchanged (new accounts stay on their bootstrap default;
-- atelier is operator-curated, opt-in via the template switch).
--
-- PINNED UUID (Option B — RESEARCH Pitfall 3 + Pitfall 6).
-- `templates.id` defaults to `gen_random_uuid()`, so an unpinned seed would get a RANDOM
-- id per environment and the public read could not resolve the slug WITHOUT a
-- request-time `templates` lookup (which breaks the ISR'd `/[username]` page). The public
-- read maps `portfolios.template_id → slug` from the STATIC map co-located with the
-- registry (`src/components/templates/registry.ts` TEMPLATE_UUIDS). The literal UUID THIS
-- migration pins MUST equal that map exactly:
--     atelier = 00000000-0000-4000-8000-000000000006
-- (…0004 retired, …0005 = edgerunner-v2). If they ever diverge, `slugForTemplateId` falls
-- back to `'minimal'` and the switch path silently degrades (T-07-02).
--
-- IDEMPOTENCY. The seed uses `ON CONFLICT (slug) DO UPDATE`, so re-applying 032 refreshes
-- the name/description/visibility/spec in place (a clean no-op when unchanged).
--
-- NOTE (Pitfall 6): the seeded `spec` JSONB is INFORMATIONAL. The render/field-gate path
-- uses the LOCAL `specRegistry` (`src/components/templates/atelier/spec.ts`), never this
-- row. We still seed an accurate shape mirroring `atelier/spec.ts`: 8 supported types
-- (hero/about/gallery/case_study/projects/testimonials/contact/moodboard — the image-first
-- set) + 7 unsupported (skills/experience/education/metrics/services/certifications/
-- blog_preview); `['default']`-only presets.
--
-- DATA-only INSERT into the existing, already-platform-granted `templates` table — no new
-- table, so no new GRANT needed; no `src/types/database.ts` regen.
--
-- FORWARD migration (apply via `supabase migration up`, never `db reset`).
-- =============================================================================

INSERT INTO templates (id, slug, name, description, visibility, spec)
VALUES (
  '00000000-0000-4000-8000-000000000006',
  'atelier',
  'Atelier',
  'A dark, image-first editorial single-scroll — a gallery wall, case studies, and oversized type with an acid-green accent.',
  'public',
  '{
    "sections": {
      "hero":           { "supported": true,  "fields": ["heading", "subheading", "cta_text", "cta_url", "background_image"] },
      "about":          { "supported": true,  "fields": ["bio", "avatar", "avatar_alt"] },
      "gallery":        { "supported": true,  "fields": ["heading", "items"] },
      "case_study":     { "supported": true,  "fields": ["heading", "items"] },
      "projects":       { "supported": true,  "fields": ["title", "description", "image", "image_alt", "tech_stack", "live_url", "repo_url"] },
      "testimonials":   { "supported": true,  "fields": ["name", "quote", "avatar", "avatar_alt", "stars", "company"] },
      "contact":        { "supported": true,  "fields": ["heading", "subheading"] },
      "moodboard":      { "supported": true,  "fields": ["heading", "subheading", "items", "palette"] },
      "skills":         { "supported": false, "fields": [] },
      "experience":     { "supported": false, "fields": [] },
      "education":      { "supported": false, "fields": [] },
      "metrics":        { "supported": false, "fields": [] },
      "services":       { "supported": false, "fields": [] },
      "certifications": { "supported": false, "fields": [] },
      "blog_preview":   { "supported": false, "fields": [] }
    },
    "color_presets": ["default"],
    "font_presets":  ["default"]
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      visibility = EXCLUDED.visibility,
      spec = EXCLUDED.spec;
