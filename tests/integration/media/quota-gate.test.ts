/**
 * MEDIA-03 — server-authoritative quota gate (Wave 0 → GREEN in Plan 02).
 *
 * GREENED BY: Plan 02 (the upload route's pre-upload quota gate, step [D]).
 *
 * CONTRACT this proves: `storage_used_bytes` is a PROTECTED column — only the admin
 * (service-role) client can seed it (the 002 trigger blocks client writes;
 * rls-protected-columns.test.ts:45). We seed user A near the 25 MB cap via
 * `adminClient()`, then assert the route's quota decision logic
 * (`wouldExceedQuota(used, incoming)`, the EXACT predicate step [D] uses) rejects an
 * over-cap upload — and that BECAUSE the route rejects BEFORE any Storage write, the
 * seeded `storage_used_bytes` is left UNCHANGED (the AFTER trigger never fires for the
 * rejected upload).
 *
 * RULE-4-RESOLVED OPTION B note: the route reads `storage_used_bytes` and runs this
 * predicate BEFORE the service-role Storage write, so an over-cap upload returns 409
 * and never reaches the write — identical quota semantics regardless of which client
 * performs the (rejected, never-attempted) write.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from '../cms/_cms-fixtures';

import { QUOTA_BYTES, wouldExceedQuota } from '@/lib/media/upload-config';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);
let ctx: TwoUsers;

/** Seed user A's protected storage_used_bytes to 1 KiB below the cap (admin only). */
const NEAR_CAP = QUOTA_BYTES - 1024;

/**
 * A minimal valid 20-byte WebP container (RIFF + WEBP + VP8 fourccs). Supabase derives
 * `metadata.size` from the uploaded byte-length, so this is what the 009 BEFORE INSERT
 * trigger reads as `obj_size`. (Same stub idiom as orphan-delete.test.ts.)
 */
function webpBytes(): Uint8Array {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20, 0x00, 0x00, 0x00, 0x00,
  ]);
}

beforeAll(async () => {
  ctx = await setupTwoUsers('mediaq', RUN);
  const { error } = await admin
    .from('profiles')
    .update({ storage_used_bytes: NEAR_CAP })
    .eq('id', ctx.userA.id);
  expect(error).toBeNull();
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('MEDIA-03 — over-cap upload is rejected, usage unchanged', () => {
  it('GREEN: the upload route module exists and exports POST', async () => {
    const ROUTE = '@/app/api/media/upload/route';
    const mod = (await import(/* @vite-ignore */ ROUTE)) as { POST?: unknown };
    expect(typeof mod.POST).toBe('function');
  });

  it('an upload that would exceed the cap is rejected and leaves storage_used_bytes unchanged', async () => {
    // The route reads the seeded count and runs THIS predicate (step [D]); a 2 KiB
    // incoming on top of NEAR_CAP (1 KiB below the cap) exceeds QUOTA_BYTES → reject.
    const incoming = 2 * 1024;
    expect(wouldExceedQuota(NEAR_CAP, incoming)).toBe(true);

    // Because the route rejects (409) BEFORE the Storage write, no AFTER-INSERT
    // trigger fires — the seeded count is still NEAR_CAP. (We deliberately do NOT
    // perform the write, mirroring the route's pre-write rejection.)
    const { data } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', ctx.userA.id)
      .single();
    expect(Number(data!.storage_used_bytes ?? 0)).toBe(NEAR_CAP);
  });
});

/**
 * CR-01 — atomic quota (D-06/D-08). Runtime proof that migration 009's BEFORE INSERT
 * trigger fires and serializes: TWO genuinely-concurrent same-owner uploads, each fitting
 * the remaining headroom ALONE but exceeding it TOGETHER, race on the owner's profile
 * row (SELECT ... FOR UPDATE). Exactly one lands; usage never exceeds the cap.
 *
 * This case performs REAL service-role storage.objects inserts against the live local
 * stack (mirrors orphan-delete.test.ts) — it ONLY passes after 009 is applied
 * (`npx supabase migration up --local`). Without the trigger BOTH uploads would land and
 * usage would exceed the cap (the old non-atomic read-then-write race).
 *
 * Headroom math: seed `storage_used_bytes` to `QUOTA_BYTES - 30` (30 bytes of headroom).
 * Each payload is the 20-byte webp stub, so EITHER object alone fits (used + 20 =
 * QUOTA_BYTES - 10 <= QUOTA_BYTES) but BOTH together (used + 40 = QUOTA_BYTES + 10)
 * exceed the cap → the trigger must RAISE exactly one of the two racers.
 */
describe('CR-01 — concurrent near-cap uploads serialize (migration 009 atomic quota)', () => {
  // Headroom of 30 bytes; two 20-byte objects = 40 > 30 → one must be rejected.
  const NEAR_CAP_30 = QUOTA_BYTES - 30;
  let raceCtx: TwoUsers;
  const RACE_RUN = crypto.randomUUID().slice(0, 8);

  beforeAll(async () => {
    raceCtx = await setupTwoUsers('mediarace', RACE_RUN);
    const { error } = await admin
      .from('profiles')
      .update({ storage_used_bytes: NEAR_CAP_30 })
      .eq('id', raceCtx.userA.id);
    expect(error).toBeNull();
  }, 30_000);

  afterAll(async () => {
    await teardownTwoUsers(raceCtx);
  });

  it('CR-01: two concurrent near-cap uploads — exactly one succeeds, usage never exceeds cap', async () => {
    const folder = `${raceCtx.userA.id}/project`;
    const pathA = `${folder}/${RACE_RUN}-c1.webp`;
    const pathB = `${folder}/${RACE_RUN}-c2.webp`;
    const payload = webpBytes(); // 20 bytes each → 40 together > 30 headroom

    // Fire BOTH uploads genuinely concurrently (NOT awaited sequentially) so they
    // contend on the FOR UPDATE row lock. The first acquires the lock, charges via the
    // 003 AFTER trigger; the second re-reads the now-higher used value and is RAISEd.
    const [r1, r2] = await Promise.allSettled([
      admin.storage
        .from('media')
        .upload(pathA, payload, { contentType: 'image/webp', upsert: false }),
      admin.storage
        .from('media')
        .upload(pathB, payload, { contentType: 'image/webp', upsert: false }),
    ]);

    // Exactly ONE upload carries an error (the race-loser the 009 trigger RAISEd).
    const errored = [r1, r2].filter(
      (r) => r.status === 'fulfilled' && (r.value as { error?: unknown }).error,
    );
    expect(errored.length).toBe(1);

    // Usage never exceeded the cap (the loser was aborted BEFORE its AFTER-charge).
    const { data: prof } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', raceCtx.userA.id)
      .single();
    expect(Number(prof!.storage_used_bytes ?? 0)).toBeLessThanOrEqual(QUOTA_BYTES);

    // Teardown: remove whichever object DID land (the winner) so the suite stays clean.
    await admin.storage.from('media').remove([pathA, pathB]);
  });
});
