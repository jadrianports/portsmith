-- 026_oauth_provisional_username.sql
-- Phase 28 (OAuth Social Login — Google) — Plan 28-01.
--
-- Resolves the deferred "Phase 2 provisional-username carve-out" the 002 trigger
-- comments describe. Google OAuth supplies NO `username` in raw_user_meta_data,
-- so the STRICT 002 `handle_new_user` RAISEd "username is required at signup" and
-- broke every OAuth create. This migration carries the function forward with:
--
--   (1) handle_new_user — an AUTO-LINK GUARD (skip the INSERT when a profile
--       already exists for NEW.id, OAUTH-05) + a PROVISIONAL DERIVATION (when no
--       username is supplied, derive a collision-safe, format-valid, non-reserved
--       handle from the email local-part — D-04/D-05) keeping username assignment
--       ATOMIC with profile creation (no NULL-username window). The credential
--       path's reserved/format guards are preserved byte-for-byte (CR-03).
--   (2) set_onboarding_username — a narrow SECURITY DEFINER RPC giving the
--       onboarding handle-edit step (Plan 04) a legal write path to the PROTECTED
--       `username` column, scoped to the caller's own NOT-YET-ONBOARDED row (D-06).
--   (3) enforce_protected_profile_columns — re-emit 002's body UNCHANGED except a
--       single new sanctioned short-circuit (mirrors the sanctioned_self_deletion
--       carve-out) honoring the txn-local GUC the RPC sets, ONLY for the own-row,
--       username-only, not-yet-onboarded change with every OTHER protected column
--       unchanged.
--
-- IDENTITY-LINKING (T-28-01): Supabase automatic identity linking attaches a
-- Google identity to an existing user ONLY on a VERIFIED-email match and strips
-- unconfirmed identities (pre-account-takeover guard, D-02). Portsmith autoconfirms,
-- so every existing account email is already verified. The auto-link guard ensures
-- no second profile is created for the linked account (OAUTH-05).
--
-- initialize_portfolio() is UNCHANGED — OAUTH-04 reuses it as-is (not redefined here).
--
-- All statements are CREATE OR REPLACE (idempotent). The on_auth_user_created and
-- protect_profile_columns triggers reference these functions BY NAME; the trigger
-- definitions are unchanged, so the function-body replacement alone is sufficient.

-- =============================================================================
-- 1. handle_new_user()  (provisional-username carve-out + auto-link guard)
-- =============================================================================
-- SEARCH_PATH + SCHEMA-QUALIFICATION (required, carried from 002): this trigger
-- fires on auth.users INSERT in GoTrue's supabase_auth_admin context whose
-- search_path excludes `public`. Pin `SET search_path` AND schema-qualify
-- `public.profiles` so a bare INSERT cannot fail with the opaque "Database error
-- creating new user".
--
-- CR-03 (DB-LEVEL SIGNUP GATE): raw_user_meta_data is CLIENT-SUPPLIED and NOT run
-- through the Zod usernameSchema (a direct anon auth.signUp bypasses app code). The
-- DB is the last line of defense — the reserved/format guards run here. The
-- v_reserved array MIRRORS RESERVED_USERNAMES in src/lib/validations/username.ts
-- byte-for-byte; touching it here means updating both (a Vitest unit test asserts
-- the two stay in sync — oauth-handle-derive.test.ts).
-- CR-02 (GUARDED INSERT): a concurrent INSERT that wins the handle raises
-- unique_violation; catch and re-raise a legible message instead of GoTrue's
-- generic "Database error creating new user".
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_username     TEXT := NEW.raw_user_meta_data->>'username';
  v_display_name TEXT := COALESCE(
                           NEW.raw_user_meta_data->>'full_name',    -- Google sends full_name / name
                           NEW.raw_user_meta_data->>'name',
                           NEW.raw_user_meta_data->>'display_name',
                           NEW.raw_user_meta_data->>'username'
                         );
  v_base         TEXT;
  v_candidate    TEXT;
  v_suffix       INT := 1;
  -- The reserved array MUST stay byte-for-byte in sync with RESERVED_USERNAMES in
  -- src/lib/validations/username.ts (CR-03). Touching it here = update both.
  v_reserved     TEXT[] := ARRAY[
    'admin','api','dashboard','login','signup','settings','www','app',
    'portsmith','support','help','about','terms','privacy','root',
    'null','undefined'
  ];
