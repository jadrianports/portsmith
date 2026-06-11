'use server';

/**
 * freeUnsavedUpload (D-11 / UX-03) — free a freshly-uploaded-but-UNSAVED Storage
 * object the user just superseded (replaced or removed BEFORE saving), so no
 * orphan survives and `storage_used_bytes` stays accurate on the $0 tier.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS RIDES `deleteStorageObject`, NOT an authenticated `.remove()`
 * (RESEARCH Mechanism 1 — the decisive correction): the generic Supabase docs'
 * authenticated-client `.remove()` is IMPOSSIBLE here. Two locked-foundation
 * facts make it a silent no-op:
 *   - Migration 003 defines own-folder INSERT + DELETE policies on
 *     `storage.objects` but NO SELECT policy; Supabase's `.remove()` runs an
 *     internal locate-SELECT first, so the authenticated client finds nothing and
 *     deletes nothing.
 *   - The 002 protected-columns trigger RAISEs on the AFTER-DELETE
 *     `storage_used_bytes` decrement unless run as `service_role`.
 * `deleteStorageObject(url, sub)` already solves BOTH (service-role bypasses RLS
 * for the locate-SELECT and hits the 002:55 short-circuit so the
 * `sync_storage_usage` AFTER-DELETE trigger decrements correctly) AND is
 * own-folder-guarded + origin-locked + no-throw + WR-01 orphan-logging.
 *
 * DISJOINT FROM THE WR-03 ON-SAVE DIFF: `serverDroppedItemImageUrls`
 * (section-media-diff.ts) frees the PERSISTED churn on save. THIS action targets
 * ONLY the unsaved-session churn — the immediately-superseded in-session object.
 * The caller (image-uploader.tsx) gates on `superseded !== persistedValue`, so the
 * last-saved URL and any restore target are NEVER passed here. The own-folder
 * guard makes a foreign / cross-tenant / unparseable URL a safe no-op regardless.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `'use server'` modules export only async functions (Turbopack rejects sync
 * exports). The type alias is the only non-async export and is erased at build.
 */
import { deleteStorageObject } from '@/lib/media/delete-object';
import { getVerifiedClaims } from '@/lib/supabase/server';

export type FreeUploadResult = { ok: true } | { ok: false };

/**
 * Free the verified caller's own UNSAVED Storage object at `url`. Returns
 * `{ ok: true }` after the delete (or after the own-folder guard made it a safe
 * no-op); `{ ok: false }` when there is no verified subject (no delete attempted).
 *
 * The action NEVER writes `storage_used_bytes` — the AFTER-DELETE
 * `sync_storage_usage` trigger is the sole authority for the decrement (so the
 * quota can never be driven negative or inflated by this path).
 */
export async function freeUnsavedUpload(url: string): Promise<FreeUploadResult> {
  // SHARED-A identity head (copied from save-section-action.ts:128-135). Verified
  // identity only (AUTH-05 — never getSession).
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false };

  // WR-05: a verified claim MUST carry a subject — never coerce it to '' (an empty
  // owner would make deleteStorageObject's own-folder guard compare against '' and
  // could turn the guard into a no-op against an empty first segment).
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false };

  // D-11: the delete is delegated ENTIRELY to the service-role own-folder-guarded
  // primitive (the sanctioned Option-B Storage-delete path). It never throws; a
  // URL outside the caller's own folder is a safe no-op. The AFTER-DELETE trigger
  // owns the storage_used_bytes decrement.
  await deleteStorageObject(url, sub);
  return { ok: true };
}
