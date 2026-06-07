-- =============================================================================
-- 016_seed_edgerunner_v2_template.sql
-- Make `edgerunner-v2` the founder's DURABLE live template (supersedes 015's v1).
--
-- CONTEXT. 015 seeded `edgerunner` (v1, …0004, restricted) and switched the founder onto
-- it. `edgerunner-v2` (…0005) is the bar-for-bar faithful synthwave clone that REPLACES v1
-- as the founder's exclusive template. Before this migration the v2 row + founder switch
-- lived ONLY in a one-off script (`scripts/_v2-switch.mjs`), so a fresh `db reset` reverted
-- the founder to v1. This migration bakes v2 into the migration history so the assignment
-- is durable + reproducible. DATA only (one `templates` row + a grant + a switch) — the
-- same "a new template = a folder + a registry line + a seeded ROW, NO schema change"
-- contract 010/013/015 established.
--
-- PINNED UUID (must equal registry TEMPLATE_UUIDS['edgerunner-v2']):
--     edgerunner-v2 = 00000000-0000-4000-8000-000000000005
-- If they diverge, `slugForTemplateId` falls back to 'minimal' and the public read degrades.
--
-- ORDERING LANDMINE (same as 015) — GRANT (Step 2) BEFORE SWITCH (Step 3). Both key off the
-- portfolio currently on v1 …0004; if Step 3 ran first the grant SELECT would match zero rows
-- and the founder would be ungranted on his own restricted template (GATE-03 auto-fallback).
--
-- WHY DO UPDATE (not 015's DO NOTHING): the local stack already has a v2 row that the one-off
-- script inserted as visibility 'public'. ON CONFLICT (slug) DO UPDATE reconciles that row to
-- the canonical 'restricted' + the accurate spec, so re-applying converges to the correct
-- state whether the row pre-exists (local) or not (fresh reset). Idempotent either way.
--
-- v1 FATE: `edgerunner` (…0004) is left in place (registry still wires it; the row + the
-- founder's v1 grant stay) — it is now an ORPHANED restricted template with no portfolio on
-- it. Fully removing v1 (registry + folder + row) is a separate, optional cleanup.
--
-- SPEC (informational — the render uses the LOCAL specRegistry, src/.../edgerunner-v2/spec.ts;
-- this mirrors it): hero/about/experience/projects/skills/services/contact/blog_preview
-- supported; metrics folded into About (unsupported); testimonials unsupported.
--
-- FORWARD migration (no `db reset` — a reset wipes the founder seed; apply via `migration up`).
-- =============================================================================

-- ── Step 1 — UPSERT the edgerunner-v2 row (restricted, exclusive to the founder). ──
INSERT INTO templates (id, slug, name, description, visibility, spec)
VALUES (
  '00000000-0000-4000-8000-000000000005',
  'edgerunner-v2',
  'Edgerunner v2',
  'A bar-for-bar faithful synthwave single-scroll — neon, a live terminal HUD, an animated city, syntax-highlighted writing, and dedicated /blog + /services pages. The founder''s exclusive redesign (supersedes Edgerunner v1).',
  'restricted',
  '{
    "sections": {
      "hero":         { "supported": true,  "fields": ["heading", "subheading", "cta_text", "cta_url", "background_image"] },
      "about":        { "supported": true,  "fields": ["bio", "avatar", "avatar_alt"] },
      "metrics":      { "supported": false, "fields": [] },
      "experience":   { "supported": true,  "fields": ["heading", "subheading", "items"] },
      "projects":     { "supported": true,  "fields": ["heading", "subheading", "items"] },
      "skills":       { "supported": true,  "fields": ["heading", "subheading", "groups"] },
      "services":     { "supported": true,  "fields": ["heading", "subheading", "items"] },
      "contact":      { "supported": true,  "fields": ["heading", "subheading"] },
      "blog_preview": { "supported": true,  "fields": ["heading", "items"] },
      "testimonials": { "supported": false, "fields": [] }
    },
    "color_presets": ["default"],
    "font_presets":  ["default"]
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      visibility  = EXCLUDED.visibility,
      spec        = EXCLUDED.spec;

-- ── Step 2 — GRANT edgerunner-v2 to the founder, derived FROM DATA. ──
--    Runs BEFORE Step 3 (ordering landmine). granted_by = NULL (seed grant). The founder is
--    the portfolio on the exclusive edgerunner lane — match v1 OR v2 so the grant fires under
--    BOTH orderings: a fresh `db reset` (founder still on v1 …0004 here, pre-switch) AND an
--    already-switched local stack (founder already on v2 …0005 via the one-off script). With
--    only the v1 predicate the local case found zero rows and the founder was left ungranted.
INSERT INTO template_grants (template_id, user_id, granted_by)
SELECT '00000000-0000-4000-8000-000000000005'::uuid, p.user_id, NULL
  FROM portfolios p
 WHERE p.template_id IN (
         '00000000-0000-4000-8000-000000000004'::uuid,   -- edgerunner v1 (fresh-reset order)
         '00000000-0000-4000-8000-000000000005'::uuid    -- edgerunner v2 (already-switched order)
       )
ON CONFLICT (template_id, user_id) DO NOTHING;

-- ── Step 3 — SWITCH the founder's portfolio from v1 (…0004) onto v2 (…0005). ──
--    By template_id (the founder is the only portfolio on v1 — A6). Runs AFTER the grant.
UPDATE portfolios
   SET template_id = '00000000-0000-4000-8000-000000000005'::uuid
 WHERE template_id = '00000000-0000-4000-8000-000000000004'::uuid;
