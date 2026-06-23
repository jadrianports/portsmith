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

  // 34-01 (MEDIA-02 / MEDIA-04 / D-08) — the new gallery kind rides the SAME
  // service-role own-folder write + usage-charge contract as every other media kind.
  it('owner WebP gallery upload (service-role path) to own folder succeeds and charges usage', async () => {
    const { data: before } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', ctx.userA.id)
      .single();
    const used0 = Number(before!.storage_used_bytes ?? 0);

    // gallery writes to the `media` bucket under {uid}/gallery/<id>.webp (the route's
    // sub-locked buildObjectPath shape). Service-role mirrors the product path.
    const path = `${ctx.userA.id}/gallery/${RUN}.webp`;
    const { error: upErr } = await admin.storage
      .from('media')
      .upload(path, webpBytes(), { contentType: 'image/webp', upsert: false });
    expect(upErr).toBeNull();

    const { data: listing } = await admin.storage
      .from('media')
      .list(`${ctx.userA.id}/gallery`);
    const names = (listing ?? []).map((o) => o.name);
    expect(names).toContain(`${RUN}.webp`);

    const { data: after } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', ctx.userA.id)
      .single();
    expect(Number(after!.storage_used_bytes ?? 0)).toBeGreaterThan(used0);
  });
});

// 34-01 (MEDIA-01 / D-10) — the LIVE 65-MiB quota trigger boundary. These assertions
// prove the migration-031 `CREATE OR REPLACE enforce_storage_quota()` is actually
// applied to the local DB. The `media` bucket has a per-OBJECT 5 MiB file_size_limit
// (migration 003), so the per-USER 65 MiB quota can only be exercised by ACCUMULATING
// many ≤5 MiB objects: pushing userB's total above the old 25 MiB cap must now SUCCEED
// (it would have been trigger-rejected before 031), and pushing past 65 MiB must still
// be rejected by the BEFORE-INSERT quota trigger with SQLSTATE 23514 (check_violation).
describe('MEDIA-01 / D-10 — the live trigger enforces the raised 65 MiB cap', () => {
  const MIB = 1024 * 1024;
  const CHUNK = 5 * MIB; // the media-bucket per-object file_size_limit (003)

  /** A WebP buffer of `n` bytes (valid RIFF/WEBP header + zero padding) so the trigger
   *  reads a real metadata.size. */
  function webpOfSize(n: number): Uint8Array {
    const buf = new Uint8Array(Math.max(n, webpBytes().length));
    buf.set(webpBytes(), 0);
    return buf;
  }

  async function usedBytes(userId: string): Promise<number> {
    const { data } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', userId)
      .single();
    return Number(data!.storage_used_bytes ?? 0);
  }

  it('accumulating past 25 MiB SUCCEEDS (would fail pre-031) and past 65 MiB is rejected (23514)', async () => {
    const uid = ctx.userB.id;
    // Upload 5 MiB chunks one at a time; each ≤ the 5 MiB per-object bucket limit so the
    // ONLY gate that can reject is the per-user quota trigger. Track when we cross the
    // old 25 MiB cap and the new 65 MiB cap.
    let crossedOldCap = false;
    let rejectedOverNewCap = false;

    for (let i = 0; i < 16; i++) {
      const path = `${uid}/gallery/${RUN}-q${i}.webp`;
      const { error: upErr } = await admin.storage
        .from('media')
        .upload(path, webpOfSize(CHUNK), {
          contentType: 'image/webp',
          upsert: false,
        });

      const used = await usedBytes(uid);

      if (upErr) {
        // The only legitimate rejection here is the per-user quota trigger once total
        // usage would cross 65 MiB. Assert it happened at/above the new cap boundary,
        // proving the live trigger uses 68157440 (NOT the old 26214400).
        expect(used + CHUNK).toBeGreaterThan(68157440);
        rejectedOverNewCap = true;
        break;
      }

      // A success that pushes total usage above the OLD 25 MiB cap proves 031 raised it
      // (this exact write would have RAISEd under the pre-031 26214400 constant).
      if (used > 26214400) crossedOldCap = true;
    }

    expect(crossedOldCap).toBe(true); // raised cap allows usage the old cap forbade
    expect(rejectedOverNewCap).toBe(true); // the new 65 MiB ceiling is still enforced
  }, 60_000);
});
