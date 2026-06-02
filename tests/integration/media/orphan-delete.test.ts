/**
 * MEDIA-04 — orphan-free deletion on remove/replace (Wave 0 RED).
 *
 * GREENED BY: Plan 03/04 (the delete-on-replace hook + the deleteStorageObject
 * helper wired into the removing mutation). RED NOW via the missing-module import
 * of the delete helper (STATE 04-01 pattern) — a REAL gate, not a `.skip`/`.todo`
 * pass.
 *
 * CONTRACT this proves once green (mirrors rls-write.test.ts own-folder
 * write/delete + admin read-back): upload an object → `storage.from(b).remove([path])`
 * (own-folder DELETE RLS, 003:66-68) → `adminClient().storage.from(b).list(...)`
 * shows the object GONE AND `storage_used_bytes` back down (the AFTER-DELETE trigger
 * leg, 003:126-133, decrements with GREATEST(0, ...)).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from '../cms/_cms-fixtures';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);
let ctx: TwoUsers;

function webpBytes(): Uint8Array {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20, 0x00, 0x00, 0x00, 0x00,
  ]);
}

beforeAll(async () => {
  ctx = await setupTwoUsers('mediaorph', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('MEDIA-04 — removing an image deletes its Storage object (no orphan)', () => {
  it('RED until Plan 03/04: the deleteStorageObject helper exists', async () => {
    // RED via a RUNTIME import rejection (specifier in a variable so tsc stays 0).
    // This module is created by the orphan-delete slice (Plan 03/04).
    const HELPER = '@/lib/media/delete-object';
    const mod = (await import(/* @vite-ignore */ HELPER)) as {
      deleteStorageObject?: unknown;
    };
    expect(typeof mod.deleteStorageObject).toBe('function');
  });

  it('upload → remove leaves no object and restores usage', async () => {
    const folder = `${ctx.userA.id}/project`;
    const path = `${folder}/${RUN}.webp`;
    const { error: upErr } = await ctx.clientA.storage
      .from('media')
      .upload(path, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(upErr).toBeNull();

    const { error: delErr } = await ctx.clientA.storage.from('media').remove([path]);
    expect(delErr).toBeNull();

    const { data: listing } = await admin.storage.from('media').list(folder);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).not.toContain(`${RUN}.webp`);

    const { data: prof } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', ctx.userA.id)
      .single();
    expect(Number(prof!.storage_used_bytes ?? 0)).toBe(0);
  });
});
