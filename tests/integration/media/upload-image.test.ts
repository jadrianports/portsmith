/**
 * MEDIA-01 — authenticated WebP upload (Wave 0 RED).
 *
 * GREENED BY: Plan 02 (the image upload slice — the POST /api/media/upload route +
 * the generic image uploader). RED NOW because the route module does not yet exist:
 * the `import('@/app/api/media/upload/route')` below throws at module resolution,
 * failing the suite — the Phase-4 "RED via missing-module import" pattern (STATE
 * 04-01). This is a REAL gate, not a `.skip`/`.todo` pass.
 *
 * The RLS/Storage CONTRACT this proves once green (mirrors rls-write.test.ts +
 * _cms-fixtures.ts): an authenticated user uploading a WebP to their OWN
 * `{uid}/avatar/<id>.webp` folder SUCCEEDS (own-folder INSERT RLS, 003:58-63) and
 * `profiles.storage_used_bytes` increases (the sync_storage_usage AFTER trigger,
 * 003:110-141). The route itself can't run in the vitest `node` project (it reads
 * `next/headers` — Pitfall 7), so once green this asserts the contract via an
 * authenticated supabase-js Storage client + admin read-back.
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

/** Minimal valid WebP bytes (RIFF....WEBP) — enough for the magic-byte sniff. */
function webpBytes(): Uint8Array {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20, 0x00, 0x00, 0x00, 0x00,
  ]);
}

beforeAll(async () => {
  ctx = await setupTwoUsers('mediaup', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('MEDIA-01 — authenticated WebP upload increases storage_used_bytes', () => {
  it('RED until Plan 02: the upload route module exists', async () => {
    // RED gate: this import REJECTS until Plan 02 creates the route. The specifier
    // is held in a variable so tsc (moduleResolution: bundler) does not try to
    // resolve the not-yet-existent module at compile time — the failure is a
    // RUNTIME import rejection (a real gate), and `npx tsc --noEmit` stays 0.
    const ROUTE = '@/app/api/media/upload/route';
    const mod = (await import(/* @vite-ignore */ ROUTE)) as { POST?: unknown };
    expect(typeof mod.POST).toBe('function');
  });

  it('owner WebP upload to own folder succeeds and charges usage', async () => {
    const { data: before } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', ctx.userA.id)
      .single();
    const used0 = Number(before!.storage_used_bytes ?? 0);

    const path = `${ctx.userA.id}/avatar/${RUN}.webp`;
    const { error: upErr } = await ctx.clientA.storage
      .from('avatars')
      .upload(path, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(upErr).toBeNull();

    const { data: after } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', ctx.userA.id)
      .single();
    expect(Number(after!.storage_used_bytes ?? 0)).toBeGreaterThan(used0);
  });
});
