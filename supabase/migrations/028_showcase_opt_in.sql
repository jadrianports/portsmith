-- 028_showcase_opt_in.sql
-- Phase 31 (Live Showcase & Explore) — Plan 31-02.
--
-- The data-layer foundation for the opt-in public `/explore` gallery (SHOW-03, SHOW-05).
-- Adds, in five sections:
--
--   (1) profiles.showcase_opt_in — a new BOOLEAN NOT NULL DEFAULT false column. It is the
--       owner-controlled gate that decides whether a published portfolio appears on the
--       public Explore gallery. It is INTENTIONALLY owner-editable (D-06): it is NOT added
--       to the enforce_protected_profile_columns guard list (002/027), so the owner can
--       flip it through the normal authenticated-RLS write path (set-showcase-action.ts).
--   (2) anon column GRANT — extends the 005 column-GRANT set so the security_invoker view
--       below can read the gate column AS the anon invoker (A4). anon reaches columns only
--       through views, so granting SELECT(showcase_opt_in) is benign — there is no view that
--       projects it to the client (the column is the WHERE-gate, never a SELECT-list column).
--   (3) profile_is_showcased(p_user_id) — a SECURITY DEFINER visibility helper byte-identical
--       to profile_is_public (002:172) plus `AND showcase_opt_in = true`. The predicate MUST
--       live in the DEFINER helper, NEVER an inline WHERE in the view: under
--       security_invoker = true the view's WHERE is evaluated as the anon invoker, which has
--       NO column privilege on published/deleted_at/locked/showcase_opt_in, so an inline
--       `WHERE published AND ...` raises 42501 "permission denied for table profiles" for
--       every anon read (the exact failure 005:69-77 + 002:160-170 document and fix this way).
--   (4) public_showcase_profiles — a security_invoker = true view selecting ONLY the 7 PUBLIC
--       profile columns (byte-identical SELECT list to public_profiles, 005:80) filtered by
--       the DEFINER helper. NO private column (email/role/locked/.../showcase_opt_in) — that
--       is the SHOW-05 no-leak guarantee. It is NEVER a DEFINER view (which would bypass base
--       RLS) — only the helper is DEFINER.
--   (5) launch opt-in data — seeds showcase_opt_in = true for the two launch portfolios
--       (jadrianports + aurora-demo) so a fresh `supabase db reset` repopulates the D-14
--       non-empty-gallery guarantee.
--
-- This migration does NOT touch the enforce_protected_profile_columns trigger (002/027) and
-- does NOT modify the existing public_profiles view (005) — showcase_opt_in must stay OFF that
-- read (SHOW-05 / T-31-06).

-- =============================================================================
-- 1. profiles.showcase_opt_in  (owner-editable Explore-gallery gate; D-06)
-- =============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS showcase_opt_in BOOLEAN NOT NULL DEFAULT false;

-- =============================================================================
-- 2. anon column GRANT  (extends the 005 public-column GRANT; A4)
-- =============================================================================
-- The security_invoker view (section 4) is evaluated as the anon role and its predicate
-- helper is DEFINER, so anon never needs published/deleted_at/locked privilege — but the
-- column GRANT below is the benign, three-layer-consistent way to let the gate column be
-- referenced. anon reaches columns only via views; no view projects showcase_opt_in.
GRANT SELECT (showcase_opt_in) ON public.profiles TO anon;

-- =============================================================================
-- 3. profile_is_showcased(p_user_id UUID)  (showcase-visibility DEFINER helper; FND-02)
-- =============================================================================
-- Byte-identical to profile_is_public (002_functions_triggers.sql:172) PLUS the
-- `AND showcase_opt_in = true` opt-in gate. SECURITY DEFINER STABLE so the
-- public_showcase_profiles view (security_invoker = true) can filter on the PRIVATE columns
-- published/deleted_at/locked AND the gate column WITHOUT the anon invoker needing column
-- privileges on them — pushing the predicate here (the function reads those columns as its
-- owner) is the load-bearing no-leak mechanism (see 002:152-170 for the full rationale).
CREATE OR REPLACE FUNCTION profile_is_showcased(p_user_id UUID)
RETURNS BOOLEAN
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND published = true
      AND deleted_at IS NULL
      AND locked = false
      AND showcase_opt_in = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================================================
-- 4. public_showcase_profiles  (the SHOW-05 anon Explore read; 7 public cols only)
-- =============================================================================
-- SELECT list is byte-identical to public_profiles (005:80): id, username, display_name,
-- headline, avatar_url, resume_url, published — NO private column (email/role/locked/
-- locked_reason/storage_used_bytes/deleted_at/created_at/updated_at/user_id) and NOT the
-- showcase_opt_in gate itself. security_invoker = true so base RLS is honored as the anon
-- invoker; the visibility predicate lives in the profile_is_showcased DEFINER helper.
CREATE OR REPLACE VIEW public.public_showcase_profiles
  WITH (security_invoker = true) AS
  SELECT id, username, display_name, headline, avatar_url, resume_url, published
  FROM public.profiles
  WHERE profile_is_showcased(id);

GRANT SELECT ON public.public_showcase_profiles TO anon;

-- =============================================================================
-- 5. launch opt-in data  (D-14 non-empty-gallery guarantee; per RESEARCH OQ-3)
-- =============================================================================
-- Seeded in the migration (not a separate seed file) so a fresh `supabase db reset`
-- repopulates the two launch portfolios into the gallery. Idempotent (an UPDATE to the
-- same value is a no-op); references handles, not ids, so it survives a reseed.
UPDATE public.profiles
  SET showcase_opt_in = true
  WHERE username IN ('jadrianports', 'aurora-demo');
