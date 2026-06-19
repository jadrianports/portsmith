-- 027_username_change.sql
-- Phase 30 (Change Username & Vanity URL) — Plan 30-02.
--
-- The data-layer foundation for owner-initiated username changes. `username` is a
-- PROTECTED column (enforce_protected_profile_columns); the ONLY legal change path is
-- a sanctioned txn-local GUC set inside a SECURITY DEFINER RPC. This migration adds, in
-- four sections:
--
--   (1) username_history — the write-once old_handle → user_id table (D-01). A renamed
--       handle is reserved forever and resolves to the user's CURRENT username, so
--       A→B→C lands /A and /B on /C in a single hop. ON DELETE CASCADE to profiles(id)
--       releases an account's old handles on deletion.
--   (2) public_username_redirects — the anon-readable redirect lookup (HANDLE-02, D-22).
--       A security_invoker view projecting ONLY old_handle + the resolved current
--       username — NEVER user_id. The old→current resolution (the user_id JOIN) runs in
--       a SECURITY DEFINER helper so anon is never column-granted user_id and the FK
--       never leaks (the 005 three-layer doctrine: a definer view is banned, but the
--       JOIN needs user_id — so the JOIN lives in a definer HELPER, the view stays
--       invoker, and anon reads only the non-sensitive old_handle column).
--   (3) change_username(new_username) — the HANDLE-03 sanctioned RPC. Mirrors
--       set_onboarding_username (026) with two deltas: the scope is the already-onboarded
--       row (onboarded_at IS NOT NULL, the complement), and it ALSO writes the
--       username_history row + runs the D-04 union-uniqueness backstop + the D-05
--       self-reclaim DELETE, all in one transaction.
--   (4) enforce_protected_profile_columns — re-emit 026's body UNCHANGED plus ONE new
--       sanctioned short-circuit honoring portsmith.sanctioned_username_change, scoped to
--       the own onboarded row with every OTHER protected column IS NOT DISTINCT FROM OLD
--       (username is the one mutable column).
--
-- All function statements are CREATE OR REPLACE (idempotent). GRANTs are re-applied here
-- because a local `supabase db reset` drops platform-default grants (30-RESEARCH.md
-- Pitfall 6).

