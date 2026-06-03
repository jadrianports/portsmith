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

  -- Read the RAW metadata.size (do NOT COALESCE-to-0 here). Supabase storage-api fires
  -- this BEFORE INSERT twice — a placeholder fire (no metadata.size) then the sized
  -- fire. The cap is authoritatively enforced on the SIZED fire; the NULL placeholder is
  -- skipped (it charges 0 and is superseded). A strict RAISE-on-NULL here would reject
  -- 100% of uploads (verified). [code-review WR-01: premise of a NULL-size bypass refuted
  -- by the two-fire behavior — the 003 AFTER trigger + this sized-fire gate together
  -- enforce the cap.]
  obj_size := (NEW.metadata->>'size')::bigint;
  IF obj_size IS NULL THEN
    -- Placeholder fire (no size yet): SKIP the cap gate. The sized fire that follows is
    -- the one that persists + is charged by the 003 AFTER trigger; gating this fire would
    -- reject every upload.
    RETURN NEW;
  END IF;

  -- Row-lock the owner's profile. This serializes concurrent uploads by the SAME owner
  -- and locks the EXACT row 003's AFTER trigger UPDATEs — so the lock scope matches the
  -- contended resource. The second of two racing uploads blocks here until the first
  -- commits (including the AFTER-trigger charge), then re-reads the now-higher used
  -- value and correctly sees the reduced headroom.
  SELECT storage_used_bytes INTO used
    FROM public.profiles
    WHERE id = owner_id
    FOR UPDATE;

  -- WR-02: fail closed if the owner has no profile row. Without this, FOR UPDATE takes no
  -- lock (nothing to lock), `used` is NULL, two concurrent uploads for that owner do not
  -- serialize, and the 003 AFTER trigger's `WHERE id = owner_id` matches 0 rows so the
  -- objects land uncharged and unbounded. A missing owner row is a hard reject. [code-
  -- review WR-02: serialization + charge both require the owner row to exist.]
  IF NOT FOUND THEN
    RAISE EXCEPTION 'storage quota: owner profile not found'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Re-check the cap inside the lock on the SIZED fire. Exactly-at-cap is allowed (mirrors
  -- wouldExceedQuota: `used + incoming > QUOTA_BYTES` is the reject condition; strictly
  -- greater-than rejects). No COALESCE masking on obj_size — a present-but-over size is
  -- enforced, never silently zeroed.
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
