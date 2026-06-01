-- =============================================================================
-- 006_enrich_bootstrap_placeholder.sql
--
-- D-P4-07 (polished neutral placeholder bootstrap): enrich the placeholder
-- content that `initialize_portfolio()` seeds for a BRAND-NEW account so the
-- first dashboard load renders a genuinely good-looking, populated 7-section
-- portfolio the user edits in place — NOT a blank form, and with NO fake
-- name/photo identity.
--
-- FORWARD migration (the local stack already has 001-005 applied). This is a
-- BODY-ONLY change via `CREATE OR REPLACE FUNCTION` — the signature, the
-- SECURITY DEFINER / SET search_path attributes, the idempotent early-return,
-- the template lookup, the portfolios/settings inserts, the section TYPES, the
-- sort_order, and the visible/hidden flags are ALL identical to the version in
-- `002_functions_triggers.sql:351-437`. ONLY the placeholder JSONB is enriched:
--
--   * hero       — KEEPS the neutral `[Your Name]` edit-me token (NOT a fake
--                  persona); subheading unchanged.
--   * about.bio  — enriched to a fuller, tasteful, generic introduction
--                  (still well under the 2000-char Zod bound, aboutContentSchema).
--   * contact    — KEEPS its subheading (already present in 002).
--   * projects   — gains a SECOND realistic neutral placeholder project so the
--                  Projects section reads as a populated showcase, not a lone
--                  stub. Each item keeps a client-style id/slug; tech_stack
--                  stays empty (allowed by projectItemSchema).
--
-- The RPC is IDEMPOTENT and returns the existing portfolio id early for an
-- account that already has one, so this change affects ONLY future bootstraps —
-- the seeded `jadrianports` founder content is untouched.
-- =============================================================================
CREATE OR REPLACE FUNCTION initialize_portfolio()
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

  -- Default template must exist (seeded by 001_initial_schema.sql).
  SELECT id INTO v_template_id
    FROM public.templates
    WHERE slug = 'minimal' AND is_active = true;
  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'Default template (minimal) not found';
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
