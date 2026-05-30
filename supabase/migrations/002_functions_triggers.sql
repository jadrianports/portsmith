-- 002_functions_triggers.sql
-- Phase 1 (Security & Data Foundation) — Plan 01-06 — handoff T3 (functions + triggers)
--
-- The database functions and triggers that enforce protected-column immutability
-- (FND-03), bootstrap profiles/portfolios on signup, capture section history, and
-- keep updated_at fresh. Builds on the 12-table schema in 001_initial_schema.sql.
--
-- SOURCE OF TRUTH (transcribed verbatim where the docs give a body):
--   docs/02-security-rls.md  — enforce_protected_profile_columns (8 cols, admin
--                              short-circuit, IS DISTINCT FROM, generic RAISE),
--                              portfolio_is_public (SECURITY DEFINER STABLE).
--   docs/03-auth-flows.md    — handle_new_user (+ on_auth_user_created trigger),
--                              initialize_portfolio behaviour (SECURITY DEFINER,
--                              auth.uid() guard, idempotent, 7 default sections),
--                              request_account_deletion behaviour.
--   docs/01-data-model.md    — Triggers section: update_updated_at on 5 tables;
--                              save_section_history (BEFORE UPDATE OF content,
--                              snapshot OLD.content, prune to 10 rows).
--
-- SCOPE: functions + triggers ONLY. NO RLS policies (those are Plan 01-07), NO
-- storage buckets and NO sync_storage_usage (those live in 003_storage_buckets.sql).
--
-- Phase-1 exclusions (CONTEXT D-04 / docs/01 / docs/02): the protected-columns
-- trigger stays STRICT — NO `username_set` column and NO Phase-2 username
-- carve-out. The MVP signup form always supplies a username.
--
-- Order within this file: helper/guard functions first, then the per-table
-- triggers that call them (a trigger cannot reference a function not yet defined).

-- =============================================================================
-- 1. enforce_protected_profile_columns()  (FND-03 — the most important security
--    object after RLS itself: RLS decides WHICH ROWS you may touch; this trigger
--    decides WHICH COLUMNS within your own row.)
--
--    VERBATIM from docs/02-security-rls.md. Guards the 8 protected columns via
--    NULL-safe IS DISTINCT FROM, short-circuits for admins (and the moderation
--    flow), and raises a SINGLE GENERIC message (no column enumeration — T-06-06).
-- =============================================================================
CREATE OR REPLACE FUNCTION enforce_protected_profile_columns()
RETURNS TRIGGER AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  SELECT (role = 'admin') INTO is_admin FROM profiles WHERE id = auth.uid();
  IF is_admin THEN
    RETURN NEW;  -- admins (and the moderation flow) may change these
  END IF;

  IF NEW.username        IS DISTINCT FROM OLD.username
   OR NEW.role           IS DISTINCT FROM OLD.role
   OR NEW.locked         IS DISTINCT FROM OLD.locked
   OR NEW.locked_reason  IS DISTINCT FROM OLD.locked_reason
   OR NEW.storage_used_bytes IS DISTINCT FROM OLD.storage_used_bytes
   OR NEW.deleted_at     IS DISTINCT FROM OLD.deleted_at
   OR NEW.email          IS DISTINCT FROM OLD.email
   OR NEW.created_at     IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Attempt to modify a protected profile column';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER protect_profile_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_protected_profile_columns();