BEGIN
  -- (0) AUTO-LINK GUARD (OAUTH-05): if a profile already exists for this auth id,
  -- this INSERT is a linked identity on an existing user — do NOT create a second
  -- profile. Automatic identity linking keeps the SAME auth.users.id, so NEW.id
  -- already has a profiles row from the original email/password signup. Idempotent
  -- regardless of GoTrue's exact AFTER-INSERT firing semantics (Pitfall 1).
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- (1) PROVISIONAL DERIVATION (D-05) when no username was supplied (OAuth path).
  IF v_username IS NULL THEN
    -- local-part → lowercase → strip to [a-z0-9-] → must start with a letter.
    v_base := lower(split_part(COALESCE(NEW.email, ''), '@', 1));
    v_base := regexp_replace(v_base, '[^a-z0-9-]', '', 'g');     -- charset
    v_base := regexp_replace(v_base, '^[^a-z]+', '', '');         -- must start with a letter
    IF v_base IS NULL OR length(v_base) < 3 THEN
      v_base := 'user';                                           -- safe fallback for empty/short local-parts
    END IF;
    v_base := left(v_base, 30);                                   -- length cap (suffix may re-trim below)

    -- reserved or taken → append numeric suffix until free (collision-safe).
    v_candidate := v_base;
    WHILE (lower(v_candidate) = ANY (v_reserved))
       OR EXISTS (SELECT 1 FROM public.profiles WHERE username = v_candidate) LOOP
      v_suffix := v_suffix + 1;
      -- keep total <= 30: trim the base to make room for the suffix digits.
      v_candidate := left(v_base, 30 - length(v_suffix::text)) || v_suffix::text;
    END LOOP;
    v_username := v_candidate;
  ELSE
    -- (1b) CREDENTIAL PATH unchanged: explicit username supplied (signup form) →
    -- enforce the reserved guard exactly as 002 did (CR-03). Format is already
    -- Zod-gated client+server, and the 001 CHECK constraint backstops it.
    IF lower(v_username) = ANY (v_reserved) THEN
      RAISE EXCEPTION 'username is reserved';
    END IF;
  END IF;

  -- (2) cap display_name length (mirrors the Zod 100-char cap), then fall back to
  -- the handle so an OAuth user with no provider name still gets a display_name.
  IF v_display_name IS NOT NULL AND length(v_display_name) > 100 THEN
    v_display_name := left(v_display_name, 100);
  END IF;
  v_display_name := COALESCE(v_display_name, v_username);

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
    -- CR-02: a concurrent INSERT won the handle between the WHILE check and the
    -- INSERT. Re-raise legibly (matches the 002 posture). The OAuth path's window
    -- is vanishingly small (generated handle); the credential form surfaces this.
    RAISE EXCEPTION 'username is already taken';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. set_onboarding_username(new_username TEXT)  (the sanctioned onboarding write)
-- =============================================================================
-- D-06: username is a PROTECTED column — an ordinary authenticated UPDATE is
-- blocked by enforce_protected_profile_columns. The onboarding handle-edit step
-- (Plan 04) needs a legal write path scoped to the FIRST-SET window only. This RPC
-- mirrors the request_account_deletion sanctioned-write pattern (002): a
-- SECURITY DEFINER function gated on auth.uid(), that mirrors the SAME format +
-- reserved guards the Zod gate enforces (CR-03), sets a TRANSACTION-LOCAL GUC the
-- protected-columns trigger honors, then UPDATEs only the caller's own
-- not-yet-onboarded row. Real change-username UX is Phase 30; this stays scoped.
--
-- The txn-local marker (third arg `true` to set_config) is rolled back at
-- COMMIT/ROLLBACK and never leaks across pooled connections. A client cannot set
-- arbitrary GUCs (PostgREST blocks it) — there is no surface to forge this marker.
CREATE OR REPLACE FUNCTION public.set_onboarding_username(new_username TEXT)
RETURNS VOID
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  -- Mirror RESERVED_USERNAMES (CR-03) — same array as handle_new_user.
  v_reserved TEXT[] := ARRAY[
    'admin','api','dashboard','login','signup','settings','www','app',
    'portsmith','support','help','about','terms','privacy','root',
    'null','undefined'
  ];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Mirror the Zod usernameSchema gate (USERNAME_REGEX: 3–30, lowercase, must
  -- start with a letter, [a-z0-9-]; then the reserved-name guard). The server
  -- action also re-parses with Zod (SHARED-A); this is the DB backstop.
  IF new_username IS NULL OR new_username !~ '^[a-z][a-z0-9-]*$'
     OR length(new_username) < 3 OR length(new_username) > 30 THEN
    RAISE EXCEPTION 'username is invalid';
  END IF;
  IF lower(new_username) = ANY (v_reserved) THEN
    RAISE EXCEPTION 'username is reserved';
  END IF;

  -- Txn-local sanction marker the protected-columns trigger checks for the
  -- own-row, not-yet-onboarded, username-only change. `true` = local to this txn.
  PERFORM set_config('portsmith.sanctioned_onboarding_username', 'on', true);

  -- SCOPE GUARD: only the caller's OWN row, and ONLY while not yet onboarded
  -- (the first-set window). A returning/onboarded user gets 0 rows updated.
  UPDATE public.profiles
    SET username = new_username
    WHERE id = v_user_id
      AND onboarded_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only authenticated owners may call it (the auth.uid() guard hard-fails anon).
GRANT EXECUTE ON FUNCTION public.set_onboarding_username(TEXT) TO authenticated;

-- =============================================================================
-- 3. enforce_protected_profile_columns()  (add the onboarding-username sanction)
-- =============================================================================
-- Re-emit the 002 body UNCHANGED except for ONE new sanctioned short-circuit,
-- mirroring the existing sanctioned_self_deletion carve-out. It honors the
-- txn-local 'portsmith.sanctioned_onboarding_username' marker ONLY when:
--   (a) the marker is set (by set_onboarding_username; `true` = missing_ok so a
--       never-set GUC returns NULL, not an error);
--   (b) the row belongs to the caller (OLD.id = auth.uid()) — OWN ROW ONLY;
--   (c) the row is NOT yet onboarded (OLD.onboarded_at IS NULL) — first-set window;
--   (d) EVERY OTHER protected column IS NOT DISTINCT FROM its OLD value.
-- So ONLY a username change on the caller's own not-yet-onboarded row passes; it can
-- NEVER let through a role/email/storage/locked/deleted_at/created_at change (clause
-- (d)). The blast radius is exactly "set your handle during onboarding" — which IS
-- the intended capability — so FND-03 is preserved. A client cannot forge the GUC.
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

  -- D-06: SANCTIONED ONBOARDING-USERNAME short-circuit (NEW in 026). Mirrors the
  -- carve-out above: own-row, not-yet-onboarded, USERNAME-ONLY change with every
  -- OTHER protected column byte-for-byte unchanged. Set by set_onboarding_username.
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
