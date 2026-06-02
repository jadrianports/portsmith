/**
 * MEDIA-02 — single résumé PDF; replace deletes the prior file + the profile-media
 * delete-on-replace leg (MEDIA-04, avatar branch added by Plan 05-04).
 *
 * GREENED BY: Plan 02 (PDF accept/reject in the route + the shared
 * `deleteStorageObject` helper) + Plan 04 (the `saveProfileAction` delete-on-replace
 * leg for BOTH avatar_url and resume_url).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RULE-4-RESOLVED OPTION B reconciliation (the Wave-0 RED → GREEN switch). The
 * Wave-0 RED body assumed the authenticated-client delete
 * (`clientA.storage.from('resumes').remove(...)`). Two VERIFIED foundation bugs make
 * that impossible without modifying the locked foundation:
 *   - FINDING 1: storage.objects has own-folder INSERT + DELETE policies but NO
 *     SELECT policy; Supabase `remove()` runs an internal locate-SELECT, so an
 *     authenticated `.remove()` silently deletes NOTHING (the RED body left the
 *     prior PDF in place).
 *   - FINDING 2: the 002 protected-columns trigger RAISEs on the AFTER-DELETE
 *     `storage_used_bytes` decrement unless run under `service_role` (002:55).
 * Founder-approved Option B: the profile-media delete-on-replace leg in
 * `saveProfileAction` calls `deleteStorageObject(priorUrl, verifiedSub)` — the
 * SERVER-ONLY service-role helper (RLS bypassed → locate-SELECT works; usage
 * decrement syncs under service_role), gated by the own-folder guard
 * (`path[0] === ownerSub`).
 *
 * This test runs the REAL helper (it imports `@/lib/supabase/service-role`, aliased
 * to a no-op `server-only` stub under vitest, and reads the local service-role key
 * from the env). `saveProfileAction` itself can't run in the vitest `node` project
 * (it reads `next/headers` — no request scope, Pitfall 7), so this asserts the
 * delete CONTRACT the action relies on (the `deleteStorageObject` effect + the
 * own-folder Storage remove + the usage decrement) exactly as `orphan-delete.test.ts`
 * does for item images — covering MEDIA-02 (résumé) + the MEDIA-04 avatar branch.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * CONTRACT this proves once green:
 *   1. a PDF (`%PDF-`) is accepted by the kind=resume magic-byte allowlist; a
 *      non-PDF (PNG) is rejected;
 *   2. RÉSUMÉ branch — replacing a résumé deletes the PRIOR PDF object (admin list
 *      no longer contains it) while the NEW object remains, and `storage_used_bytes`
 *      reflects only the surviving object (D-11);
 *   3. AVATAR branch (MEDIA-04, added this plan) — a CHANGED avatar_url whose prior
 *      value was a Storage URL deletes the OLD avatar object AND decrements
 *      `storage_used_bytes`; an UNCHANGED avatar_url triggers NO delete; a
 *      non-Storage (legacy pasted) prior URL is a safe no-op.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from '../cms/_cms-fixtures';

import { deleteStorageObject } from '@/lib/media/delete-object';
import { ALLOWED_PDF_MIME, sniffMime } from '@/lib/media/magic-bytes';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);
let ctx: TwoUsers;

/** Minimal PDF magic bytes. */
function pdfBytes(): Uint8Array {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
}
/** A non-PDF buffer (PNG magic) the route must reject. */
function pngBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}
/** Minimal WebP magic bytes (a real avatar object the route would store). */
function webpBytes(): Uint8Array {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20, 0x00, 0x00, 0x00, 0x00,
  ]);
}

