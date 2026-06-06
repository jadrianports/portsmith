-- =============================================================================
-- 012_template_gating_rls.sql
-- Phase 12 (Template Gating — public / exclusive) — Plan 12-02, Task 2
--
-- The RLS + privileged-RPC layer for `template_grants` (created in 011). It does
-- FOUR things:
--   (1) Enables RLS on `template_grants` and adds the own-select + admin-all policies
--       (GATE-02 data-layer enforcement: a user reads ONLY their own grants; the
--       operator reads/writes all).
--   (2) A belt-and-suspenders `REVOKE SELECT … FROM anon` backstop — `template_grants`
--       has NO anon GRANT and NO public view, so the public/anon bundle can never
--       reach grant data (D-22 / D-25; mirrors `005:65-213`).
--   (3) `fallback_ungranted_to_editorial(UUID)` — the ONE cross-user write
--       (D-P12-16 / GATE-04 substrate). A SECURITY DEFINER RPC that repoints
--       ungranted users' portfolios off a now-restricted template onto editorial,
--       LOSSLESSLY (only `portfolios.template_id` + `template_fallback_at`).
--   (4) `count_ungranted_on_template(UUID)` — its read-only sibling, returning the
--       impact count + usernames for the D-P12-11 confirm dialog.
--
-- DECISIONS:
--   D-P12-10  the auto-fallback sets `portfolios.template_fallback_at = now()` so the
--             dashboard can surface a one-time "your template changed — pick another"
--             notice. The RPC sets BOTH columns in the SAME UPDATE (a fallback row
--             ALWAYS carries the timestamp).
--   D-P12-11  the admin confirm dialog reads `count_ungranted_on_template` BEFORE a
--             flip-to-restricted / revoke and only prompts when count > 0.
--   D-P12-16  the cross-user write is a `SECURITY DEFINER` RPC (NOT a service-role
--             route) — this phase performs NO service-role write at runtime; admin
--             grant/visibility writes (12-05) use the authenticated admin-RLS client.
--
-- SECURITY DEFINER POSTURE (T-12-02-PRIV — DEFINER bypasses RLS, so the body MUST
-- self-gate). Both RPCs mirror `is_admin()`'s DEFINER form (`002:232-241`) but use
-- the STRICTER current best-practice: `SECURITY DEFINER SET search_path = ''` with
-- EVERY object reference `public.`-qualified (the empty search_path closes the
-- search_path-hijack footgun — no unqualified name resolves), PLUS an inner
-- `IF NOT public.is_admin() THEN RAISE EXCEPTION` re-check (mirrors `lock-action.ts`'s
-- `callerIsAdmin` re-check — the body's own gate is the REAL authorization, because
-- DEFINER runs as the function owner and bypasses the table's RLS policies).
-- Both are `GRANT EXECUTE … TO authenticated` (anon can't call them).
--
-- WHY A DEFINER READ, NOT A `portfolios admin select` POLICY (Pitfall 1):
-- `portfolios` has only `own all` + `public select` (`004:103-110`), NO admin SELECT,
-- so an admin CANNOT read other users' unpublished portfolios under RLS. A
-- purpose-built DEFINER read (`count_ungranted_on_template`) keeps admin's reach
-- NARROW (just the impact count for one template), instead of opening a broad
-- all-portfolios admin SELECT.
--
-- NOTE: the existing `templates admin all` (`004:239`) ALREADY covers the visibility
-- UPDATE (12-05 flips `templates.visibility` under that policy) — this migration adds
-- NO new `templates` policy.
--
-- NOTE: `005_public_views.sql` is NOT touched — the public `/[username]` path stays
-- grant-free and cookie-less (D-22). The write-time gate (12-03) + this auto-fallback
-- close the only window where a persisted `template_id` could go stale, so the public
-- render needs nothing new.
--
-- FORWARD migration (after 011). No `db reset`.
-- =============================================================================

-- (1) RLS on template_grants -------------------------------------------------
ALTER TABLE template_grants ENABLE ROW LEVEL SECURITY;

-- GATE-02 enforcement: a user reads ONLY their own grant rows. `(select auth.uid())`
-- wraps the call so the planner evaluates it once per statement (the recommended
-- InitPlan form). `auth.uid() = profiles.id = template_grants.user_id` (the FK
-- rationale in 011) makes this a bare equality, no join.
CREATE POLICY "template_grants own select"
  ON template_grants FOR SELECT
  USING ((select auth.uid()) = user_id);

-- Admin reads/writes ALL grants — mirrors `reports admin all` (`004:263-266`). This
-- is the ONLY write path on `template_grants` (there is deliberately NO owner
-- INSERT/UPDATE/DELETE policy — a user cannot self-grant; T-12-02-ESC).
CREATE POLICY "template_grants admin all"
  ON template_grants FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- (2) anon REVOKE backstop (defense-in-depth; RLS already denies anon, no public
--     view exists). Mirrors `005:65-213`.
REVOKE SELECT ON public.template_grants FROM anon;

-- (3) fallback_ungranted_to_editorial — the ONE cross-user write (D-P12-16). -----
-- Repoints every portfolio on `p_template_id` whose owner is NOT granted that
-- template onto editorial, LOSSLESSLY (touches ONLY template_id + template_fallback_at
-- — never a `sections`/content row; T-12-02-INT), and RETURNS the affected usernames
-- for the CALLING action to `revalidatePath('/' + username)` (Postgres cannot call
-- Next, so it returns the list rather than revalidating itself).
CREATE OR REPLACE FUNCTION public.fallback_ungranted_to_editorial(p_template_id UUID)
RETURNS TABLE (username TEXT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_editorial UUID := '00000000-0000-4000-8000-000000000002';  -- == registry TEMPLATE_UUIDS.editorial
BEGIN
  -- Self-gate (DEFINER bypasses RLS — this is the REAL authorization).
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  -- Editorial is the fallback target itself — nothing to move.
  IF p_template_id = v_editorial THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH moved AS (
    UPDATE public.portfolios p
       SET template_id = v_editorial,
           template_fallback_at = now()             -- set BOTH in the same UPDATE (D-P12-10)
     WHERE p.template_id = p_template_id
       AND NOT EXISTS (
         SELECT 1 FROM public.template_grants g
          WHERE g.template_id = p.template_id
            AND g.user_id = p.user_id
       )
    RETURNING p.user_id
  )
  SELECT pr.username
    FROM moved m
    JOIN public.profiles pr ON pr.id = m.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fallback_ungranted_to_editorial(UUID) TO authenticated;

-- (4) count_ungranted_on_template — the read-only impact sibling (D-P12-11). -----
-- Same DEFINER + is_admin() self-gate. Returns the number of ungranted portfolios on
-- `p_template_id` and the affected usernames, so the admin confirm dialog can show the
-- blast radius BEFORE a flip-to-restricted / revoke (and skip the prompt when n = 0).
CREATE OR REPLACE FUNCTION public.count_ungranted_on_template(p_template_id UUID)
RETURNS TABLE (n BIGINT, usernames TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_editorial UUID := '00000000-0000-4000-8000-000000000002';  -- == registry TEMPLATE_UUIDS.editorial
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  -- Editorial is the fallback target — no one would be moved off it.
  IF p_template_id = v_editorial THEN
    RETURN QUERY SELECT 0::bigint, ARRAY[]::text[];
    RETURN;
  END IF;
  RETURN QUERY
  WITH ungranted AS (
    SELECT pr.username
      FROM public.portfolios p
      JOIN public.profiles pr ON pr.id = p.user_id
     WHERE p.template_id = p_template_id
       AND NOT EXISTS (
         SELECT 1 FROM public.template_grants g
          WHERE g.template_id = p.template_id
            AND g.user_id = p.user_id
       )
  )
  SELECT count(*)::bigint,
         COALESCE(array_agg(u.username), ARRAY[]::text[])
    FROM ungranted u;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_ungranted_on_template(UUID) TO authenticated;
