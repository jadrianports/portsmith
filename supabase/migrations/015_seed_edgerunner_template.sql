-- =============================================================================
-- 015_seed_edgerunner_template.sql
-- Phase 13 (Rich/Viz lane & Three.js dogfood) — Plan 13-05, Task 2 (PIPE-09)
--
-- Ship the founder's restricted/exclusive synthwave redesign — `edgerunner` — as the
-- founder's LIVE template, and promote `minimal` to public in its place. This migration
-- adds DATA only (one new `templates` ROW + grant/switch/visibility UPDATEs) — never a
-- new column or table — the SAME "a new template = a folder + a registry line + a seeded
-- ROW, NO schema change" contract the aurora seed (010) and the gating seed (013)
-- established. (The `visibility` column already exists post-011, so unlike 010's 5-col
-- INSERT this one sets it explicitly.)
--
-- PINNED UUID (Option B — D-P7-13 / RESEARCH Pitfall 3 + Pitfall 6).
-- `templates.id` defaults to `gen_random_uuid()` (`001:36`), so an unpinned seed would
-- get a RANDOM id per environment and the public read could not resolve the slug WITHOUT
-- a request-time `templates` lookup (which breaks the ISR'd `/[username]` page, D-22). The
-- public read maps `portfolios.template_id → slug` from the STATIC map co-located with the
-- registry (`src/components/templates/registry.ts` TEMPLATE_UUIDS). The literal UUID THIS
-- migration pins MUST equal that map exactly:
--     edgerunner = 00000000-0000-4000-8000-000000000004
-- (after minimal …0001 / editorial …0002 / aurora …0003). If they ever diverge,
-- `slugForTemplateId` falls back to `'minimal'` and the public read silently degrades
-- (T-13-05-UUID).
--
-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ THE ORDERING LANDMINE (Pitfall 4 / T-13-05-ORDER) — grant BEFORE switch.     │
-- │                                                                              │
-- │ Step 2 (grant the founder) and Step 3 (switch the founder's portfolio off    │
-- │ minimal) BOTH key off "the portfolio currently on minimal …0001". They MUST  │
-- │ run grant-THEN-switch:                                                        │
-- │   - If Step 3 ran FIRST, the founder's portfolio would already be on …0004    │
-- │     when Step 2's `INSERT…SELECT … WHERE template_id = …0001` runs → the      │
-- │     SELECT matches ZERO rows → the founder is NEVER granted edgerunner →      │
-- │     ungranted-restricted on his OWN template → GATE-03 would later auto-      │
-- │     fallback him to editorial. Do NOT reorder these two steps.                │
-- └─────────────────────────────────────────────────────────────────────────────┘
--
-- WHY DERIVE THE FOUNDER FROM DATA (013's posture): the founder's portfolio is resolved
-- BY template_id (the pinned minimal UUID …0001), NEVER by a hardcoded `jadrianports`
-- username — so this seed is correct regardless of who the minimal portfolio belongs to in
-- any environment. (A6: the founder is the ONLY portfolio on minimal — the switch is by
-- template_id, so a stray non-founder portfolio on minimal would move too; plan 13-05 Task
-- 3 asserts ZERO portfolios remain on …0001 after apply.)
--
-- THE SEED-AFTER-MIGRATION ORDER (belt-and-suspenders): on a fresh DB, if
-- `scripts/seed-founder-portfolio.ts` runs AFTER this migration, the founder→edgerunner
-- grant Step 2 derives from the portfolio still on minimal — but the seed script ALSO
-- upserts the founder→edgerunner grant (self-healing, order-independent) so the grant
-- exists whichever order runs. Both are idempotent on the composite PK.
--
-- NOTE (Pitfall 6): the seeded `spec` JSONB is INFORMATIONAL. The render/field-gate path
-- uses the LOCAL `specRegistry` (`src/components/templates/edgerunner/spec.ts`), never this
-- row. We still seed an accurate shape mirroring `edgerunner/spec.ts`: 7 supported
-- single-scroll soft-enum types (hero/about/metrics/experience/projects/skills/contact);
-- `services` + `blog_preview` unsupported (D-01 → multi-page/blog deferred to Phase 13.2);
-- `['default']`-only presets.
--
-- IDEMPOTENCY. The INSERT uses `ON CONFLICT (slug) DO NOTHING`; the grant uses
-- `ON CONFLICT (template_id, user_id) DO NOTHING`; the two UPDATEs are naturally
-- re-appliable (setting an already-set value is a no-op). Re-applying 015 is a clean no-op.
--
-- FORWARD migration (the local stack already has 001-014 applied). No `db reset` (a reset
-- would wipe the founder seed + grants — Phase-12 precedent [12-02]).
-- =============================================================================

-- ── Step 1 — INSERT the edgerunner row (restricted, D-11). ───────────────────
-- visibility = 'restricted': edgerunner is the founder's EXCLUSIVE template — only the
-- founder (granted below) can select it; the GATE-03 switch gate rejects any ungranted
-- user (UNCHANGED P12 model, T-13-05-GATE). The id MUST equal registry TEMPLATE_UUIDS.edgerunner.
INSERT INTO templates (id, slug, name, description, visibility, spec)
VALUES (
  '00000000-0000-4000-8000-000000000004',
  'edgerunner',
  'Edgerunner',
  'A dark synthwave single-scroll — neon accents, animated skill bars, and a live WebGL centerpiece. The founder''s exclusive rich/viz-lane redesign.',
  'restricted',
  '{
    "sections": {
      "hero":         { "supported": true,  "fields": ["heading", "subheading", "cta_text", "cta_url", "background_image"] },
      "about":        { "supported": true,  "fields": ["bio", "avatar", "avatar_alt"] },
      "metrics":      { "supported": true,  "fields": ["heading", "subheading", "items"] },
      "experience":   { "supported": true,  "fields": ["company", "role", "start_date", "end_date", "description"] },
      "projects":     { "supported": true,  "fields": ["title", "description", "image", "image_alt", "tech_stack", "live_url", "repo_url"] },
      "skills":       { "supported": true,  "fields": ["heading", "groups"] },
      "contact":      { "supported": true,  "fields": ["heading", "subheading"] },
      "services":     { "supported": false, "fields": [] },
      "blog_preview": { "supported": false, "fields": [] }
    },
    "color_presets": ["default"],
    "font_presets":  ["default"]
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- ── Step 2 — GRANT edgerunner to the founder, derived FROM DATA (never a hardcoded ──
--    username). granted_by = NULL (a seed grant has no granting admin — the nullable
--    audit col). This MUST run BEFORE Step 3 (the ORDERING LANDMINE above): it SELECTs
--    the owner of whatever portfolio is STILL on minimal …0001; Step 3 then moves that
--    portfolio off minimal. If reversed, this SELECT matches zero rows.
INSERT INTO template_grants (template_id, user_id, granted_by)
SELECT '00000000-0000-4000-8000-000000000004'::uuid, p.user_id, NULL
  FROM portfolios p
 WHERE p.template_id = '00000000-0000-4000-8000-000000000001'::uuid   -- pinned minimal UUID == registry
ON CONFLICT (template_id, user_id) DO NOTHING;

-- ── Step 3 — SWITCH the founder's portfolio onto edgerunner. ──────────────────
--    By template_id (the founder is the only portfolio on minimal — A6). Runs AFTER the
--    grant so the founder is granted his new live template before he is moved onto it.
UPDATE portfolios
   SET template_id = '00000000-0000-4000-8000-000000000004'::uuid
 WHERE template_id = '00000000-0000-4000-8000-000000000001'::uuid;

-- ── Step 4 — FLIP minimal → public. ──────────────────────────────────────────
--    Reverses 013's (B) `minimal → restricted`. minimal is now a curated PUBLIC template
--    (two synthwave looks: edgerunner exclusive + minimal public). Flipping
--    restricted→public KEEPS the existing founder→minimal grant row (013 (C)) — harmless;
--    a public template ignores grants, and the founder is no longer on minimal anyway.
UPDATE templates SET visibility = 'public'
 WHERE slug = 'minimal';