-- =============================================================================
-- 2. portfolio_is_public(p_portfolio_id UUID)  (the public-visibility helper used
--    by Plan 07's RLS policies and the security_invoker public views)
--
--    VERBATIM from docs/02-security-rls.md. SECURITY DEFINER STABLE so it can be
--    called from anon RLS policies without exposing profiles directly. The
--    corrected predicate includes `locked = false` (a suspended account's
--    portfolio must NOT be publicly readable).
-- =============================================================================
CREATE OR REPLACE FUNCTION portfolio_is_public(p_portfolio_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM portfolios
    JOIN profiles ON profiles.id = portfolios.user_id
    WHERE portfolios.id = p_portfolio_id
      AND profiles.published = true
      AND profiles.deleted_at IS NULL
      AND profiles.locked = false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- 3. handle_new_user()  (+ on_auth_user_created AFTER INSERT trigger on auth.users)
--
--    VERBATIM from docs/03-auth-flows.md. The MVP STRICT version: the signup form
--    always supplies a username, so this reads `raw_user_meta_data->>'username'`
--    directly (no provisional-username fallback — that is Phase 2). The metadata
--    keys (`username`, `display_name`) match tests/integration/_setup.ts
--    createTestUser, which calls auth.admin.createUser with
--    user_metadata:{username, display_name} expecting THIS trigger to fire.
-- =============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- 4. initialize_portfolio()  (the first-dashboard-load bootstrap RPC)
--
--    Behaviour per docs/03-auth-flows.md "Portfolio bootstrap":
--      - SECURITY DEFINER, begins with an `IF auth.uid() IS NULL` guard (T-06-05).
--      - Idempotent: returns the existing portfolio id if one already exists for
--        auth.uid() (so a client retry is safe).
--      - Looks up the default template (slug='minimal', is_active=true); raises if
--        none found (a portfolio cannot exist without a template — FK target).
--      - Inserts the portfolios row, then the portfolio_settings row, then the 7
--        default sections with the exact placeholder content + visible/hidden
--        flags from docs/03 (hero/about/projects/contact visible;
--        experience/testimonials/blog_preview hidden).
--      - Returns the new portfolio id.
--
--    Split deliberately from signup (handle_new_user creates the profile only) so
--    a bootstrap failure does not roll back the entire signup (docs/03).
-- =============================================================================
CREATE OR REPLACE FUNCTION initialize_portfolio()
RETURNS UUID AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_portfolio_id UUID;
  v_template_id  UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Idempotent: return the existing portfolio if the user already has one.
  SELECT id INTO v_portfolio_id FROM portfolios WHERE user_id = v_user_id;
  IF v_portfolio_id IS NOT NULL THEN
    RETURN v_portfolio_id;
  END IF;

  -- Default template must exist (seeded by 001_initial_schema.sql).
  SELECT id INTO v_template_id
    FROM templates
    WHERE slug = 'minimal' AND is_active = true;
  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'Default template (minimal) not found';
  END IF;

  -- Portfolio + settings.
  INSERT INTO portfolios (user_id, template_id)
    VALUES (v_user_id, v_template_id)
    RETURNING id INTO v_portfolio_id;

  INSERT INTO portfolio_settings (portfolio_id)
    VALUES (v_portfolio_id);

  -- The 7 default sections, with placeholder content + visible/hidden flags.
  -- sort_order follows the canonical single-scroll order.
  INSERT INTO sections (portfolio_id, type, sort_order, visible, content) VALUES
    (v_portfolio_id, 'hero', 0, true, jsonb_build_object(
      'heading',    'Hi, I''m [Your Name]',
      'subheading', 'I build things for the web'
    )),
    (v_portfolio_id, 'about', 1, true, jsonb_build_object(
      'bio',    'Write a short introduction about yourself here — who you are, what you do, and what you care about.',
      'skills', jsonb_build_array('JavaScript', 'React', 'Node.js', 'Your Skill')
    )),
    (v_portfolio_id, 'projects', 2, true, jsonb_build_object(
      'heading', 'Projects',
      'items',   jsonb_build_array(
        jsonb_build_object(
          'id',          'placeholder',
          'slug',        'your-first-project',
          'title',       'Your First Project',
          'description', 'Describe a project you are proud of — what it does, the problem it solves, and your role.',
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

-- =============================================================================
-- 5. request_account_deletion()  (the SECURITY DEFINER deletion RPC)
--
--    Behaviour per docs/03-auth-flows.md "Account deletion" + docs/04-api-contracts.md:
--    sets deleted_at = now() and published = false for the calling user. This RPC
--    exists BECAUSE deleted_at is a protected column — a direct UPDATE cannot
--    touch it. Begins with an `IF auth.uid() IS NULL` guard (T-06-05). Running as
--    SECURITY DEFINER, it is NOT subject to the protected-columns trigger's
--    non-admin block on the function owner's behalf, so it can set deleted_at.
-- =============================================================================
CREATE OR REPLACE FUNCTION request_account_deletion()
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE profiles
    SET deleted_at = now(),
        published  = false
    WHERE id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. update_updated_at()  (+ BEFORE UPDATE triggers on the 5 mutable tables)
--
--    docs/01-data-model.md "Triggers": BEFORE UPDATE on profiles, portfolios,
--    sections, blog_posts, portfolio_settings — sets NEW.updated_at = now().
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_portfolios
  BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_sections
  BEFORE UPDATE ON sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_blog_posts
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_portfolio_settings
  BEFORE UPDATE ON portfolio_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- 7. save_section_history()  (+ BEFORE UPDATE OF content ON sections trigger)
--
--    docs/01-data-model.md "Triggers": fires only WHEN (OLD.content IS DISTINCT
--    FROM NEW.content). Inserts OLD.content into section_history, then prunes that
--    section's history to the 10 most-recent rows (deletes the older ones). The
--    revert UI is Phase 2 — the data is captured now because it is free to keep.
-- =============================================================================
CREATE OR REPLACE FUNCTION save_section_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO section_history (section_id, content)
    VALUES (OLD.id, OLD.content);

  -- Prune this section's history to the 10 most-recent rows.
  DELETE FROM section_history
    WHERE section_id = OLD.id
      AND id NOT IN (
        SELECT id FROM section_history
          WHERE section_id = OLD.id
          ORDER BY created_at DESC
          LIMIT 10
      );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER capture_section_history
  BEFORE UPDATE OF content ON sections
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION save_section_history();
