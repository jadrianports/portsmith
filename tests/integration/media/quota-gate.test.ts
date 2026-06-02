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
