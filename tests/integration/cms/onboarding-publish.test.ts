// ONB-06/ONB-05 — Wave-0 (18-01): the wizard's terminal publish+stamp write.
// Threat ref: T-18-publish-stamp (cross-tenant stamp), T-18-onboarded-col (onboarded_at
// is NOT a protected column, so the owner writes it directly under RLS).
//
// The DB-level RLS assertions below are the invariant `markOnboardedAndPublish` upholds:
// the action writes via the AUTHENTICATED client under RLS (never service-role), with an
// EXPLICIT two-column allowlist `{ published: true, onboarded_at }`, so the
// owner-succeeds / cross-tenant-rejected proof is exercised against the SAME RLS boundary
// the action uses. The action itself can't run in the vitest `node` project — it reads
// cookies via `next/headers`, which has no request scope here (the 04-03 rls-write.test.ts
// constraint) — so the action's EXISTENCE is asserted directly while its RLS + stamp
// contract is proven by authenticated-client writes against the live local stack.
//
// Behavior under test (the publish+stamp write the wizard's Publish step performs):
//   - the OWNER's authenticated UPDATE of `{ published: true, onboarded_at }` on their
//     OWN row SUCCEEDS — neither column is protected, so the trigger does not block the
//     owner (T-18-onboarded-col); read-back shows published===true AND onboarded_at
//     non-null (the durable completion marker, ONB-05);
//   - user B's same UPDATE against A's row stamps NOTHING (cross-tenant REJECTED,
//     T-18-publish-stamp) — A's onboarded_at is UNCHANGED, verified via the admin read.
//
// THE ASYMMETRY (01-RESEARCH Pitfall 3 / publish-404 note): a blocked UPDATE silently
// affects 0 rows (the RLS USING clause filters them) — assert "onboarded_at unchanged"
// via admin read-back, never `.rejects`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from './_cms-fixtures';

import { markOnboardedAndPublish } from '@/lib/cms/publish-action';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

let ctx: TwoUsers;

beforeAll(async () => {
  ctx = await setupTwoUsers('cmsonb', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('ONB-06/ONB-05 — markOnboardedAndPublish publish+stamp under RLS', () => {
  it('exposes the markOnboardedAndPublish action the wizard Publish step calls', () => {
    expect(typeof markOnboardedAndPublish).toBe('function');
  });

  it('the OWNER can publish AND stamp onboarded_at in one own-row UPDATE under RLS', async () => {
    // The exact two-column allowlist write markOnboardedAndPublish performs. Neither
    // `published` nor `onboarded_at` is in the enforce_protected_profile_columns guard
    // list (002:108-118), so the owner's own-row UPDATE is NOT blocked by the trigger
    // (T-18-onboarded-col — the designed capability).
    const stamp = new Date().toISOString();
    const { error } = await ctx.clientA
      .from('profiles')
      .update({ published: true, onboarded_at: stamp })
      .eq('id', ctx.userA.id);
    expect(error).toBeNull();

    // Read back via the service-role admin: BOTH columns landed — published is Live and
    // onboarded_at carries the durable completion marker (non-null, ONB-05).
    const { data } = await admin
      .from('profiles')
      .select('published, onboarded_at')
      .eq('id', ctx.userA.id)
      .single();
    expect(data!.published).toBe(true);
    expect(data!.onboarded_at).not.toBeNull();
  });

  it("B's publish+stamp of A's row leaves A's onboarded_at UNCHANGED (cross-tenant REJECTED)", async () => {
    // Establish A's current onboarded_at, then attempt the cross-tenant stamp as B.
    const aStamp = new Date().toISOString();
    await ctx.clientA
      .from('profiles')
      .update({ published: true, onboarded_at: aStamp })
      .eq('id', ctx.userA.id);

    const { data: before } = await admin
      .from('profiles')
      .select('onboarded_at')
      .eq('id', ctx.userA.id)
      .single();
    expect(before!.onboarded_at).not.toBeNull();

    // B attempts the SAME publish+stamp against A's row — the RLS USING clause filters
    // this to 0 rows, so nothing is written (T-18-publish-stamp).
    await ctx.clientB
      .from('profiles')
      .update({ published: false, onboarded_at: new Date().toISOString() })
      .eq('id', ctx.userA.id);

    const { data: after } = await admin
      .from('profiles')
      .select('published, onboarded_at')
      .eq('id', ctx.userA.id)
      .single();
    // A's row is untouched — B could neither unpublish A nor re-stamp A's onboarded_at.
    expect(after!.published).toBe(true);
    expect(after!.onboarded_at).toBe(before!.onboarded_at);
  });
});
