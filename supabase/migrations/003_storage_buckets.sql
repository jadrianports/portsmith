-- 003_storage_buckets.sql
-- Phase 1 (Security & Data Foundation) — Plan 01-06 — handoff T5 (storage)
--
-- The four storage buckets (with MIME allowlists + size caps), the storage.objects
-- RLS policies (per-user folder writes; admin-only template thumbnails), and the
-- server-authoritative storage-usage trigger that keeps profiles.storage_used_bytes
-- in sync with actual object writes.
--
-- SOURCE OF TRUTH (transcribed verbatim from docs/02-security-rls.md "Storage"):
--   - the four-bucket INSERT into storage.buckets (file_size_limit + allowed_mime_types)
--   - the "Users upload to own folder" INSERT and "Users delete own files" DELETE policies
--   - sync_storage_usage() + on_storage_object_change AFTER INSERT OR DELETE trigger
-- The admin-write policy on the `templates` bucket implements the doc's note that
-- "Template thumbnails (templates bucket) are admin-write only."
--
-- SECURITY (CLAUDE.md non-negotiable invariants):
--   - SVG and GIF MIME types are DELIBERATELY EXCLUDED from every allowlist — SVG
--     can carry embedded scripts (an XSS vector); GIF is not needed. JPG/PNG/WebP
--     only for images; PDF only for resumes. Enforced by Supabase regardless of
--     how the upload is attempted (T-06-03).
--   - storage_used_bytes is SERVER-AUTHORITATIVE: it is a protected column (the
--     002 trigger blocks direct client writes) AND is maintained only by
--     sync_storage_usage from actual object INSERT/DELETE (T-06-02).
--   - Object `name` within a bucket is `{user_id}/{context}/{filename}` (CLAUDE.md
--     storage path convention), so (storage.foldername(name))[1] is the user_id.
--     The usage trigger casts that segment to ::uuid, so a non-UUID first segment
--     errors (01-RESEARCH Pitfall 6).
--
-- SCOPE: storage buckets + storage.objects policies + the usage trigger ONLY. NO
-- base-table RLS policies for profiles/portfolios/etc. — those are Plan 01-07.

-- =============================================================================
-- 1. Buckets  (all public-read; write access controlled by RLS on storage.objects)
--
--    VERBATIM allowlists + size caps from docs/02-security-rls.md:
--      avatars / media / templates : 5 MiB (5242880), image/jpeg|png|webp
--      resumes                     : 10 MiB (10485760), application/pdf
--
--    ON CONFLICT DO NOTHING so a re-`db reset` (or a seed that inserts the same
--    rows) is safe.
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('avatars',   'avatars',   true, 5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('media',     'media',     true, 5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('resumes',   'resumes',   true, 10485760, ARRAY['application/pdf']),
  ('templates', 'templates', true, 5242880,  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. storage.objects RLS policies
--
--    Users write/delete only under their own `{user_id}/...` folder. VERBATIM
--    from docs/02-security-rls.md, with the addition of the admin-only write
--    policies for the `templates` bucket (template thumbnails are admin-managed).
-- =============================================================================

-- Users may upload only into their own folder in the user-writable buckets.
CREATE POLICY "Users upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('avatars','media','resumes')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users may delete only files in their own folder (any user-writable bucket).
CREATE POLICY "Users delete own files"
  ON storage.objects FOR DELETE
  USING ((storage.foldername(name))[1] = auth.uid()::text);

-- Template thumbnails: admin-write only. Same admin role check pattern used
-- elsewhere (EXISTS over profiles WHERE id = auth.uid() AND role = 'admin').
CREATE POLICY "Admins upload template thumbnails"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'templates'
    AND EXISTS (
      SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins delete template thumbnails"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'templates'
    AND EXISTS (
      SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================================================
-- 3. sync_storage_usage()  (+ on_storage_object_change AFTER INSERT OR DELETE trigger)
--
--    VERBATIM from docs/02-security-rls.md. Keeps profiles.storage_used_bytes
--    authoritative server-side — the client never writes it. The owning user is
--    derived from the object path's first folder segment ({user_id}/...). On
--    INSERT add the object size; on DELETE subtract with GREATEST(0, ...) so the
--    counter never goes negative. SECURITY DEFINER (storage.objects writes happen
--    under the caller's role, but the profiles UPDATE needs definer rights and
--    must bypass the protected-columns trigger as the function owner).
-- =============================================================================
CREATE OR REPLACE FUNCTION sync_storage_usage()
RETURNS TRIGGER AS $$
DECLARE
  owner_id UUID;
  obj_size BIGINT;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    owner_id := ((storage.foldername(NEW.name))[1])::uuid;
    obj_size := COALESCE((NEW.metadata->>'size')::bigint, 0);
    UPDATE profiles SET storage_used_bytes = storage_used_bytes + obj_size
      WHERE id = owner_id;
  ELSIF (TG_OP = 'DELETE') THEN
    owner_id := ((storage.foldername(OLD.name))[1])::uuid;
    obj_size := COALESCE((OLD.metadata->>'size')::bigint, 0);
    UPDATE profiles SET storage_used_bytes = GREATEST(0, storage_used_bytes - obj_size)
      WHERE id = owner_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_storage_object_change
  AFTER INSERT OR DELETE ON storage.objects
  FOR EACH ROW EXECUTE FUNCTION sync_storage_usage();
