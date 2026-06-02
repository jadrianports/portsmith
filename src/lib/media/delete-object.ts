import 'server-only';

/**
 * deleteStorageObject — the shared orphan-delete primitive (D-12), consumed by
 * BOTH Wave-3 slices (05-03 item-image remove/replace, 05-04 résumé/avatar
 * delete-on-replace). Built once here in the spine so 05-03 and 05-04 stay
 * disjoint and parallel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RULE-4-RESOLVED OPTION B (supersedes the plan's RESEARCH-A3 authenticated-client
 * + own-folder-RLS guidance). A founder-approved architectural decision: ALL
 * Storage deletes go through the SERVER-ONLY service-role admin client, gated by an
 * EXPLICIT verified-sub own-folder check — NOT the authenticated client under
 * own-folder DELETE RLS. Two VERIFIED pre-existing foundation bugs make the
 * authenticated path impossible WITHOUT modifying the locked security foundation:
 *
 *   FINDING 1 — NO SELECT POLICY ON storage.objects (migration 003 defines own-folder
 *   INSERT (003:58-63) + DELETE (003:66-68) but NO SELECT). Supabase Storage's
 *   `remove()` runs an internal SELECT to LOCATE the row before deleting it; with no
 *   SELECT policy the authenticated client's `.remove()` finds nothing and silently
 *   deletes NOTHING (empirically confirmed: the Wave-0 orphan-delete contract body
 *   left the object in place under `clientA.storage.remove`).
 *
 *   FINDING 2 — THE 002 PROTECTED-COLUMNS TRIGGER. `enforce_protected_profile_columns`
 *   (002:39-122) short-circuits on `auth.role()='service_role'` (002:55) but RAISEs on
 *   ANY `storage_used_bytes` change otherwise (002:112). The AFTER-DELETE
 *   `sync_storage_usage` leg (003:126-133) UPDATEs `storage_used_bytes`; run under the
 *   end-user `authenticated` role that UPDATE RAISEs → the delete aborts. The existing
 *   self-deletion carve-out (002:93-106) deliberately FORBIDS GUC-gated
 *   `storage_used_bytes` changes (quota-evasion guard), so a naive GUC fix is unsafe.
 *
 * WHY SERVICE-ROLE FIXES BOTH WITH ZERO FOUNDATION CHANGE: `service_role` BYPASSES RLS
 * (so the locate-SELECT inside `remove()` succeeds) AND hits the 002:55 short-circuit
 * (so the `storage_used_bytes` decrement syncs correctly). This extends CLAUDE.md's
 * sanctioned "contact / page-view writes go through a server-side service-role route"
 * pattern to Storage. RLS remains the cross-tenant boundary for all direct-key access;
 * this authoritative server helper is the sanctioned service-role escape hatch.
 *
 * THE OWN-FOLDER GUARD REPLACES RLS AS THE DELETE BOUNDARY (mandatory, tested): because
 * `service_role` bypasses RLS, the own-folder check that own-folder DELETE RLS used to
 * provide MUST be re-asserted in app code here. The caller ALWAYS passes the
 * server-verified `sub`; we reject any path whose first segment is not that sub. This
 * prevents the service-role power from becoming a cross-tenant delete hole.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This is a SERVER module (`import 'server-only'` first line + the service-role admin
 * client) — call it ONLY from a server action / route, never a client component.
 */
import { supabaseAdmin } from '@/lib/supabase/service-role';

import { urlToStoragePath } from './storage-path';
import type { UploadBucket } from './upload-config';

/** The user-writable buckets a caller may ever delete from (migration 003). */
const DELETABLE_BUCKETS = new Set<UploadBucket>(['avatars', 'media', 'resumes']);

/**
 * Delete a Storage object by its public URL, on behalf of the verified owner.
 *
 * @param url       The public Storage URL to delete (typically the prior avatar /
 *                  project-image / résumé URL being replaced or cleared).
 * @param ownerSub  The SERVER-VERIFIED subject (the owner). The caller resolves this
 *                  from `getVerifiedClaims()` — it is NEVER client-supplied. The
 *                  own-folder guard below asserts the object lives under this sub.
 *
 * Safe no-op (returns cleanly) when:
 *   - the URL does not parse to a Storage-origin object (foreign / unparseable → the
 *     spine's `urlToStoragePath` returns null — nothing to delete);
 *   - the bucket is not a user-writable bucket;
 *   - the path's first segment is NOT `ownerSub` (the OWN-FOLDER GUARD — a crafted
 *     cross-tenant URL is REJECTED, not deleted: this is the boundary that replaces
 *     own-folder DELETE RLS now that we run under service-role).
 */
export async function deleteStorageObject(
  url: string,
  ownerSub: string,
): Promise<void> {
  const parsed = urlToStoragePath(url);
  if (!parsed) return; // non-Storage / unparseable → nothing to delete

  // OWN-FOLDER GUARD (replaces RLS as the delete boundary — Option B). The object
  // path is `{ownerSub}/{context}/{file}`; the first segment MUST equal the verified
  // owner. A path outside the caller's own folder is REJECTED (no delete) so the
  // service-role client can NEVER be steered into a cross-tenant delete.
  if (!DELETABLE_BUCKETS.has(parsed.bucket as UploadBucket)) return;
  const firstSegment = parsed.path.split('/')[0];
  if (firstSegment !== ownerSub) return; // cross-tenant / foreign-folder → reject

  // Delete via the SERVICE-ROLE admin client. RLS is bypassed (so the internal
  // locate-SELECT succeeds — Finding 1) and the AFTER-DELETE trigger's
  // `storage_used_bytes` decrement runs under service_role (002:55 short-circuit —
  // Finding 2), so the usage counter syncs correctly.
  await supabaseAdmin.storage.from(parsed.bucket).remove([parsed.path]);
}
