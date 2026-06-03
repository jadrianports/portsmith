-- =============================================================================
-- 009_storage_quota_before_insert.sql
-- CR-01 (Phase 8 pre-launch hardening) — atomic per-user storage quota.
-- =============================================================================
-- Closes the non-atomic read-then-write race in /api/media/upload (route step [D]).
-- The route reads storage_used_bytes, runs wouldExceedQuota, THEN writes — two
-- concurrent near-cap uploads can BOTH pass that app-level pre-check and BOTH land,
-- pushing the user over the 25 MiB cap (own-tenant storage-cost abuse on a $0 budget).
--
-- This BEFORE INSERT trigger on storage.objects locks the owner's profile row
-- (SELECT ... FOR UPDATE), re-checks the cap in the SAME txn that charges usage, and
-- RAISEs if the new object would exceed it. Two concurrent same-owner uploads now
-- SERIALIZE on the profile row → exactly one can succeed.
--
-- COEXISTS WITH 003 (D-07): Postgres fires all BEFORE triggers (this gate), performs
-- the insert, then all AFTER triggers. 003's sync_storage_usage() AFTER INSERT/DELETE
-- trigger is UNCHANGED — it still does the charge/decrement. This BEFORE trigger only
-- ADDS the lock + cap gate. Both apply the SAME non-user-bucket early-return + ::uuid
-- owner-cast safety, so the admin `templates` bucket is never gated/charged and never
-- hits the cast.
--
-- The route's read-then-check pre-check (step [D]) is now a fast-fail UX nicety, NOT
-- the authority — this trigger is the gate (zero app trust). MEDIA-03 hardened.
--
-- COUPLING: the `quota` constant below (26214400 = 25 MiB) MUST match
-- src/lib/media/upload-config.ts QUOTA_BYTES. There is no clean way to share a TS
-- constant into SQL; a future cap change must update BOTH.
-- =============================================================================
CREATE OR REPLACE FUNCTION enforce_storage_quota()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_id UUID;
  obj_size BIGINT;
  used     BIGINT;
  quota    CONSTANT BIGINT := 26214400; -- 25 MiB; MUST match upload-config.ts QUOTA_BYTES
BEGIN
  -- Same early-return as 003: only the user-writable buckets are quota-gated. RETURN
  -- NEW (NOT NULL — a BEFORE trigger returning NULL silently CANCELS the insert, which
  -- would abort a sanctioned admin `templates` upload) and run this guard BEFORE the
  -- ::uuid cast so a templates-bucket object named `logo.png` never hits the cast.
  IF NEW.bucket_id NOT IN ('avatars', 'media', 'resumes') THEN
    RETURN NEW;
  END IF;

  -- Owner is the first path segment; cast-safety mirrors 003 (only reached for the
  -- user buckets, whose objects always live under `{user_id}/...`).
  owner_id := ((storage.foldername(NEW.name))[1])::uuid;
  -- metadata.size is populated on the row at BEFORE INSERT time (003 reads the same
  -- field in its AFTER trigger); ::bigint matches the storage_used_bytes column math.
  obj_size := COALESCE((NEW.metadata->>'size')::bigint, 0);

  -- Row-lock the owner's profile. This serializes concurrent uploads by the SAME owner
  -- and locks the EXACT row 003's AFTER trigger UPDATEs — so the lock scope matches the
  -- contended resource. The second of two racing uploads blocks here until the first
  -- commits (including the AFTER-trigger charge), then re-reads the now-higher used
  -- value and correctly sees the reduced headroom.
  SELECT storage_used_bytes INTO used
    FROM public.profiles
    WHERE id = owner_id
    FOR UPDATE;

  -- Re-check the cap inside the lock. Exactly-at-cap is allowed (mirrors
  -- wouldExceedQuota: `used + incoming > QUOTA_BYTES` is the reject condition; strictly
  -- greater-than rejects).
  IF COALESCE(used, 0) + obj_size > quota THEN
    RAISE EXCEPTION 'storage quota exceeded: % + % > %', COALESCE(used, 0), obj_size, quota
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fires BEFORE the row is written (so it can abort) and BEFORE the 003 AFTER charge.
CREATE TRIGGER on_storage_object_before_insert
  BEFORE INSERT ON storage.objects
  FOR EACH ROW EXECUTE FUNCTION enforce_storage_quota();
