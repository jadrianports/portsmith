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
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- SERVICE-ROLE / moderation-flow short-circuit. The service-role key bypasses
  -- RLS but NOT triggers: this BEFORE UPDATE fires for the service_role too, and
  -- the service role has auth.uid() = NULL, so the admin lookup below finds no
  -- row and the trigger would BLOCK legitimate server-side moderation writes
  -- (locking an abusive account, soft-deleting via admin tooling). The function's
  -- own comment already scopes the bypass to "admins (and the moderation flow)";
  -- the moderation flow IS the trusted server-side service_role. Honour it.
  -- (Found + fixed in Plan 01-09: admin publish worked but admin lock/soft-delete
  --  was rejected by this trigger because the service role isn't a profiles row.)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT (role = 'admin') INTO is_admin FROM public.profiles WHERE id = auth.uid();
  IF is_admin THEN
    RETURN NEW;  -- admins (and the moderation flow) may change these
  END IF;

  -- DEF-01: SANCTIONED SELF-DELETION short-circuit.
  -- request_account_deletion() is the SECURITY DEFINER RPC by which a normal
  -- (non-admin) user soft-deletes their OWN account. It must set deleted_at — a
  -- protected column — but SECURITY DEFINER does NOT make auth.role()/auth.uid()
  -- here read as the owner, so neither short-circuit above applies and the write
  -- would be rejected. The RPC sets a TRANSACTION-LOCAL GUC marker immediately
  -- before its UPDATE; honour it ONLY for the precise own-row soft-delete.
  --
  -- This carve-out is deliberately the NARROWEST possible. ALL of the following
  -- must hold, or we fall through to the generic rejection below:
  --   (a) the txn-local sanction marker is set (set by request_account_deletion;
  --       the second arg `true` = missing_ok, so current_setting returns NULL —
  --       not an error — when the GUC was never set);
  --   (b) the row belongs to the caller (OLD.id = auth.uid()) — OWN ROW ONLY;
  --   (c) this is specifically the soft-delete transition deleted_at NULL→ts
  --       (never an un-delete or a backdate of an already-deleted row); and
  --   (d) EVERY OTHER protected column is byte-for-byte unchanged.
  --
  -- SECURITY REASONING: even granting the (impossible) premise that an attacker
  -- could set this GUC — they cannot: PostgREST does not let clients set
  -- arbitrary GUCs, and there is no direct-SQL surface for the anon/authenticated
  -- roles — the short-circuit permits ONLY the deleted_at(NULL→ts) change (plus
  -- the non-protected `published`/`updated_at` columns, which this trigger does
  -- not guard) on the caller's OWN row. It can NEVER let through a change to
  -- role / username / storage_used_bytes / email / created_at / locked /
  -- locked_reason, because clause (d) requires each to be IS NOT DISTINCT FROM
  -- its OLD value. The blast radius is exactly "soft-delete your own account" —
  -- which IS the intended capability — so this cannot enable privilege
  -- escalation. FND-03 is preserved.
  IF current_setting('portsmith.sanctioned_self_deletion', true) = 'on'
   AND OLD.id = auth.uid()
   AND OLD.deleted_at IS NULL
   AND NEW.deleted_at IS NOT NULL
   AND NEW.username           IS NOT DISTINCT FROM OLD.username
   AND NEW.role               IS NOT DISTINCT FROM OLD.role
   AND NEW.locked             IS NOT DISTINCT FROM OLD.locked
   AND NEW.locked_reason      IS NOT DISTINCT FROM OLD.locked_reason
   AND NEW.storage_used_bytes IS NOT DISTINCT FROM OLD.storage_used_bytes
   AND NEW.email              IS NOT DISTINCT FROM OLD.email
   AND NEW.created_at         IS NOT DISTINCT FROM OLD.created_at
  THEN
    RETURN NEW;  -- sanctioned own-row soft-delete only; falls through otherwise
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
RETURNS BOOLEAN
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portfolios
    JOIN public.profiles ON public.profiles.id = public.portfolios.user_id
    WHERE public.portfolios.id = p_portfolio_id
      AND public.profiles.published = true
      AND public.profiles.deleted_at IS NULL
      AND public.profiles.locked = false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- 2a. profile_is_public(p_user_id UUID)  (the profiles public-visibility helper)
--
--    The sibling of portfolio_is_public for the profiles row itself. SECURITY
--    DEFINER STABLE so the FND-02 `public_profiles` view (security_invoker = true)
--    can filter on the PRIVATE columns published/deleted_at/locked WITHOUT the
--    anon invoker needing column privileges on them.
--
--    WHY THIS EXISTS: with security_invoker = true, the view's WHERE clause is
--    evaluated as the INVOKING (anon) role. anon is column-GRANTed only the seven
--    PUBLIC profile columns (005_public_views.sql) — it has NO privilege on
--    deleted_at / locked. An inline `WHERE published AND deleted_at IS NULL AND
--    locked = false` therefore raised "permission denied for table profiles" for
--    every anon read of the view, breaking the entire FND-02 public surface.
--    Pushing the predicate into this DEFINER helper (which reads those columns as
--    the function owner) lets the view filter correctly while anon still never
--    gains read access to the private columns. Mirrors portfolio_is_public, which
--    the other public_* views already use for exactly this reason.
--    (Found + fixed in Plan 01-09 when the suite first ran against the live stack.)
-- =============================================================================
CREATE OR REPLACE FUNCTION profile_is_public(p_user_id UUID)
RETURNS BOOLEAN
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND published = true
      AND deleted_at IS NULL
      AND locked = false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- 2c. blog_post_is_public(p_blog_post_id UUID)  (blog public-visibility helper)
--
--    Same security_invoker column-privilege fix as profile_is_public, for the
--    public_blog_posts view: anon is column-GRANTed only the public blog columns
--    (005_public_views.sql) and has NO privilege on the draft-only `published`
--    flag, so an inline `WHERE published = true AND portfolio_is_public(...)`
--    raised "permission denied for table blog_posts" for every anon read. This
--    DEFINER helper reads `published` as its owner. Blog is a Phase-2 feature but
--    the public read surface is authored now (005 / 01-RESEARCH Open Question 2),
--    so the surface must be ANON-READABLE now too, not silently broken.
--    (Found + fixed in Plan 01-09 when the suite first ran against the live stack.)
-- =============================================================================
CREATE OR REPLACE FUNCTION blog_post_is_public(p_blog_post_id UUID)
RETURNS BOOLEAN
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blog_posts
    WHERE id = p_blog_post_id
      AND published = true
      AND public.portfolio_is_public(portfolio_id)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- 2b. is_admin()  (the RLS admin-check helper — recursion-safe)
--
--    PostgreSQL RLS RECURSION FIX: an admin policy that inlines
--    `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`
--    INSIDE a policy ON profiles (or on any table whose admin policy reads
--    profiles) makes Postgres re-evaluate the profiles policies while it is
--    still evaluating them — "infinite recursion detected in policy for
--    relation profiles". Because EVERY anon/authenticated read of profiles (and,
--    transitively, of templates/announcements/reports whose admin policies read
--    profiles) hits that loop, the whole public surface is unreadable.
--
--    The canonical Supabase remedy is to move the role lookup into a
--    SECURITY DEFINER function: it runs as the function OWNER (postgres), which
--    is NOT subject to RLS, so reading profiles.role here does NOT re-trigger the
--    profiles policies — breaking the cycle. STABLE so the planner can cache it
--    within a statement. Returns false for an unauthenticated (anon) caller.
--
--    Used by every "<table> admin <action>" policy in 004_rls_policies.sql in
--    place of the recursive inline EXISTS. (FND-01 controls must be READABLE to
--    be enforced; a recursion error is a deny-everything failure, not isolation.)
-- =============================================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
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
-- SEARCH_PATH + SCHEMA-QUALIFICATION (required): this trigger fires on
-- auth.users INSERT and therefore runs in GoTrue's `supabase_auth_admin`
-- execution context, whose search_path does NOT include `public`. A BARE
-- `INSERT INTO profiles ...` resolves against that search_path and fails with
-- "relation profiles does not exist", which GoTrue surfaces as the opaque
-- "Database error creating new user" — blocking ALL signups (and every
-- integration test that creates a user). The fix is the canonical Supabase
-- pattern: pin a deterministic `SET search_path` AND schema-qualify the table
-- (`public.profiles`). Belt-and-suspenders so neither alone is load-bearing.
-- (Found + fixed in Plan 01-09 when createUser first ran against the live stack.)
-- CR-03 (DB-LEVEL SIGNUP GATE): `raw_user_meta_data` is CLIENT-SUPPLIED at
-- signup and is NOT run through the Zod usernameSchema (that gate lives in app
-- code only — a direct anon `auth.signUp` bypasses it entirely). The DB is the
-- last line of defense, so this trigger now enforces the same invariants the Zod
-- gate does before the row is written:
--   1. username MUST be present (a NULL would otherwise hit NOT NULL as an opaque
--      "Database error creating new user").
--   2. username MUST NOT be a reserved name. This ARRAY MIRRORS, EXACTLY,
--      RESERVED_USERNAMES in src/lib/validations/username.ts — keep the two in
--      sync. The format CHECK (001) accepts `admin`, so without this guard a
--      direct anon signup could claim a reserved route slug.
--   3. display_name is CAPPED at 100 chars (mirrors the Zod cap) before insert,
--      so an oversized client-supplied display_name cannot be stored.
-- CR-02 (GUARDED INSERT): username uniqueness is now a PARTIAL unique index over
-- live rows (uq_profiles_username_live, 001). A collision raises unique_violation
-- INSIDE this AFTER-INSERT trigger on auth.users, which GoTrue would surface as
-- the opaque "Database error creating new user". Catch it and re-raise a clear,
-- actionable message so a taken handle is legible, not a generic DB error.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_username     TEXT := NEW.raw_user_meta_data->>'username';
  v_display_name TEXT := COALESCE(
                           NEW.raw_user_meta_data->>'display_name',
                           NEW.raw_user_meta_data->>'username'
                         );
