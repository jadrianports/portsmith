/**
 * SAFE-02 — RED scaffold (Wave 0, Plan 06-01). GREENED BY 06-07-T1.
 *
 * Live-stack proof of the kill-switch lock → 404 chain (D-12) and its boundary:
 *   - a SERVICE-ROLE write of `locked=true, published=false` on a target SUCCEEDS
 *     (the protected-columns trigger short-circuits for service_role — 002:55),
 *     and the `public_profiles` view then returns NOTHING for that portfolio
 *     (portfolio_is_public() is now false → the 404 chain);
 *   - an AUTHENTICATED NON-admin write of `locked` is REJECTED by the protected-
 *     columns trigger (RAISE 'Attempt to modify a protected profile column').
 *
 * `locked`/`published`/`locked_reason` live on `profiles` (keyed by user id); the
 * lock combo is three protected columns in one service-role write.
 *
 * ── WHY RED NOW ───────────────────────────────────────────────────────────────
 * The service-role short-circuit + the trigger block + the view 404 all hold on
 * the current foundation. The RED half is the lock SERVER ACTION the slice ships:
 * `lockPortfolio` from the not-yet-existing `@/lib/admin/lock-action`, imported at
 * RUNTIME via the [05-01] variable specifier (tsc stays 0; ERR_MODULE_NOT_FOUND
 * until 06-07). Reuses `_setup.ts` via `_cms-fixtures` — no hand-rolled clients.
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

const LOCK_ACTION = '@/lib/admin/lock-action';

let ctx: TwoUsers;

beforeAll(async () => {
  ctx = await setupTwoUsers('killsw', RUN);
  // Start A published & unlocked so the lock has something to take down.
  const pub = await ctx.clientA
    .from('profiles')
    .update({ published: true })
    .eq('id', ctx.userA.id);
  expect(pub.error).toBeNull();
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('SAFE-02 — kill switch lock → 404 chain', () => {
  it('published A is visible via public_profiles BEFORE the lock', async () => {
    const { data } = await admin
      .from('public_profiles')
      .select('username')
      .eq('username', ctx.userA.username);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it('SERVICE-ROLE lock (locked=true, published=false) succeeds via the trigger short-circuit', async () => {
    const { error } = await admin
      .from('profiles')
      .update({ locked: true, published: false, locked_reason: 'abuse' })
      .eq('id', ctx.userA.id);
    // service_role short-circuit (002:55) ⇒ the protected-column trigger does NOT block this.
    expect(error).toBeNull();
    const { data } = await admin
      .from('profiles')
      .select('locked, published, locked_reason')
      .eq('id', ctx.userA.id)
      .single();
    expect(data!.locked).toBe(true);
    expect(data!.published).toBe(false);
    expect(data!.locked_reason).toBe('abuse');
  });

  it('locked A returns NOTHING from public_profiles (the 404 chain)', async () => {
    const { data, error } = await admin
      .from('public_profiles')
      .select('username')
      .eq('username', ctx.userA.username);
    expect(error).toBeNull();
    expect(data).toHaveLength(0); // portfolio_is_public()=false ⇒ absent ⇒ notFound()
  });

  it('an AUTHENTICATED NON-admin write of `locked` is REJECTED by the protected-columns trigger', async () => {
    // User B (a normal authenticated user) cannot self-set `locked` on their OWN
    // row — `locked` is protected; the trigger RAISES (the opposite shape from a
    // filtered SELECT: a non-null error, not silent 0-rows).
    const { error } = await ctx.clientB
      .from('profiles')
      .update({ locked: true })
      .eq('id', ctx.userB.id);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/protected profile column/i);
  });

  it('exposes the lock SERVER ACTION the kill switch wires (RED until 06-07)', async () => {
    const mod = (await import(/* @vite-ignore */ LOCK_ACTION)) as {
      lockPortfolio?: unknown;
    };
    expect(typeof mod.lockPortfolio).toBe('function');
  });
});
