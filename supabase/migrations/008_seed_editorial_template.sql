-- =============================================================================
-- 008_seed_editorial_template.sql
--
-- TMPL-01 / Phase-7 success criterion 1: "a new template = a folder + a registry
-- line + a seeded ROW, NO schema change." This migration adds DATA only — a new
-- `templates` ROW (never a new column) and a body-only function replacement. It
-- does THREE things, in ONE forward-only transaction (Supabase wraps a migration
-- file in a single txn), in this exact order so the founder portfolio's FK is
-- NEVER orphaned:
--
--   (A) Seed the `editorial` template ROW with the PINNED literal UUID
--       `00000000-0000-4000-8000-000000000002` (Option B — D-P7-13 / Q1).
--   (B) Reconcile the `minimal` row's id to the PINNED literal
--       `00000000-0000-4000-8000-000000000001`, re-pointing every
--       `portfolios.template_id` that references it FIRST so the
--       `NOT NULL REFERENCES templates(id)` FK survives.
--   (C) Change `initialize_portfolio()`'s default-template lookup from
--       `slug='minimal'` to `slug='editorial'` via a body-only CREATE OR REPLACE
--       (the `006` precedent) — so only FUTURE bootstraps default to editorial.
--
-- WHY THE PINNED UUIDS (Option B / RESEARCH Pitfall 3 + Pitfall 6).
-- `templates.id` defaults to `gen_random_uuid()` (`001:36`), so the `minimal`
-- row seeded by `001:272-291` got a RANDOM id per environment. The public read
-- maps `portfolios.template_id -> slug` from a STATIC map co-located with the
-- registry (`src/components/templates/registry.ts` TEMPLATE_UUIDS) so the ISR'd
-- `/[username]` page resolves the template with ZERO request-time `templates`
-- read (an anon read of the base `templates` table is not on the public-views
-- allowlist and would force the page dynamic). The literal UUIDs THIS migration
-- pins MUST equal that map exactly:
--     minimal   = 00000000-0000-4000-8000-000000000001
--     editorial = 00000000-0000-4000-8000-000000000002
-- If they ever diverge, `slugForTemplateId` falls back to `'minimal'` and the
-- switch path / RLS integration test (`tests/integration/cms/template-switch-rls`)
-- silently degrade. (T-07-02.)
--
-- WHY THE ORDERING / FK CARE (T-07-04).
-- `portfolios.template_id` is `NOT NULL REFERENCES templates(id)` with the DEFAULT
-- `ON UPDATE NO ACTION`, NOT DEFERRABLE (verified live: confupdtype='a',
-- condeferrable='f'). That rules out the two naive sequences (both empirically
-- FK-violate against the live local stack):
--   * re-point children to ...0001 first  -> FK error: parent ...0001 absent yet.
--   * `UPDATE templates SET id=...0001` first -> FK error: old id still referenced
--     (NO ACTION does not cascade a PK update to children).
-- `SET CONSTRAINTS ALL DEFERRED` is NOT available (the FK is not DEFERRABLE).
-- The robust forward-only sequence used below (validated live, see Step B):
--   1. INSERT a copy of the minimal row carrying the pinned id ...0001 under a
--      TEMPORARY slug (so the new parent ...0001 EXISTS before any child points
--      at it, and the `slug UNIQUE` constraint is not violated by two `minimal`s).
--   2. Re-point every portfolio off the old random minimal id onto ...0001.
--   3. DELETE the old random-id minimal row (now unreferenced).
--   4. Rename the temp row's slug back to 'minimal'.
-- Every statement is guarded by `id <> ...0001` (or the temp slug), so a re-apply
-- is a clean no-op (INSERT 0 / UPDATE 0 / DELETE 0 / UPDATE 0 — verified).
--
-- IDEMPOTENCY. The editorial seed uses `ON CONFLICT (slug) DO NOTHING`; the
-- minimal reconciliation is `id <> ...0001`-guarded end to end; the function is a
-- CREATE OR REPLACE. Re-applying 008 changes nothing.
--
-- FOUNDER STAYS MINIMAL (D-P7-09). `initialize_portfolio()` is idempotent — it
-- returns the existing portfolio id early for any account that already has one
-- (`002:364-368`). The founder's `jadrianports` portfolio already exists (seeded
-- by `scripts/seed-founder-portfolio.ts`, which looks the template up BY SLUG, so
-- it stays valid after the id pin). Changing the default therefore touches ONLY
-- future bootstraps — the founder remains on `minimal`, now at the pinned id.
--
-- NOTE (Pitfall 6): the seeded `spec` JSONB is INFORMATIONAL. The render/field-gate
-- path uses the LOCAL `specRegistry` (`src/components/templates/*/spec.ts`), never
-- this row. We still seed an accurate shape mirroring `editorial/spec.ts`.
--
-- FORWARD migration (the local stack already has 001-007 applied). No `db reset`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (A) Seed the editorial template ROW with the PINNED literal UUID (...0002).
--     Mirrors the `minimal` seed (`001:272-291`): id is pinned (Option B), and
--     the insert is idempotent via ON CONFLICT (slug) DO NOTHING. The spec mirrors
--     `editorial/spec.ts`: every CMS-produced type supported, `blog_preview`
--     unsupported (D-P7-05), `['default']`-only presets (D-P7-03).
-- -----------------------------------------------------------------------------
INSERT INTO templates (id, slug, name, description, spec)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'editorial',
  'Editorial',
  'A light, editorial broadsheet template — typographic, calm, and hard to make ugly.',
  '{
    "sections": {
      "hero":         { "supported": true,  "fields": ["heading", "subheading", "cta_text", "cta_url", "background_image"] },
      "about":        { "supported": true,  "fields": ["bio", "skills", "avatar", "avatar_alt"] },
      "skills":       { "supported": true,  "fields": ["heading", "groups"] },
      "projects":     { "supported": true,  "fields": ["title", "description", "image", "image_alt", "tech_stack", "live_url", "repo_url"] },
      "experience":   { "supported": true,  "fields": ["company", "role", "start_date", "end_date", "description"] },
      "testimonials": { "supported": true,  "fields": ["name", "quote", "avatar", "avatar_alt", "stars", "company"] },
      "contact":      { "supported": true,  "fields": ["heading", "subheading"] },
      "blog_preview": { "supported": false, "fields": [] }
    },
    "color_presets": ["default"],
    "font_presets":  ["default"]
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- (B) Reconcile the `minimal` row id to the PINNED literal (...0001) WITHOUT ever
--     orphaning the founder portfolio's FK. See the FK-care note in the header for
--     why this exact 4-step sequence is required (NO ACTION + non-DEFERRABLE FK +
--     UNIQUE slug). Each step is `id <> ...0001`-guarded so a re-apply is a no-op.
-- -----------------------------------------------------------------------------

