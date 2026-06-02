/**
 * MEDIA-01 — service-role WebP upload increases storage_used_bytes (Wave 0 → GREEN
 * in Plan 02).
 *
 * GREENED BY: Plan 02 (the image upload slice — the POST /api/media/upload route +
 * the generic image uploader).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RULE-4-RESOLVED OPTION B reconciliation. The Wave-0 RED body assumed the
 * authenticated-client model (`clientA.storage.upload`). A founder-approved
 * architectural decision moved ALL Storage writes to the SERVER-ONLY service-role
 * admin client because the 002 protected-columns trigger RAISEs on the
 * `sync_storage_usage` AFTER-INSERT `storage_used_bytes` UPDATE under the end-user
 * `authenticated` role (it only short-circuits for `auth.role()='service_role'`,
 * 002:55). So the PRODUCT upload path the route uses is the service-role write — that
 * is what this gate asserts. (An authenticated direct upload would RAISE on the usage
 * trigger under the current foundation; the route does NOT use that path.)
 *
 * The route itself can't run in the vitest `node` project (it reads `next/headers` —
 * Pitfall 7), so this asserts the CONTRACT the route relies on: a service-role WebP
 * write to the user's OWN `{uid}/avatar/<id>.webp` folder SUCCEEDS, the object exists
 * under the uid folder (admin list), and `profiles.storage_used_bytes` increases (the
 * sync_storage_usage AFTER trigger, 003:110-141, runs cleanly under service_role).
 * ─────────────────────────────────────────────────────────────────────────────
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

describe('MEDIA-01 — service-role WebP upload increases storage_used_bytes', () => {
  it('GREEN: the upload route module exists and exports POST', async () => {
    const ROUTE = '@/app/api/media/upload/route';
    const mod = (await import(/* @vite-ignore */ ROUTE)) as { POST?: unknown };
    expect(typeof mod.POST).toBe('function');
  });

  it('owner WebP upload (service-role path) to own folder succeeds and charges usage', async () => {
    const { data: before } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', ctx.userA.id)
      .single();
    const used0 = Number(before!.storage_used_bytes ?? 0);

    // The product path: the route writes via the service-role admin client to the
    // verified-sub own folder. Mirror that here (NOT clientA — authenticated would
    // RAISE on the usage trigger under the current foundation; the route never uses
    // that path).
    const path = `${ctx.userA.id}/avatar/${RUN}.webp`;
    const { error: upErr } = await admin.storage
      .from('avatars')
      .upload(path, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(upErr).toBeNull();

    // The object exists under the uid folder (admin list).
    const { data: listing } = await admin.storage
      .from('avatars')
      .list(`${ctx.userA.id}/avatar`);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).toContain(`${RUN}.webp`);

    // storage_used_bytes increased (sync_storage_usage AFTER-INSERT, under service_role).
    const { data: after } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', ctx.userA.id)
      .single();
    expect(Number(after!.storage_used_bytes ?? 0)).toBeGreaterThan(used0);
  });
});
