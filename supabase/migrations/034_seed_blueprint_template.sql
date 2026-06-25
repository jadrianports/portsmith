-- =============================================================================
-- 034_seed_blueprint_template.sql
--
-- Ship public template #6 (live) — `blueprint` ("Blueprint"), the dark "engineering
-- bench" / oscilloscope single-scroll, a FAITHFUL 1:1 clone of the Lovable export
-- (`lovable-exports/blueprint/`). DATA only — a new `templates` ROW (no schema change) —
-- the SAME "a new template = a folder + a registry line + a seeded ROW" contract the
-- editorial (008) / aurora (010) / edgerunner-v2 (016) / atelier (032) seeds established.
--
-- A SINGLE forward-only INSERT. `blueprint` ships `visibility = 'public'` (operator
-- decision), so — UNLIKE the restricted edgerunner-v2 (016) — there is NO `template_grants`
-- row and NO portfolio switch step. It is a FRESH row no existing portfolio references;
-- `initialize_portfolio()` is unchanged (blueprint is operator-curated, opt-in via the
-- template switch).
--
-- CATEGORY = 'dev' (TCAT-01): the `templates.category` column exists after migration 033, so
-- this seed sets it directly in the INSERT (a fresh row would otherwise default to 'general').
-- Blueprint groups under the "Developer" picker header alongside edgerunner-v2.
--
-- PAGES (D-14/D-15): blueprint is the FIRST PUBLIC page-capable template — its spec opts into
-- the dedicated `/blog` + `/blog/[slug]` sub-routes (`"pages": ["blog"]`). The route gate reads
-- the LOCAL spec (`blueprint/spec.ts`); this seeded `spec.pages` is informational (Pitfall 6).
--
-- PINNED UUID (Option B — RESEARCH Pitfall 3/6). `templates.id` defaults to random, so an
-- unpinned seed would break the ISR slug resolve. The literal UUID THIS migration pins MUST
-- equal `registry.ts` TEMPLATE_UUIDS exactly:
--     blueprint = 00000000-0000-4000-8000-000000000007
-- (…0006 = atelier). If they diverge, `slugForTemplateId` falls back to 'minimal' (T-07-02).
--
-- IDEMPOTENCY. `ON CONFLICT (slug) DO UPDATE` refreshes name/description/visibility/category/
-- spec in place (a clean no-op when unchanged).
--
-- NOTE (Pitfall 6): the seeded `spec` JSONB is INFORMATIONAL — the render/field-gate path uses
-- the LOCAL `specRegistry` (`blueprint/spec.ts`), never this row. We still seed an accurate
-- shape: 13 supported types + 2 unsupported (gallery/moodboard — the image-wall creative types
-- the export does not ship) + `pages: ['blog']`; `['default']`-only presets.
--
-- DATA-only INSERT into the existing, already-platform-granted `templates` table — no new
-- table, so no new GRANT needed; no `src/types/database.ts` regen.
--
-- FORWARD migration (apply via `supabase migration up`, never `db reset`).
-- =============================================================================

INSERT INTO templates (id, slug, name, description, visibility, category, spec)
VALUES (
  '00000000-0000-4000-8000-000000000007',
  'blueprint',
  'Blueprint',
  'A dark "engineering bench" single-scroll — a blueprint-grid canvas, mono channel labels, PCB-trace dividers, and a single blueprint-blue accent. Includes a built-in blog.',
  'public',
  'dev',
  '{
    "sections": {
      "hero":           { "supported": true,  "fields": ["heading", "subheading", "cta_text", "cta_url", "background_image", "resume_url"] },
      "about":          { "supported": true,  "fields": ["bio", "skills", "avatar", "avatar_alt"] },
      "skills":         { "supported": true,  "fields": ["heading", "groups"] },
      "metrics":        { "supported": true,  "fields": ["heading", "subheading", "items"] },
      "projects":       { "supported": true,  "fields": ["heading", "items", "title", "description", "image", "image_alt", "tech_stack", "tags", "live_url", "repo_url"] },
      "case_study":     { "supported": true,  "fields": ["heading", "items"] },
      "experience":     { "supported": true,  "fields": ["heading", "items", "company", "role", "start_date", "end_date", "description", "highlights"] },
      "education":      { "supported": true,  "fields": ["heading", "items"] },
      "certifications": { "supported": true,  "fields": ["heading", "items"] },
      "services":       { "supported": true,  "fields": ["heading", "subheading", "items"] },
      "testimonials":   { "supported": true,  "fields": ["heading", "items", "name", "quote", "avatar", "avatar_alt", "stars", "company"] },
      "blog_preview":   { "supported": true,  "fields": ["heading", "items"] },
      "contact":        { "supported": true,  "fields": ["heading", "subheading"] },
      "gallery":        { "supported": false, "fields": [] },
      "moodboard":      { "supported": false, "fields": [] }
    },
    "color_presets": ["default"],
    "font_presets":  ["default"],
    "pages": ["blog"]
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      visibility = EXCLUDED.visibility,
      category = EXCLUDED.category,
      spec = EXCLUDED.spec;
