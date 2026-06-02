/**
 * MEDIA-04 — orphan-free deletion on remove/replace (Wave 0 → GREEN in Plan 02).
 *
 * GREENED BY: Plan 02 (the shared `deleteStorageObject` helper, built in the spine
 * here because BOTH Wave-3 slices — 05-03 item-image remove/replace, 05-04
 * résumé/avatar delete-on-replace — consume it).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RULE-4-RESOLVED OPTION B reconciliation + boundary proof. The Wave-0 RED body
 * assumed the authenticated-client delete (`clientA.storage.remove`). Two VERIFIED
 * foundation bugs made that impossible without modifying the locked foundation:
 *   - FINDING 1: storage.objects has own-folder INSERT + DELETE policies but NO SELECT
 *     policy; Supabase `remove()` runs an internal SELECT to locate the row, so an
 *     authenticated `.remove()` silently deletes NOTHING (this very test's RED body
 *     left the object in place under `clientA.storage.remove`).
 *   - FINDING 2: the 002 protected-columns trigger RAISEs on the AFTER-DELETE
 *     `storage_used_bytes` decrement unless run under `service_role` (002:55).
 * Founder-approved Option B: `deleteStorageObject(url, ownerSub)` deletes via the
 * SERVER-ONLY service-role admin client (RLS bypassed → locate-SELECT works; usage
 * decrement runs under service_role → syncs), gated by an EXPLICIT own-folder guard
 * (`path[0] === ownerSub`) that REPLACES own-folder DELETE RLS as the boundary.
 *
 * This test runs the REAL helper (it imports `@/lib/supabase/service-role`, aliased to
 * a no-op `server-only` stub under vitest — vitest.config.ts — and reads the local
 * service-role key from the env). It proves: service-role upload → deleteStorageObject
 * → the object is GONE (admin list) AND `storage_used_bytes` is back to 0; PLUS the
 * cross-tenant boundary holds — deleting user B's object as user A is REJECTED (the
 * own-folder guard), leaving B's object intact.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from '../cms/_cms-fixtures';

import { deleteStorageObject } from '@/lib/media/delete-object';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);
let ctx: TwoUsers;

function webpBytes(): Uint8Array {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20, 0x00, 0x00, 0x00, 0x00,
  ]);
}

/** Build the public Storage URL for a media-bucket object path (what the helper parses). */
function publicMediaUrl(path: string): string {
  return admin.storage.from('media').getPublicUrl(path).data.publicUrl;
}

beforeAll(async () => {
  ctx = await setupTwoUsers('mediaorph', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('MEDIA-04 — removing an image deletes its Storage object (no orphan)', () => {
  it('GREEN: the deleteStorageObject helper exists', async () => {
    const HELPER = '@/lib/media/delete-object';
    const mod = (await import(/* @vite-ignore */ HELPER)) as {
      deleteStorageObject?: unknown;
    };
    expect(typeof mod.deleteStorageObject).toBe('function');
  });

  it('upload → deleteStorageObject(url, ownerSub) leaves no object and restores usage', async () => {
    const folder = `${ctx.userA.id}/project`;
    const path = `${folder}/${RUN}.webp`;

    // Product path: service-role upload (the route's write client).
    const { error: upErr } = await admin.storage
      .from('media')
      .upload(path, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(upErr).toBeNull();

    // Run the REAL shared helper with the server-verified owner sub.
    await deleteStorageObject(publicMediaUrl(path), ctx.userA.id);

    // The object is gone (admin read-back).
    const { data: listing } = await admin.storage.from('media').list(folder);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).not.toContain(`${RUN}.webp`);

    // storage_used_bytes is back down (AFTER-DELETE trigger under service_role).
    const { data: prof } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', ctx.userA.id)
      .single();
    expect(Number(prof!.storage_used_bytes ?? 0)).toBe(0);
  });

  it('REPLACE: deleting the OLD item-image object leaves the NEW object intact (no orphan)', async () => {
    // Simulate an item-image REPLACE: an old object exists, a new object is
    // uploaded, then the section save's diff-and-delete leg deletes ONLY the old
    // URL (the prior `item.image`). This is the contract 05-03's `deleteUrls` leg
    // drives: prior-array URLs absent from the next array are passed to
    // deleteStorageObject; the new URL (still present) is NOT.
    const folder = `${ctx.userA.id}/project`;
    const oldPath = `${folder}/${RUN}-old.webp`;
    const newPath = `${folder}/${RUN}-new.webp`;

    const { error: oldErr } = await admin.storage
      .from('media')
      .upload(oldPath, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(oldErr).toBeNull();
    const { error: newErr } = await admin.storage
      .from('media')
      .upload(newPath, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(newErr).toBeNull();

    // Delete ONLY the old URL (the diff leg never includes the surviving new URL).
    await deleteStorageObject(publicMediaUrl(oldPath), ctx.userA.id);

    const { data: listing } = await admin.storage.from('media').list(folder);
    const names = (listing ?? []).map((o) => o.name);
    // The OLD object is gone; the NEW object remains (the replacement is intact).
    expect(names).not.toContain(`${RUN}-old.webp`);
    expect(names).toContain(`${RUN}-new.webp`);

    // Cleanup the surviving new object.
    await admin.storage.from('media').remove([newPath]);
  });

  it('a foreign / unparseable URL is a safe no-op (nothing to delete)', async () => {
    // urlToStoragePath returns null for a non-Storage origin → the helper returns
    // cleanly without a remove call.
    await expect(
      deleteStorageObject('https://evil.example.com/whatever.webp', ctx.userA.id),
    ).resolves.toBeUndefined();
  });

  it('OPTION B BOUNDARY: deleting another tenant’s object is REJECTED (own-folder guard)', async () => {
    // User B uploads an object in B's own folder (service-role path).
    const bFolder = `${ctx.userB.id}/project`;
    const bPath = `${bFolder}/${RUN}-b.webp`;
    const { error: upErr } = await admin.storage
      .from('media')
      .upload(bPath, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(upErr).toBeNull();

    // User A attempts to delete B's object via the helper, passing A's verified sub.
    // The own-folder guard (path[0] === ownerSub) REJECTS — no delete happens.
    await deleteStorageObject(publicMediaUrl(bPath), ctx.userA.id);

    // B's object is STILL THERE — the service-role power was NOT steered cross-tenant.
    const { data: listing } = await admin.storage.from('media').list(bFolder);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).toContain(`${RUN}-b.webp`);

    // Cleanup B's object via admin (it was intentionally left undeleted by the guard).
    await admin.storage.from('media').remove([bPath]);
  });
});
