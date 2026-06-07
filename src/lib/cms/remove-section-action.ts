'use server';

/**
 * removeSectionAction — hard-delete a section row + free its Storage media (D-03 /
 * D-05). The rail-row "Remove section" action: it hard-deletes any section row
 * (uniform across ALL types incl. the original 7 — no bootstrap distinction) and
 * frees the section's Storage objects so quota stays accurate. It mirrors the
 * canonical SHARED-A skeleton with the same invariant gate sequence (a failure at
 * step N never reaches step N+1):
 *
 *   1. getVerifiedClaims() — verified JWT identity (AUTH-05). NEVER the unverified
 *      cookie-session getter. A null claim ⇒ { ok:false }. WR-05: a verified claim
 *      MUST carry a `sub` — hard-fail on a missing one (never `?? ''`).
 *   2. READ the row's `type` + `content` BEFORE the DELETE (mirror
 *      save-section-action.ts:155-160) under the AUTHENTICATED client. RLS +
 *      `.eq('id', sectionId)` confine this to the owner's own row — the
 *      SERVER-TRUSTED prior state the media-free diff needs (the client never
 *      supplies it). A missing / cross-tenant row reads null → a clean no-op.
 *   3. DELETE the row under the AUTHENTICATED client:
 *      `.from('sections').delete().eq('id', sectionId)`. The `sections own all`
 *      USING clause scopes it to the owner; a cross-tenant target changes 0 rows
 *      (T-13.1-02-XT-DEL — NEVER the service-role client for the row op; that would
 *      be block-worthy). The section→section_history cascade fires automatically.
 *   4. D-05 media free: `serverDroppedItemImageUrls(type, priorContent, {})` diffs
 *      the prior content against EMPTY next-content so EVERY referenced image drops
 *      (section-level avatar/background_image + gallery items[].image — the 13.1-02
 *      IMAGE_FIELDS extension). Each URL is freed via `deleteStorageObject(url, sub)`
 *      — the ONLY service-role use here (the sanctioned Option-B escape hatch). `sub`
 *      is ALWAYS the server-verified subject, never client-supplied; the own-folder
 *      guard (`path[0]===ownerSub`) is the cross-tenant storage-delete boundary. The
 *      `sync_storage_usage` AFTER-DELETE trigger decrements storage_used_bytes under
 *      service_role automatically when the object is removed.
 *   5. revalidatePath('/' + username) — LITERAL path, NO second arg (CLAUDE.md
 *      Pitfall 1) so a removed section disappears from the live page within seconds.
 *   6. Return { ok:true }.
 *
 * Result shape is the discriminated union { ok:true } | { ok:false; error? } —
 * never throws to the caller; messages stay generic (no internal-detail leak).
 *
 * Source: action shape from src/lib/cms/toggle-visibility-action.ts (the single-row
 * sections mutation under RLS — .update swapped for .delete) + save-section-action.ts
 * (the read-prior-then-media-free leg); the diff from src/lib/cms/section-media-diff
 * (serverDroppedItemImageUrls); the service-role media leg from
 * src/lib/media/delete-object (deleteStorageObject — own-folder guard);
 * revalidatePath signature [VERIFIED: Next 16.2.6].
 */
import { revalidatePath } from 'next/cache';

import { serverDroppedItemImageUrls } from '@/lib/cms/section-media-diff';
import { deleteStorageObject } from '@/lib/media/delete-object';
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

/** The remove outcome — the same discriminated union the other CMS writes return. */
export type RemoveSectionResult = { ok: true } | { ok: false; error?: string };

const NOT_SIGNED_IN = 'Not signed in.';
const REMOVE_FAILED =
  'Something went wrong removing the section. Please try again.';

/**
 * Hard-delete a section the caller owns + free its Storage media.
 *
 * @param sectionId The section row to delete (RLS + .eq scope it to the owner; a
 *   cross-tenant target changes 0 rows and frees no media).
 * @param username The owner's username, passed from the dashboard so the revalidate
 *   needs no extra round-trip. When omitted the action reads it from the verified
 *   profile row — NEVER from the request host (PUB-03).
 */
export async function removeSectionAction(
  sectionId: string,
  username?: string,
): Promise<RemoveSectionResult> {
  // 1) Verified identity (AUTH-05 — never getSession). Drives the revalidate path
  //    AND the own-folder guard `sub` for the media-free leg.
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // WR-05: a verified claim MUST carry a subject. Treat a missing `sub` as a hard
  // auth failure — never coerce it to '' (which would make the own-folder guard a
  // no-op and the username fallback a guaranteed 0-row read).
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 2) READ the row's type + content BEFORE the DELETE (the SERVER-TRUSTED prior
  //    state the media-free diff needs). RLS + .eq('id', …) confine this to the
  //    owner; a missing / cross-tenant row reads null → no media is freed (the
  //    DELETE below is also a clean 0-row no-op).
  const supabase = await createClient();
  const { data: priorRow } = await supabase
    .from('sections')
    .select('type, content')
    .eq('id', sectionId)
    .maybeSingle();
  const priorType = (priorRow as { type?: string } | null)?.type ?? null;
  const priorContent = (priorRow as { content?: unknown } | null)?.content ?? null;

  // 3) DELETE the row under RLS. The `sections own all` USING clause + .eq('id', …)
  //    scope it to the owner; a cross-tenant / missing target changes 0 rows
  //    (T-13.1-02-XT-DEL). NEVER the service-role client for the row op. WR-03:
  //    request the affected rows (`.select('id')`) so a 0-row delete is NOT reported
  //    as a successful remove — an empty result is a generic failure (enumeration-
  //    safe: the message never reveals whether the row was missing vs. owned by
  //    another tenant; the RLS boundary held either way). The media-free leg + the
  //    revalidate below are UNREACHABLE on a 0-row delete, so no spurious Storage
  //    deletes fire and the optimistic shell is never told a phantom remove succeeded.
  const { data: deletedRows, error } = await supabase
    .from('sections')
    .delete()
    .eq('id', sectionId)
    .select('id');
  if (error) return { ok: false, error: REMOVE_FAILED };
  if (!deletedRows || deletedRows.length === 0) {
    return { ok: false, error: REMOVE_FAILED };
  }

  // 4) D-05 media free — runs ONLY AFTER the DELETE succeeds (1+ rows). Diff the prior content
  //    against EMPTY next-content so EVERY referenced image drops (section-level +
  //    gallery, via the 13.1-02 IMAGE_FIELDS extension). `deleteStorageObject` is the
  //    ONLY service-role use here; `sub` is the server-verified subject (never client-
  //    supplied) and the own-folder guard rejects any cross-tenant path. The AFTER-
  //    DELETE trigger decrements storage_used_bytes. A no-row read above ⇒ no drops.
  if (priorType) {
    const dropped = serverDroppedItemImageUrls(priorType, priorContent, {});
    for (const url of dropped) {
      await deleteStorageObject(url, sub);
    }
  }

  // 5) Resolve the owner username (prefer the dashboard-passed value; else read the
  //    verified profile row — NEVER the request host, PUB-03) and revalidate the
  //    public page so the removed section disappears live within seconds.
  let resolvedUsername = username;
  if (!resolvedUsername) {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', sub) // WR-05: `sub` guaranteed present (no `?? ''`).
      .single();
    resolvedUsername = (data as { username?: string } | null)?.username ?? undefined;
  }
  if (resolvedUsername) {
    // LITERAL path, NO second arg (RESEARCH Pitfall 1 / CLAUDE.md correction).
    revalidatePath('/' + resolvedUsername);
  }

  // 6) Success.
  return { ok: true };
}