-- B.1 — Create the pinned parent FIRST, under a temporary slug, by copying the
--       existing minimal row's content. After this the parent ...0001 EXISTS, so
--       children can be re-pointed at it without a transient FK violation. The
--       temp slug avoids the `slug UNIQUE` collision with the live 'minimal' row.
--       If minimal is ALREADY pinned (re-apply), the WHERE matches 0 rows -> no-op.
INSERT INTO templates (id, slug, name, description, thumbnail_url, spec, is_premium, is_active, three_js_enabled)
SELECT
  '00000000-0000-4000-8000-000000000001',
  slug || '__pin_tmp',
  name, description, thumbnail_url, spec, is_premium, is_active, three_js_enabled
FROM templates
WHERE slug = 'minimal'
  AND id <> '00000000-0000-4000-8000-000000000001';

-- B.2 — Re-point every portfolio off the OLD random minimal id onto the pinned
--       parent ...0001 (now valid: the parent exists). This is the founder-FK
--       reconciliation. No-op on re-apply (the old random row no longer exists).
UPDATE portfolios
SET template_id = '00000000-0000-4000-8000-000000000001'
WHERE template_id IN (
  SELECT id FROM templates
  WHERE slug = 'minimal'
    AND id <> '00000000-0000-4000-8000-000000000001'
);

-- B.3 — Delete the OLD random-id minimal row (now unreferenced). No-op on re-apply.
DELETE FROM templates
WHERE slug = 'minimal'
  AND id <> '00000000-0000-4000-8000-000000000001';

-- B.4 — Rename the temp row back to the canonical 'minimal' slug. The pinned row
--       (...0001) now carries slug='minimal'. No-op on re-apply (no temp row).
UPDATE templates
SET slug = 'minimal'
WHERE slug = 'minimal__pin_tmp';

