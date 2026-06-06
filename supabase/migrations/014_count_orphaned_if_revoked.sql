-- =============================================================================
-- 014_count_orphaned_if_revoked.sql
-- Phase 12 (Template Gating) — gap-closure after human-UAT (D-P12-11 fix)
--
-- THE GAP: `count_ungranted_on_template(T)` (012) counts portfolios on T whose
-- owner is CURRENTLY ungranted. The /admin revoke confirm called it BEFORE the
-- revoke — when the target user is still granted — so it returned 0 and the
-- confirm was skipped, then the post-revoke auto-fallback silently moved that
-- (active) user to editorial. The panel comment's stated intent ("removing the
-- last grant that keeps a user on a restricted template orphans them") never
-- fired. Lossless (content kept + dashboard notice), but no pre-confirm.
--
-- THE FIX: a revoke-aware impact read that counts the post-revoke orphan set —
-- portfolios on T whose owner is ungranted OR is the user whose grant is about
-- to be removed (p_user_id). Same SECURITY DEFINER + is_admin() self-gate +
-- empty search_path posture as 012's two RPCs (T-12-02-PRIV).
--
-- The flip→restricted confirm keeps using `count_ungranted_on_template` (no
-- specific user is being revoked there); only the revoke path uses this.
--
-- FORWARD migration (after 013). No `db reset`.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.count_orphaned_if_revoked(
  p_template_id UUID,
  p_user_id     UUID
)
RETURNS TABLE (n BIGINT, usernames TEXT[])
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
  -- Editorial is the fallback target — no one would be moved off it.
  IF p_template_id = v_editorial THEN
    RETURN QUERY SELECT 0::bigint, ARRAY[]::text[];
    RETURN;
  END IF;
  RETURN QUERY
  WITH orphaned AS (
    SELECT pr.username
      FROM public.portfolios p
      JOIN public.profiles pr ON pr.id = p.user_id
     WHERE p.template_id = p_template_id
       AND (
         -- the grant about to be revoked → this user becomes ungranted-and-on-T
         p.user_id = p_user_id
         -- plus anyone already ungranted-and-on-T (normally none — the system
         -- keeps everyone-on-T granted — but counted for correctness)
         OR NOT EXISTS (
           SELECT 1 FROM public.template_grants g
            WHERE g.template_id = p.template_id
              AND g.user_id = p.user_id
         )
       )
  )
  SELECT count(*)::bigint,
         COALESCE(array_agg(o.username), ARRAY[]::text[])
    FROM orphaned o;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_orphaned_if_revoked(UUID, UUID) TO authenticated;