-- =============================================================================
-- 1. username_history  (write-once old_handle → user_id; D-01)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.username_history (
  old_handle TEXT PRIMARY KEY,                                  -- write-once; reserved-forever (D-04)
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_username_history_user
  ON public.username_history(user_id);

ALTER TABLE public.username_history ENABLE ROW LEVEL SECURITY;

-- No client INSERT/UPDATE/DELETE policies: every write happens inside the
-- SECURITY DEFINER change_username RPC (which runs as owner, bypassing RLS),
-- consistent with the rate_limit_events deny-all posture.
--
-- READS: anon/authenticated may read ONLY the old_handle column (a former PUBLIC
-- handle — not sensitive), needed so the security_invoker view below returns rows.
-- user_id is NEVER column-granted to a client, so a direct base-table read of
-- user_id is permission-denied and the FK cannot leak (D-22 / Pitfall 3).
GRANT SELECT (old_handle) ON public.username_history TO anon, authenticated;

-- SERVICE ROLE: the trusted server-only key (bypasses RLS) gets full DML, mirroring
-- the rate_limit_events grant set — the account-delete sweep + admin maintenance run
-- through it. Platform default privileges only confer TRUNCATE/REFERENCES/TRIGGER on a
-- NEW table; the data privileges other tables hold for service_role were applied by the
-- platform out-of-band, so re-apply them here (30-RESEARCH.md Pitfall 6 — a db reset
-- drops platform grants and they must live in the migration).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.username_history TO service_role;

DROP POLICY IF EXISTS "username_history old_handle is publicly readable" ON public.username_history;
CREATE POLICY "username_history old_handle is publicly readable"
  ON public.username_history FOR SELECT
  TO anon, authenticated
  USING (true);

-- =============================================================================
-- 2. public_username_redirects  (HANDLE-02 anon redirect lookup; D-22 no user_id leak)
-- =============================================================================
-- The old→current resolution JOINs username_history → profiles on user_id and gates
-- on profile_is_public. Under security_invoker the JOIN would require anon to read
-- user_id (a leak). So the JOIN lives in this SECURITY DEFINER helper (runs as owner,
-- reads user_id + profiles internally, returns ONLY the resolved current handle), and
-- the view stays security_invoker over the non-sensitive old_handle column.
CREATE OR REPLACE FUNCTION public.current_handle_for(p_old_handle TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT p.username
  FROM public.username_history h
  JOIN public.profiles p ON p.id = h.user_id
  WHERE h.old_handle = p_old_handle
    AND profile_is_public(p.id)   -- only redirect to a published / non-locked target
$$;

GRANT EXECUTE ON FUNCTION public.current_handle_for(TEXT) TO anon, authenticated;

-- The view projects ONLY old_handle + the resolved current username — NEVER user_id
-- (key_links: security_invoker JOIN-via-helper to profiles, projecting current handle).
CREATE OR REPLACE VIEW public.public_username_redirects
  WITH (security_invoker = true) AS
  SELECT h.old_handle,
         public.current_handle_for(h.old_handle) AS current_username
  FROM public.username_history h;

GRANT SELECT ON public.public_username_redirects TO anon, authenticated, service_role;

-- =============================================================================
-- 3. change_username(new_username TEXT)  (HANDLE-03 sanctioned onboarded-change RPC)
-- =============================================================================
-- Mirrors set_onboarding_username (026) with the scope inverted to the ALREADY-
-- onboarded row (onboarded_at IS NOT NULL) and the atomic history write + union-
-- uniqueness + self-reclaim added. The txn-local GUC (third arg `true`) is rolled
-- back at COMMIT/ROLLBACK, never leaks across pooled connections, and a client cannot
-- forge it (PostgREST blocks arbitrary GUC sets).
CREATE OR REPLACE FUNCTION public.change_username(new_username TEXT)
RETURNS VOID
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_old      TEXT;
  -- The reserved array MUST stay byte-for-byte in sync with RESERVED_USERNAMES in
  -- src/lib/validations/username.ts (CR-03) — same array as handle_new_user /
  -- set_onboarding_username. A drift unit test (change-username-reserved-sync) asserts it.
  v_reserved TEXT[] := ARRAY[
    'admin','api','dashboard','login','signup','settings','www','app',
    'portsmith','support','help','about','terms','privacy','root',
    'null','undefined'
  ];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- DB BACKSTOP (CR-03): mirror the Zod usernameSchema gate (^[a-z][a-z0-9-]*$,
  -- length 3–30) + the reserved guard. A direct PostgREST RPC call bypasses app Zod.
  IF new_username IS NULL OR new_username !~ '^[a-z][a-z0-9-]*$'
     OR length(new_username) < 3 OR length(new_username) > 30 THEN
    RAISE EXCEPTION 'username is invalid';
  END IF;
  IF lower(new_username) = ANY (v_reserved) THEN
    RAISE EXCEPTION 'username is reserved';
  END IF;

  -- Capture the OLD handle from the caller's OWN already-onboarded row. 0 rows / NULL
  -- → not eligible (a not-yet-onboarded user uses set_onboarding_username instead).
  SELECT username INTO v_old
  FROM public.profiles
  WHERE id = v_user_id AND onboarded_at IS NOT NULL;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'no eligible profile';
  END IF;

  -- No-op: changing to the current handle does nothing (no history row, no cooldown
  -- burn — the cooldown is the action's concern; the RPC RETURNs before any write).
  IF v_old = new_username THEN
    RETURN;
  END IF;

  -- UNION-UNIQUENESS backstop (D-04 reserved-for-others, D-05 owner self-reclaim):
  -- reject if taken by ANOTHER user's live profile OR present in ANOTHER user's history.
  -- The own-row / own-history is intentionally excluded so D-05 self-reclaim is allowed.
  IF EXISTS (
       SELECT 1 FROM public.profiles
       WHERE username = new_username AND id <> v_user_id
     )
   OR EXISTS (
       SELECT 1 FROM public.username_history
       WHERE old_handle = new_username AND user_id <> v_user_id
     ) THEN
    RAISE EXCEPTION 'username is already taken';
  END IF;

  -- Sanction marker the trigger honors for THIS own-row, onboarded, username-only change.
  PERFORM set_config('portsmith.sanctioned_username_change', 'on', true);

  -- (a) write-once history of the OLD handle (idempotent on re-entry).
  INSERT INTO public.username_history (old_handle, user_id)
    VALUES (v_old, v_user_id)
    ON CONFLICT (old_handle) DO NOTHING;

  -- (b) D-05 self-reclaim: if the NEW handle was the user's OWN prior handle, clear it
  --     from history so it returns to being a live profiles.username.
  DELETE FROM public.username_history
    WHERE old_handle = new_username AND user_id = v_user_id;

  -- (c) the protected-column swap (own onboarded row only).
  UPDATE public.profiles
    SET username = new_username
    WHERE id = v_user_id AND onboarded_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only authenticated owners may call it (the auth.uid() guard hard-fails anon).
GRANT EXECUTE ON FUNCTION public.change_username(TEXT) TO authenticated;

-- =============================================================================
-- 4. enforce_protected_profile_columns()  (add the onboarded-username-change sanction)
-- =============================================================================
-- Re-emit the 026 body UNCHANGED (service-role + admin + sanctioned_self_deletion +
-- sanctioned_onboarding_username clauses) PLUS ONE new sanctioned short-circuit honoring
-- the txn-local 'portsmith.sanctioned_username_change' marker ONLY when:
--   (a) the marker is set (by change_username; `true` = missing_ok);
--   (b) the row belongs to the caller (OLD.id = auth.uid()) — OWN ROW ONLY;
--   (c) the row IS onboarded (OLD.onboarded_at IS NOT NULL) — the complement of the
--       onboarding clause's NULL window;
--   (d) EVERY OTHER protected column IS NOT DISTINCT FROM its OLD value.
-- So ONLY a username change on the caller's own onboarded row passes; it can NEVER let
-- through a role/email/storage/locked/deleted_at/created_at change (clause (d)). username
-- is intentionally ABSENT from the (d) list — it is the one column allowed to move.
CREATE OR REPLACE FUNCTION public.enforce_protected_profile_columns()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- SERVICE-ROLE / moderation-flow short-circuit (002, unchanged).
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT (role = 'admin') INTO is_admin FROM public.profiles WHERE id = auth.uid();
  IF is_admin THEN
    RETURN NEW;  -- admins (and the moderation flow) may change these
  END IF;

  -- DEF-01: SANCTIONED SELF-DELETION short-circuit (002, unchanged).
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

  -- D-06: SANCTIONED ONBOARDING-USERNAME short-circuit (026, unchanged).
  IF current_setting('portsmith.sanctioned_onboarding_username', true) = 'on'
   AND OLD.id = auth.uid()
   AND OLD.onboarded_at IS NULL
   AND NEW.role               IS NOT DISTINCT FROM OLD.role
   AND NEW.locked             IS NOT DISTINCT FROM OLD.locked
   AND NEW.locked_reason      IS NOT DISTINCT FROM OLD.locked_reason
   AND NEW.storage_used_bytes IS NOT DISTINCT FROM OLD.storage_used_bytes
   AND NEW.deleted_at         IS NOT DISTINCT FROM OLD.deleted_at
   AND NEW.email              IS NOT DISTINCT FROM OLD.email
   AND NEW.created_at         IS NOT DISTINCT FROM OLD.created_at
  THEN
    RETURN NEW;  -- sanctioned own-row onboarding handle-set only; falls through otherwise
  END IF;

  -- HANDLE-03: SANCTIONED ONBOARDED USERNAME-CHANGE short-circuit (NEW in 027).
  -- Mirrors the onboarding carve-out with the scope inverted to onboarded_at IS NOT
  -- NULL and a distinct GUC. username is the ONE mutable column; every other protected
  -- column is pinned IS NOT DISTINCT FROM OLD. Set by change_username.
  IF current_setting('portsmith.sanctioned_username_change', true) = 'on'
   AND OLD.id = auth.uid()
   AND OLD.onboarded_at IS NOT NULL
   AND NEW.role               IS NOT DISTINCT FROM OLD.role
   AND NEW.locked             IS NOT DISTINCT FROM OLD.locked
   AND NEW.locked_reason      IS NOT DISTINCT FROM OLD.locked_reason
   AND NEW.storage_used_bytes IS NOT DISTINCT FROM OLD.storage_used_bytes
   AND NEW.deleted_at         IS NOT DISTINCT FROM OLD.deleted_at
   AND NEW.email              IS NOT DISTINCT FROM OLD.email
   AND NEW.created_at         IS NOT DISTINCT FROM OLD.created_at
  THEN
    RETURN NEW;  -- sanctioned own-row onboarded handle-change only; falls through otherwise
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
