/**
 * D-11 / UX-03 — free the replace/remove-BEFORE-save Storage orphan.
 *
 * Phase 17 closes the function-quota leak a real first user hits: uploading a new
 * object that supersedes a prior UNSAVED object (replace), or removing an unsaved
 * object, must free the superseded object so no orphan survives and
 * `storage_used_bytes` stays accurate on the $0 tier.
 *
 * WHAT THIS TEST DRIVES — and why it is the PRIMITIVE, not the cookie action
 * (RESEARCH Pitfall 6): the product wiring is `freeUnsavedUpload(url)`
 * (free-unsaved-upload-action.ts), a `'use server'` action whose SHARED-A head
 * calls `getVerifiedClaims()` → reads `next/headers` cookies. The `node`
 * integration project cannot supply those cookies, so the action would no-op /
 * throw. Per the established repo pattern (orphan-delete.test.ts), this test drives
 * the UNDERLYING primitive `deleteStorageObject(url, ownerSub)` with the EXPLICIT
 * fixture `sub` — exactly what the action delegates to once identity is verified.
 * The action's only added surface (the verified-`sub` gate + the
 * `!== persistedValue` caller gate) is covered by the source assertions + the
 * Playwright e2e (Plan 04/08); the DB-truth proof lives here.
 *
 * WHY `deleteStorageObject` (not an authenticated `.remove()`): the repo's locked
 * foundation has no SELECT policy on `storage.objects` (an authenticated `.remove()`
 * silently deletes nothing) and a protected-columns trigger that RAISEs on the
 * `storage_used_bytes` decrement unless run as `service_role`. The primitive is the
 * sanctioned Option-B path — service-role (bypasses RLS for the locate-SELECT, hits
 * the 002:55 short-circuit so the AFTER-DELETE `sync_storage_usage` trigger
 * decrements correctly) + an own-folder guard that REPLACES RLS as the boundary.
 *
 * This test proves three behaviors against the REAL local Supabase stack:
 *   1. upload → free → the object is GONE (admin list) AND `storage_used_bytes`
 *      decrements back (the AFTER-DELETE trigger fired);
 *   2. REPLACE — freeing only the superseded URL leaves the NEW object intact;
 *   3. cross-tenant — a user-B URL freed with user-A's sub is a NO-OP (own-folder
 *      guard): B's object survives and B's `storage_used_bytes` is unchanged.
 *
 * LOCAL STACK ONLY — `*@example.test` is a reserved test domain; the helper imports
 * `@/lib/supabase/service-role` (aliased to a no-op `server-only` stub under vitest)
 * and reads the local service-role key from the env.
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

/** A minimal valid WebP byte container (same fixture as orphan-delete.test.ts). */
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

/** Read the trigger-maintained `storage_used_bytes` for a user (service-role read). */
async function usageBytes(userId: string): Promise<number> {
  const { data, error } = await admin
    .from('profiles')
    .select('storage_used_bytes')
    .eq('id', userId)
    .single();
  expect(error).toBeNull();
  return Number(data!.storage_used_bytes ?? 0);
}

beforeAll(async () => {
  ctx = await setupTwoUsers('freeunsaved', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('D-11 — freeing an unsaved Storage object (replace/remove before save)', () => {
  it('upload → deleteStorageObject(url, ownerSub) leaves no object and decrements storage_used_bytes', async () => {
    // D-11: model a freshly-uploaded-but-UNSAVED object (the route's service-role
    // write client uploads it), then the free path reclaims it before any save.
    const folder = `${ctx.userA.id}/project`;
    const path = `${folder}/${RUN}-unsaved.webp`;

    const before = await usageBytes(ctx.userA.id);

    const { error: upErr } = await admin.storage
      .from('media')
      .upload(path, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(upErr).toBeNull();

    // The INSERT trigger incremented usage above the pre-upload baseline.
    const afterUpload = await usageBytes(ctx.userA.id);
    expect(afterUpload).toBeGreaterThan(before);

    // Free it via the REAL primitive the action delegates to, with the verified sub.
    await deleteStorageObject(publicMediaUrl(path), ctx.userA.id);

    // The object is gone (admin read-back).
    const { data: listing } = await admin.storage.from('media').list(folder);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).not.toContain(`${RUN}-unsaved.webp`);

    // storage_used_bytes is back to the pre-upload baseline (AFTER-DELETE trigger
    // under service_role decremented it — the action never writes the column).
    expect(await usageBytes(ctx.userA.id)).toBe(before);
  });

  it('REPLACE: freeing only the superseded URL leaves the NEW object intact', async () => {
    // D-11: a replace-before-save uploads a NEW object then frees the superseded
    // (old) one. Only the old URL is passed to the free path; the new URL — still
    // the bound value — is NOT, so the replacement survives.
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

    // Free ONLY the superseded (old) URL — never the surviving replacement.
    await deleteStorageObject(publicMediaUrl(oldPath), ctx.userA.id);

    const { data: listing } = await admin.storage.from('media').list(folder);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).not.toContain(`${RUN}-old.webp`); // superseded → freed
    expect(names).toContain(`${RUN}-new.webp`); // replacement → intact

    // Cleanup the surviving new object.
    await admin.storage.from('media').remove([newPath]);
  });

  it('CROSS-TENANT: freeing user B’s object with user A’s sub is a NO-OP (own-folder guard)', async () => {
    // D-11 safety: the own-folder guard makes a foreign/cross-tenant URL a safe
    // no-op even though the primitive runs as service-role. A crafted user-B URL
    // freed with user-A's verified sub must NOT delete B's object or move B's quota.
    const bFolder = `${ctx.userB.id}/project`;
    const bPath = `${bFolder}/${RUN}-b.webp`;

    const { error: upErr } = await admin.storage
      .from('media')
      .upload(bPath, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(upErr).toBeNull();

    const bUsageBefore = await usageBytes(ctx.userB.id);

    // User A's sub against B's object → own-folder guard rejects (no delete).
    await deleteStorageObject(publicMediaUrl(bPath), ctx.userA.id);

    // B's object is STILL THERE — the service-role power was not steered cross-tenant.
    const { data: listing } = await admin.storage.from('media').list(bFolder);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).toContain(`${RUN}-b.webp`);

    // B's quota is UNCHANGED (no AFTER-DELETE decrement fired for B).
    expect(await usageBytes(ctx.userB.id)).toBe(bUsageBefore);

    // Cleanup B's object via admin (the guard intentionally left it undeleted).
    await admin.storage.from('media').remove([bPath]);
  });
});
