-- =============================================================================
-- 031_storage_quota_raise_65mib.sql
-- 34-01 (D-10 / MEDIA-01) — raise the per-user storage cap 25 MiB -> 65 MiB.
-- =============================================================================
-- Forward-only `CREATE OR REPLACE FUNCTION` of the atomic per-user quota trigger
-- function first shipped in 009_storage_quota_before_insert.sql. The v2.8 gallery
-- chain (batch image uploads) needs more headroom than the original 25 MiB cap; this
-- raises the SINGLE constant the BEFORE-INSERT trigger enforces.
--
-- This swaps the function BODY in place. The `on_storage_object_before_insert` trigger
-- (009:101-103) is NOT re-created — it already binds to `enforce_storage_quota()` and
-- `CREATE OR REPLACE FUNCTION` updates the body the existing trigger calls. Re-creating
-- the trigger would error on the existing one.
--
-- No new table is created, so the "new-table explicit GRANT" rule (CLAUDE.md) does NOT
-- apply — no `GRANT ... TO authenticated, service_role` is needed for a function replace.
--
-- Apply forward-only via `supabase migration up` — NEVER `db reset` (db reset drops the
-- local platform-default role grants + seed data on this stack).
--
-- COUPLING: the `quota` constant below (68157440 = 65 MiB) MUST match
-- src/lib/media/upload-config.ts QUOTA_BYTES. There is no clean way to share a TS
-- constant into SQL; a future cap change must update BOTH. The drift canary is
-- tests/unit/media/quota-linkage.test.ts (asserts both === 68157440).
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
  quota    CONSTANT BIGINT := 68157440; -- 65 MiB; MUST match upload-config.ts QUOTA_BYTES
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