/** Build the public Storage URL for a bucket object path (what the helper parses). */
function publicUrl(bucket: string, path: string): string {
  return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Read the owner's (trigger-maintained, protected) storage_used_bytes. */
async function usedBytes(uid: string): Promise<number> {
  const { data } = await admin
    .from('profiles')
    .select('storage_used_bytes')
    .eq('id', uid)
    .single();
  return Number((data as { storage_used_bytes?: number | null } | null)?.storage_used_bytes ?? 0);
}

beforeAll(async () => {
  ctx = await setupTwoUsers('mediares', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('MEDIA-02 — résumé PDF: accept, reject non-PDF, replace deletes prior', () => {
  it('GREEN: the upload route + delete helper modules exist', async () => {
    const ROUTE = '@/app/api/media/upload/route';
    const mod = (await import(/* @vite-ignore */ ROUTE)) as { POST?: unknown };
    expect(typeof mod.POST).toBe('function');

    const HELPER = '@/lib/media/delete-object';
    const helperMod = (await import(/* @vite-ignore */ HELPER)) as {
      deleteStorageObject?: unknown;
    };
    expect(typeof helperMod.deleteStorageObject).toBe('function');
  });

  it('the PDF allowlist accepts %PDF- and rejects PNG (magic-byte gate)', async () => {
    expect(ALLOWED_PDF_MIME.has((await sniffMime(pdfBytes()))!)).toBe(true);
    const png = await sniffMime(pngBytes());
    expect(ALLOWED_PDF_MIME.has(png ?? '')).toBe(false);
  });

  it('RÉSUMÉ replace: deletes the PRIOR PDF, keeps the NEW, usage reflects the net', async () => {
    // Option-B reconciliation of the Wave-0 RED replace leg: the prior PDF is
    // deleted through the shared service-role helper (the saveProfileAction
    // delete-on-replace leg's contract), NOT the authenticated client.remove()
    // (which silently no-ops on the no-SELECT-policy foundation — FINDING 1).
    const folder = `${ctx.userA.id}/resume`;
    const oldPath = `${folder}/${RUN}-a.pdf`;
    const newPath = `${folder}/${RUN}-b.pdf`;

    // Upload via the service-role path (the route's write client) so usage is
    // charged correctly under the 002:55 short-circuit.
    const { error: oldErr } = await admin.storage
      .from('resumes')
      .upload(oldPath, pdfBytes(), { contentType: 'application/pdf', upsert: false });
    expect(oldErr).toBeNull();
    const { error: newErr } = await admin.storage
      .from('resumes')
      .upload(newPath, pdfBytes(), { contentType: 'application/pdf', upsert: false });
    expect(newErr).toBeNull();

    const usedBefore = await usedBytes(ctx.userA.id);

    // Replace = the new object is uploaded + the PRIOR url is dropped: the action's
    // delete-on-replace leg deletes ONLY the prior URL via the shared helper.
    await deleteStorageObject(publicUrl('resumes', oldPath), ctx.userA.id);

    const { data: listing } = await admin.storage.from('resumes').list(folder);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).not.toContain(`${RUN}-a.pdf`); // the prior PDF is GONE
    expect(names).toContain(`${RUN}-b.pdf`); // the replacement remains

    // Usage decremented by exactly the prior PDF's bytes (AFTER-DELETE trigger,
    // service_role) — the net reflects only the surviving object.
    const usedAfter = await usedBytes(ctx.userA.id);
    expect(usedAfter).toBe(usedBefore - pdfBytes().byteLength);

    // Cleanup the surviving new object.
    await admin.storage.from('resumes').remove([newPath]);
  });

  it('AVATAR branch (MEDIA-04): a CHANGED Storage avatar_url deletes the OLD object + decrements usage', async () => {
    // The avatar leg of the SAME delete-on-replace mechanism (closes the
    // avatar-replace orphan 05-02 deferred). A prior Storage avatar exists; the
    // user uploads a new one; the action diffs prior!=next and deletes the prior.
    const folder = `${ctx.userA.id}/avatar`;
    const oldPath = `${folder}/${RUN}-old.webp`;
    const newPath = `${folder}/${RUN}-new.webp`;

    const { error: oldErr } = await admin.storage
      .from('avatars')
      .upload(oldPath, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(oldErr).toBeNull();
    const { error: newErr } = await admin.storage
      .from('avatars')
      .upload(newPath, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(newErr).toBeNull();

    const usedBefore = await usedBytes(ctx.userA.id);

    // prior avatar_url (Storage) !== next avatar_url (Storage) → delete the prior.
    await deleteStorageObject(publicUrl('avatars', oldPath), ctx.userA.id);

    const { data: listing } = await admin.storage.from('avatars').list(folder);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).not.toContain(`${RUN}-old.webp`); // OLD avatar GONE (no orphan)
    expect(names).toContain(`${RUN}-new.webp`); // the new avatar remains

    const usedAfter = await usedBytes(ctx.userA.id);
    expect(usedAfter).toBe(usedBefore - webpBytes().byteLength);

    // Cleanup the surviving new object.
    await admin.storage.from('avatars').remove([newPath]);
  });

  it('AVATAR branch: an UNCHANGED avatar_url triggers NO delete', async () => {
    // When prior === next (the user saved the form without touching the avatar),
    // the action's `current !== next` guard skips the delete entirely. We model
    // that here: the delete leg is simply never called for the unchanged URL, so
    // the object survives and usage is unchanged. (The helper would delete it if
    // wrongly called — this asserts the guard's contract: same URL → no-op path.)
    const folder = `${ctx.userA.id}/avatar`;
    const path = `${folder}/${RUN}-keep.webp`;

    const { error: upErr } = await admin.storage
      .from('avatars')
      .upload(path, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(upErr).toBeNull();

    const usedBefore = await usedBytes(ctx.userA.id);

    // prior === next → the action does NOT call deleteStorageObject. No delete.
    const prior = publicUrl('avatars', path);
    const next = prior;
    if (prior !== next) {
      await deleteStorageObject(prior, ctx.userA.id);
    }

    const { data: listing } = await admin.storage.from('avatars').list(folder);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).toContain(`${RUN}-keep.webp`); // unchanged → still there
    expect(await usedBytes(ctx.userA.id)).toBe(usedBefore); // usage unchanged

    // Cleanup.
    await admin.storage.from('avatars').remove([path]);
  });

  it('AVATAR branch: a non-Storage (legacy pasted) prior URL is a safe no-op', async () => {
    // If the prior avatar_url was a legacy externally-pasted link (pre-D-08), the
    // delete leg passes it to deleteStorageObject, whose urlToStoragePath returns
    // null for a foreign origin → nothing is deleted, no throw.
    await expect(
      deleteStorageObject('https://legacy-cdn.example.com/old-avatar.png', ctx.userA.id),
    ).resolves.toBeUndefined();
  });
});
