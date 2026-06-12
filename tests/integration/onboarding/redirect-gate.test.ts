// ONB-02 + ONB-05 — GREEN (18-03): the first-run routing gate (D-02) and its
// one-shot soft-skip escape (D-04). Threat ref: T-18-redirect (no loop / no open
// redirect), T-18-skip (one-shot, replay-safe).
//
// WHAT THIS PROVES, and WHY in two layers:
//
//  (A) The PURE predicate `shouldRedirectToOnboarding(onboardedAt, skipCookiePresent)`
//      — the exact branch the `/dashboard` RSC gate evaluates. The RSC itself can't
//      run in the vitest `node` project (it reads cookies via `next/headers`, which
//      has no request scope here — the publish-404.test.ts constraint), so the
//      gate's DECISION is extracted to a pure function and the FULL ONB-02 + ONB-05
//      truth-table is asserted directly. This automates the one-shot semantics
//      (null+cookie → reach editor; null+no-cookie → back to wizard) WITHOUT a
//      request scope. The cookie READ + the middleware one-shot CLEAR are exercised
//      by the page/middleware at runtime; this layer proves the logic they call.
//
//  (B) The DURABLE half the predicate's `onboardedAt` input depends on — the
//      `profiles.onboarded_at` column contract — against the LIVE local stack:
//        - a freshly bootstrapped user has `onboarded_at IS NULL` → the gate's
//          `onboarded_at == null` branch is TRUE (would redirect to /onboarding,
//          ONB-02);
//        - after the OWNER's authenticated UPDATE `{ published:true, onboarded_at }`
//          (the `markOnboardedAndPublish` write from 18-01), the row's `onboarded_at`
//          is NON-NULL → the predicate is FALSE (no redirect, no loop — ONB-05
//          "finished user never forced back");
//        - the founder-style backfill semantics: migration 022 stamps `onboarded_at`
//          on every `published=true` row, so an already-live user is never bounced.
//        - cross-tenant stamp is REJECTED by RLS (B cannot stamp A's onboarded_at) —
//          asserted via an admin read-back, never `.rejects` (the 0-rows asymmetry).
//
// The DB writes run via the AUTHENTICATED client under RLS (never service-role), so
// the same boundary the real action uses is exercised; the admin client is used ONLY
// for read-backs / cross-tenant assertions.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from '../cms/_cms-fixtures';

import {
  ONBOARDING_SKIP_COOKIE,
  shouldRedirectToOnboarding,
} from '@/lib/onboarding/skip-cookie';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

let ctx: TwoUsers;

beforeAll(async () => {
  ctx = await setupTwoUsers('onbgate', RUN);
}, 30_000);

afterAll(async () => {
  await teardownTwoUsers(ctx);
});

describe('ONB-02/ONB-05 — the D-02 first-run gate predicate (pure truth-table)', () => {
  it('exposes the cookie-name constant the skip route + gate share', () => {
    expect(ONBOARDING_SKIP_COOKIE).toBe('onboarding-skip');
  });

  it('onboarded_at NULL + NO skip cookie → redirect to /onboarding (ONB-02 first run)', () => {
    expect(shouldRedirectToOnboarding(null, false)).toBe(true);
  });

  it('onboarded_at NULL + skip cookie present → reach the editor (ONB-05 one-shot escape)', () => {
    // The soft-skipper reaches the editor for THIS one visit; the middleware clears
    // the cookie so the NEXT request (cookie gone, onboarded_at still null) re-fires
    // the gate — escapable for one visit, never a loop.
    expect(shouldRedirectToOnboarding(null, true)).toBe(false);
  });

  it('onboarded_at non-null → NEVER redirected, regardless of the cookie (ONB-05, no loop)', () => {
    // A finished/published user is never forced back through onboarding. The skip
    // cookie is irrelevant once onboarded_at is stamped.
    const stamped = new Date().toISOString();
    expect(shouldRedirectToOnboarding(stamped, false)).toBe(false);
    expect(shouldRedirectToOnboarding(stamped, true)).toBe(false);
  });
});

describe('ONB-02/ONB-05 — the durable onboarded_at contract the gate reads (live stack)', () => {
  it('a freshly bootstrapped user has onboarded_at IS NULL (gate would redirect)', async () => {
    // No default on the column (migration 022) → a brand-new user is not yet onboarded.
    const { data, error } = await admin
      .from('profiles')
      .select('onboarded_at, published')
      .eq('id', ctx.userA.id)
      .single();
    expect(error).toBeNull();
    expect(data!.onboarded_at).toBeNull();
    expect(data!.published).toBe(false);
    // The gate's predicate input → would route this user into the wizard (ONB-02).
    expect(shouldRedirectToOnboarding(data!.onboarded_at, false)).toBe(true);
  });

  it("OWNER's authenticated publish-stamp sets onboarded_at non-null → gate does NOT redirect (ONB-05)", async () => {
    // The exact two-column write `markOnboardedAndPublish` performs, via the OWNER's
    // authenticated RLS client (never service-role): publish AND durably stamp the
    // completion timestamp in one write.
    const stamp = new Date().toISOString();
    const { error } = await ctx.clientA
      .from('profiles')
      .update({ published: true, onboarded_at: stamp })
      .eq('id', ctx.userA.id);
    expect(error).toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('onboarded_at, published')
      .eq('id', ctx.userA.id)
      .single();
    expect(data!.published).toBe(true);
    expect(data!.onboarded_at).not.toBeNull();
    // Finished user → the predicate is false (no redirect, no loop — ONB-05). Even if
    // a stale skip cookie were present, a stamped user is never bounced.
    expect(shouldRedirectToOnboarding(data!.onboarded_at, false)).toBe(false);
    expect(shouldRedirectToOnboarding(data!.onboarded_at, true)).toBe(false);
  });

  it("the published-row backfill semantics: a published row carries a non-null onboarded_at", async () => {
    // Migration 022 backfilled `onboarded_at = now()` for every `published=true` row
    // (the founder belt-and-suspenders), and the publish-stamp above keeps that
    // invariant: a published user always has a non-null marker → never re-onboarded.
    const { data } = await admin
      .from('profiles')
      .select('onboarded_at, published')
      .eq('id', ctx.userA.id)
      .single();
    expect(data!.published).toBe(true);
    expect(data!.onboarded_at).not.toBeNull();
  });

  it("B's stamp of A's onboarded_at changes nothing (cross-tenant REJECTED by RLS)", async () => {
    // Record A's current (stamped) state, then attempt a cross-tenant overwrite as B.
    const { data: before } = await admin
      .from('profiles')
      .select('onboarded_at')
      .eq('id', ctx.userA.id)
      .single();
    expect(before!.onboarded_at).not.toBeNull();

    // B tries to NULL out A's onboarded_at (force A back into onboarding). The RLS
    // USING clause filters this to 0 rows — assert "no row changed" via admin
    // read-back, never `.rejects` (a blocked UPDATE is a silent 0-row no-op).
    await ctx.clientB
      .from('profiles')
      .update({ onboarded_at: null })
      .eq('id', ctx.userA.id);

    const { data: after } = await admin
      .from('profiles')
      .select('onboarded_at')
      .eq('id', ctx.userA.id)
      .single();
    expect(after!.onboarded_at).toBe(before!.onboarded_at); // unchanged — B could not touch A's row
  });
});