-- -----------------------------------------------------------------------------
-- (C) Body-only CREATE OR REPLACE of initialize_portfolio() — change the default
--     template lookup from slug='minimal' to slug='editorial'. This is byte-for-
--     byte the CURRENT live body (the `006`-enriched 7-section placeholder),
--     EXCEPT exactly two tokens: the lookup slug and its RAISE EXCEPTION message.
--     The signature, RETURNS UUID, SET search_path, SECURITY DEFINER, LANGUAGE
--     plpgsql, the auth.uid() guard, the idempotent early-return, and the full
--     7-section seed (types + sort_order + visible/hidden flags + placeholder
--     content) are ALL identical to `006_enrich_bootstrap_placeholder.sql`.
--
--     ORDERING: this MUST come AFTER the editorial-row seed (A) above — the body
--     references slug='editorial', and a new bootstrap would RAISE the not-found
--     exception if the row did not yet exist.
--
--     Because the RPC is idempotent (returns the existing portfolio id early for
--     any account that already has one), this affects ONLY future bootstraps. The
--     founder's persisted `minimal` portfolio is untouched (D-P7-09).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.initialize_portfolio()
RETURNS UUID
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_portfolio_id UUID;
  v_template_id  UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Idempotent: return the existing portfolio if the user already has one.
  SELECT id INTO v_portfolio_id FROM public.portfolios WHERE user_id = v_user_id;
  IF v_portfolio_id IS NOT NULL THEN
    RETURN v_portfolio_id;
  END IF;

  -- Default template must exist (editorial seeded above in this migration).
  SELECT id INTO v_template_id
    FROM public.templates
    WHERE slug = 'editorial' AND is_active = true;
  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'Default template (editorial) not found';
  END IF;

  -- Portfolio + settings.
  INSERT INTO public.portfolios (user_id, template_id)
    VALUES (v_user_id, v_template_id)
    RETURNING id INTO v_portfolio_id;

  INSERT INTO public.portfolio_settings (portfolio_id)
    VALUES (v_portfolio_id);

  -- The 7 default sections, with placeholder content + visible/hidden flags.
  -- sort_order follows the canonical single-scroll order.
  INSERT INTO public.sections (portfolio_id, type, sort_order, visible, content) VALUES
    (v_portfolio_id, 'hero', 0, true, jsonb_build_object(
      'heading',    'Hi, I''m [Your Name]',
      'subheading', 'I build things for the web'
    )),
    (v_portfolio_id, 'about', 1, true, jsonb_build_object(
      'bio',    'I''m a professional who turns ideas into real, working results. Over the years I''ve learned that the details matter — clear communication, thoughtful execution, and following through on what I promise. This is the space to introduce yourself: share who you are, the kind of work you do, the problems you love to solve, and what makes working with you worthwhile. Keep it warm and specific — a couple of honest sentences beat a page of buzzwords.',
      'skills', jsonb_build_array('JavaScript', 'React', 'Node.js', 'Your Skill')
    )),
    (v_portfolio_id, 'projects', 2, true, jsonb_build_object(
      'heading', 'Projects',
      'items',   jsonb_build_array(
        jsonb_build_object(
          'id',          'placeholder-1',
          'slug',        'your-first-project',
          'title',       'Your First Project',
          'description', 'Describe a project you''re proud of — what it does, the problem it solves, and the role you played. A short, concrete story (what changed because of your work) lands better than a feature list.',
          'tech_stack',  jsonb_build_array()
        ),
        jsonb_build_object(
          'id',          'placeholder-2',
          'slug',        'a-second-project',
          'title',       'A Second Project',
          'description', 'Add another piece of work that shows a different side of what you do — a different skill, a different kind of client, or a result you''re especially proud of. Two strong examples already make a portfolio feel real.',
          'tech_stack',  jsonb_build_array()
        )
      )
    )),
    (v_portfolio_id, 'experience', 3, false, jsonb_build_object(
      'heading', 'Experience',
      'items',   jsonb_build_array(
        jsonb_build_object(
          'id',          'placeholder',
          'company',     'Company Name',
          'role',        'Your Role',
          'start_date',  '2020-01',
          'end_date',    'present',
          'description', 'Describe what you did here.'
        )
      )
    )),
    (v_portfolio_id, 'testimonials', 4, false, jsonb_build_object(
      'heading', 'Testimonials',
      'items',   jsonb_build_array()
    )),
    (v_portfolio_id, 'contact', 5, true, jsonb_build_object(
      'heading',    'Get in Touch',
      'subheading', 'Have a question or want to work together? Send me a message.'
    )),
    (v_portfolio_id, 'blog_preview', 6, false, jsonb_build_object(
      'heading',    'From the Blog',
      'post_count', 3
    ));

  RETURN v_portfolio_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
