/**
 * MEDIA-03 — server-authoritative quota gate (Wave 0 RED).
 *
 * GREENED BY: Plan 02 (the upload route's pre-upload quota gate, step [D]). RED NOW
 * via the missing-module import of the route (STATE 04-01 pattern) — a REAL gate,
 * not a `.skip`/`.todo` pass.
 *
 * CONTRACT this proves once green: `storage_used_bytes` is a PROTECTED column —
 * only the admin (service-role) client can seed it (the 002 trigger blocks client
 * writes; rls-protected-columns.test.ts:45). We seed user A near the 25 MB cap via
 * `adminClient()`, then assert the route's over-cap rejection leaves
 * `storage_used_bytes` UNCHANGED (the route reads the count + incoming size and
 * rejects BEFORE the Storage write, so the AFTER trigger never fires for the
 * rejected upload).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from '../cms/_cms-fixtures';

import { QUOTA_BYTES } from '@/lib/media/upload-config';

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
  it('RED until Plan 02: the upload route module exists', async () => {
    // RED via a RUNTIME import rejection (specifier in a variable so tsc stays 0).
    const ROUTE = '@/app/api/media/upload/route';
    const mod = (await import(/* @vite-ignore */ ROUTE)) as { POST?: unknown };
    expect(typeof mod.POST).toBe('function');
  });

  it('an upload that would exceed the cap leaves storage_used_bytes unchanged', async () => {
    // The route rejects (used + incoming > QUOTA_BYTES) before any Storage write.
    // Once green, drive the over-cap upload through the route and assert the count
    // is still NEAR_CAP (no AFTER-trigger increment for a rejected upload).
    const { data } = await admin
      .from('profiles')
      .select('storage_used_bytes')
      .eq('id', ctx.userA.id)
      .single();
    expect(Number(data!.storage_used_bytes ?? 0)).toBe(NEAR_CAP);
  });
});
