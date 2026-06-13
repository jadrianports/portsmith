import 'server-only';

/**
 * sweepUserStorage — the net-new account-delete Storage folder-sweep (D-09/D-11,
 * ACCT-05). Generalizes the single-object `deleteStorageObject` primitive
 * (delete-object.ts) into a full per-user, all-buckets sweep, run as the FIRST
 * privileged step of `POST /api/account/delete` BEFORE `admin.deleteUser(sub)`.
 *
 * `import 'server-only'` (the FIRST line, intentionally) is the FND-05 compile-time
 * wall — any attempt to import this from a Client Component is a BUILD ERROR, so the
 * service-role key can never reach a browser bundle (the same guard as
 * `service-role.ts:1` and `delete-object.ts:1`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY SERVICE-ROLE (inherits delete-object.ts FINDING 1/2). The authenticated
 * client CANNOT sweep:
 *   FINDING 1 — there is NO SELECT policy on `storage.objects` (migration 003 grants
 *   own-folder INSERT + DELETE but no SELECT). Storage's `list()`/`remove()` run an
 *   internal locate-SELECT; under the end-user role that finds nothing and silently
 *   no-ops (the orphan survives).
 *   FINDING 2 — the 002 protected-columns trigger RAISEs on any `storage_used_bytes`
 *   change EXCEPT under the `auth.role()='service_role'` short-circuit (002:55); the
 *   AFTER-DELETE `sync_storage_usage` leg (003) decrements that column, so a sweep
 *   under the authenticated role would abort.
 * `service_role` BYPASSES RLS (the locate-SELECT succeeds) AND hits 002:55 (the usage
 * decrement syncs), so the quota counter stays correct and Storage is genuinely freed
 * (the D-09 "frees Storage" criterion). This is the sanctioned service-role escape
 * hatch; the own-folder guard below REPLACES RLS as the tenant boundary.
 *
 * THE OWN-FOLDER GUARD (mandatory, re-asserted — ACCT-05 / T-19-11). Because
 * service-role bypasses RLS, the cross-tenant boundary that own-folder RLS used to
 * provide MUST be re-asserted in app code: every collected path's first segment
 * (`path.split('/')[0]`) MUST equal `ownerSub`, or the path is SKIPPED (never removed).
 * `ownerSub` is ALWAYS the server-verified `claims.sub`, NEVER client-supplied — so
 * the service-role power can never be steered into a cross-tenant delete.
 *
 * MUST RUN BEFORE `admin.deleteUser(sub)` (D-11): once the auth user (and via the
 * FK cascade the profile row) is gone, the `storage_used_bytes` trigger row no longer
 * exists and the verified-sub provenance is harder to reason about. Sweep first,
 * delete the user second.
 *
 * PARTIAL-SWEEP TOLERANCE (Pitfall 3): a per-bucket list/remove error is LOGGED and
 * the sweep CONTINUES — a transient Storage error on one bucket must not throw and
 * crash the whole delete route (leaving the account half-deleted). An orphaned object
 * is visible in the log for the eventual operator sweep; it is never silently fatal.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This is a SERVER module — call it ONLY from the `/api/account/delete` route handler
 * (`runtime='nodejs'`), never a client component.
 */
import { supabaseAdmin } from '@/lib/supabase/service-role';

import type { UploadBucket } from './upload-config';

/**
 * The three user-writable buckets the sweep covers (migration 003 / upload-config.ts):
 * `avatars` (avatar/), `media` (project/testimonial/moodboard/), `resumes` (resume/).
 * Every object lives at `{sub}/{context}/{file}` — two levels deep.
 */
const SWEEP_BUCKETS: readonly UploadBucket[] = ['avatars', 'media', 'resumes'];

/** Storage `remove()` accepts at most 1000 paths per call — chunk defensively. */
const REMOVE_CHUNK = 1000;

/**
 * Sweep EVERY Storage object owned by `ownerSub` across all three buckets.
 *
 * Traversal (Pitfall 4 — `list()` is single-level, objects are two levels deep):
 *   1. `list(ownerSub)` → the context "folders" (`avatar`, `project`, …); a folder
 *      entry has no `id` (an `id`-bearing entry would be an object directly at the
 *      `{sub}/` root, which the upload path never creates — skipped defensively).
 *   2. for each folder, `list(`${ownerSub}/${folder.name}`)` → the object rows;
 *      collect each full path `${ownerSub}/${folder.name}/${obj.name}`.
 *   3. OWN-FOLDER GUARD (ACCT-05): skip any collected path whose first segment is not
 *      `ownerSub` before adding it (belt-and-suspenders — the discovery prefix is
 *      already `ownerSub`, but the guard re-asserts the tenant boundary explicitly).
 *   4. `.remove(...)` chunked to ≤1000; a per-chunk error is logged, NOT thrown.
 *
 * @param ownerSub The SERVER-VERIFIED subject (the owner) from `getVerifiedClaims()`.
 *                 NEVER client-supplied. It is both the discovery prefix AND the
 *                 own-folder-guard comparand.
 */
export async function sweepUserStorage(ownerSub: string): Promise<void> {
  for (const bucket of SWEEP_BUCKETS) {
    try {
      // (1) Discover the context folders under {sub}/ (one level).
      const { data: folders, error: listErr } = await supabaseAdmin.storage
        .from(bucket)
        .list(ownerSub);
      if (listErr) {
        console.error(`[sweepUserStorage] ${bucket}: list(${ownerSub}) failed: ${listErr.message}`);
        continue; // Pitfall 3 — a partial sweep must not crash the delete route.
      }

      const paths: string[] = [];
      for (const folder of folders ?? []) {
        // A folder prefix has no `id`; an `id`-bearing entry is a stray object at the
        // {sub}/ root (the upload path never creates one) — skip to the real folders.
        if (folder.id) continue;

        // (2) List the objects inside this context folder.
        const { data: objects, error: innerErr } = await supabaseAdmin.storage
          .from(bucket)
          .list(`${ownerSub}/${folder.name}`);
        if (innerErr) {
          console.error(
            `[sweepUserStorage] ${bucket}: list(${ownerSub}/${folder.name}) failed: ${innerErr.message}`,
          );
          continue; // skip this folder, keep sweeping the rest of the bucket.
        }

        for (const obj of objects ?? []) {
          const full = `${ownerSub}/${folder.name}/${obj.name}`;
          // (3) OWN-FOLDER GUARD (ACCT-05 / T-19-11): the first path segment MUST be
          // the owner's sub. A crafted cross-tenant prefix is SKIPPED, never removed.
          if (full.split('/')[0] !== ownerSub) continue;
          paths.push(full);
        }
      }

      // (4) Remove the collected paths, chunked to the 1000/call cap. A per-chunk
      // error is LOGGED and the sweep CONTINUES (Pitfall 3) — never thrown.
      for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
        const chunk = paths.slice(i, i + REMOVE_CHUNK);
        const { error: removeErr } = await supabaseAdmin.storage.from(bucket).remove(chunk);
        if (removeErr) {
          console.error(`[sweepUserStorage] ${bucket}: remove failed: ${removeErr.message}`);
        }
      }
    } catch (err) {
      // Defense-in-depth: any unexpected throw on one bucket must not abort the
      // whole sweep / delete route (Pitfall 3). Log and continue.
      console.error(
        `[sweepUserStorage] ${bucket}: unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
