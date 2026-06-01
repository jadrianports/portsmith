// PUB-01/02 — GREEN (04-06): the publish/unpublish toggle + the automatic 404 chain.
// Threat ref: T-publish-gate (T-04-06a cross-tenant, T-04-06d info-disclosure 404).
//
// The DB-level RLS assertions below are the invariant `setPublished` upholds: the
// action writes via the AUTHENTICATED client under RLS (never service-role), so the
// owner-succeeds / cross-tenant-rejected proof is exercised against the SAME RLS
// boundary the action uses. The action itself can't run in the vitest `node`
// project — it reads cookies via `next/headers`, which has no request scope here
// (the 04-03 rls-write.test.ts constraint) — so the action's EXISTENCE is asserted
// directly while its RLS + 404 contract is proven by authenticated-client writes
// against the live local stack.
//
// Behavior under test (the automatic 404 chain — PUB-02 needs no new read code):
//   - the OWNER's authenticated UPDATE of `published` SUCCEEDS (`published` is NOT a
//     protected column, so the trigger does not block the owner — T-04-06b);
//   - setting profiles.published=false makes portfolio_is_public() false → the
//     public_* views return NOTHING → the public read returns null (→ notFound());
//   - re-publishing restores the public row;
//   - user B's UPDATE of A's `published` changes nothing (cross-tenant REJECTED,
//     T-04-06a) — verified by reading A's row back with the service-role admin.
//
// THE ASYMMETRY (01-RESEARCH Pitfall 3): a filtered view read returns
// `{ data: [], error: null }` (absent, not an error) → get-portfolio returns null;
// a blocked UPDATE silently affects 0 rows (the USING clause filters them) — assert
// "no row changed" via admin read-back, never `.rejects`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from './_cms-fixtures';

import { setPublished } from '@/lib/cms/publish-action';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

let ctx: TwoUsers;

beforeAll(async () => {
  ctx = await setupTwoUsers('cmspub', RUN);
  // Start A published via the OWNER's authenticated client (proves the owner can
  // flip the non-protected `published` column directly under RLS — the very write
  // setPublished(true) performs).
  const pub = await ctx.clientA
    .from('profiles')
    .update({ published: true })
    .eq('id', ctx.userA.id);
  expect(pub.error).toBeNull();
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('PUB-01/02 — publish/unpublish under RLS + the automatic 404 chain', () => {
  it('exposes the setPublished action 04-06 wires the publish path through', () => {
    expect(typeof setPublished).toBe('function');
  });

  it('the OWNER can flip `published` directly under RLS (it is NOT protected)', async () => {
    // `published` is absent from the enforce_protected_profile_columns guard list
    // (002:108-118), so the owner's own-row UPDATE is NOT blocked by the trigger
    // (T-04-06b — the designed capability, contrast a protected-col write).
    const { error } = await ctx.clientA
      .from('profiles')
      .update({ published: true })
      .eq('id', ctx.userA.id);
    expect(error).toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('published')
      .eq('id', ctx.userA.id)
      .single();
    expect(data!.published).toBe(true);
  });

  it('published profile is visible via public_profiles', async () => {
    const { data, error } = await ctx.clientA
      .from('profiles')
      .update({ published: true })
      .eq('id', ctx.userA.id);
    expect(error).toBeNull();
    void data;

    const { data: pub, error: readErr } = await admin
      .from('public_profiles')
      .select('username')
      .eq('username', ctx.userA.username);
    expect(readErr).toBeNull();
    expect((pub ?? []).length).toBeGreaterThan(0);
  });

  it('OWNER setting published=false yields a length-0 public read (the 404 chain)', async () => {
    // The OWNER unpublishes via their own authenticated client (the setPublished
    // write). portfolio_is_public() now returns false → public_profiles returns
    // nothing → the public read is null → notFound().
    const { error } = await ctx.clientA
      .from('profiles')
      .update({ published: false })
      .eq('id', ctx.userA.id);
    expect(error).toBeNull();

    const { data, error: readErr } = await admin
      .from('public_profiles')
      .select('username')
      .eq('username', ctx.userA.username);
    expect(readErr).toBeNull();
    expect(data).toHaveLength(0); // absent, not an error → notFound()
  });

  it('re-publishing restores the public row (the live/404 flip is reversible)', async () => {
    const { error } = await ctx.clientA
      .from('profiles')
      .update({ published: true })
      .eq('id', ctx.userA.id);
    expect(error).toBeNull();

    const { data, error: readErr } = await admin
      .from('public_profiles')
      .select('username')
      .eq('username', ctx.userA.username);
    expect(readErr).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("B's publish of A's row changes nothing (cross-tenant REJECTED, T-04-06a)", async () => {
    // Make A's current state knowable, then attempt a cross-tenant flip as B.
    await ctx.clientA.from('profiles').update({ published: true }).eq('id', ctx.userA.id);

    await ctx.clientB
      .from('profiles')
      .update({ published: false })
      .eq('id', ctx.userA.id); // RLS USING clause filters this to 0 rows

    const { data } = await admin
      .from('profiles')
      .select('published')
      .eq('id', ctx.userA.id)
      .single();
    expect(data!.published).toBe(true); // unchanged — B could not touch A's row
  });
});