BEGIN
  -- (1) username required.
  IF v_username IS NULL THEN
    RAISE EXCEPTION 'username is required at signup';
  END IF;

  -- (2) reserved-name guard — mirrors RESERVED_USERNAMES in
  --     src/lib/validations/username.ts (keep in sync).
  IF lower(v_username) = ANY (ARRAY[
    'admin','api','dashboard','login','signup','settings','www','app',
    'portsmith','support','help','about','terms','privacy','root',
    'null','undefined'
  ]) THEN
    RAISE EXCEPTION 'username is reserved';
  END IF;

  -- (3) cap display_name length (mirrors the Zod 100-char cap).
  IF v_display_name IS NOT NULL AND length(v_display_name) > 100 THEN
    v_display_name := left(v_display_name, 100);
  END IF;

  INSERT INTO public.profiles (id, username, display_name, email)
  VALUES (
    NEW.id,
    v_username,
    v_display_name,
    NEW.email
  );

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- CR-02: a live row already owns this handle. Re-raise legibly instead of
    -- letting GoTrue report a generic "Database error creating new user".
    RAISE EXCEPTION 'username is already taken';
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
--    touch it. Begins with an `IF auth.uid() IS NULL` guard (T-06-05).
--
-- DEF-01 (SANCTIONED SELF-DELETION): SECURITY DEFINER changes only the OWNER the
-- function body runs as — it does NOT change the request-scoped GUCs that
-- auth.uid() / auth.role() read. So the BEFORE-UPDATE protected-columns trigger
-- still fires on the UPDATE below with auth.role() = 'authenticated' and
-- auth.uid() = the non-admin caller — neither the service_role nor the admin
-- short-circuit applies, and the deleted_at change (a protected column) is
-- rejected. The RPC could therefore never soft-delete a normal user's own row.
--
-- THE FIX: set a TRANSACTION-LOCAL GUC immediately before the UPDATE. The third
-- arg `true` to set_config scopes it to the CURRENT TRANSACTION only — it is
-- rolled back at COMMIT/ROLLBACK and never leaks across pooled connections
-- (unlike a session-level GUC). The protected-columns trigger honours this
-- marker ONLY for the exact own-row NULL→timestamp soft-delete transition (see
-- enforce_protected_profile_columns for the full short-circuit and its security
-- reasoning). The auth.uid() guard is retained — this RPC only ever soft-deletes
-- the caller's own row.
-- =============================================================================
CREATE OR REPLACE FUNCTION request_account_deletion()
RETURNS VOID
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- DEF-01: txn-local sanction marker the protected-columns trigger checks for
  -- the own-row soft-delete transition. `true` = local to this transaction.
  PERFORM set_config('portsmith.sanctioned_self_deletion', 'on', true);

  UPDATE public.profiles
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
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
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
-- SECURITY DEFINER (required): section_history has RLS enabled with an "own
-- SELECT" policy and NO INSERT/DELETE policy — it is meant to be written ONLY by
-- this trigger (see the section_history policy comment in 004_rls_policies.sql:
-- "populated only by the save_section_history trigger (SECURITY DEFINER
-- context)"). As a plain (INVOKER) function this INSERT ran as the authenticated
-- OWNER role, which has no INSERT policy, so EVERY owner content edit failed with
-- "new row violates row-level security policy for table section_history" — i.e.
-- the trigger blocked the very UPDATE it hangs off. Declaring it SECURITY DEFINER
-- (its documented intent) lets the history INSERT/DELETE bypass RLS while the
-- owner's UPDATE on sections is still gated by the sections RLS policy.
-- search_path pinned for the usual definer-safety reason.
-- (Found + fixed in Plan 01-09 when an owner first edited a section live.)
CREATE OR REPLACE FUNCTION save_section_history()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.section_history (section_id, content)
    VALUES (OLD.id, OLD.content);

  -- Prune this section's history to the 10 most-recent rows.
  DELETE FROM public.section_history
    WHERE section_id = OLD.id
      AND id NOT IN (
        SELECT id FROM public.section_history
          WHERE section_id = OLD.id
          ORDER BY created_at DESC
          LIMIT 10
      );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER capture_section_history
  BEFORE UPDATE OF content ON sections
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION save_section_history();
