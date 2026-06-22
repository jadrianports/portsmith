/**
 * DIST-02 — the `generateDraftShare` / `revokeDraftShare` SHARED-A own-row write +
 * cross-tenant 0-row contract (Wave 0 RED scaffold, Plan 33-01). Run against the
 * LIVE local Supabase stack (node env, sequential — see vitest.config.ts).
 *
 * THE INVARIANT (DIST-02 / D-01 / D-02 / D-03):
 *   - generate mints a `draft_shares` row for the owner's OWN portfolio via an
 *     AUTHENTICATED RLS write (never service-role): a non-null `token`, a fixed
 *     ~7-day `expires_at`, `revoked_at = null` (active).
 *   - generate is an UPSERT keyed on `portfolio_id` (PK, D-03) — calling it twice
 *     ROTATES the single link (the old token stops resolving), it does not pile up
 *     rows.
 *   - revoke kills the token INSTANTLY (sets `revoked_at` / deletes the row, D-01)
 *     — a DB-backed revocable token, NOT a stateless JWT that lives until expiry.
 *   - a non-owner cannot write another portfolio's `draft_shares` row: the
 *     `draft_shares own all` RLS (EXISTS join on portfolios.user_id = auth.uid())
 *     filters the cross-tenant UPDATE to 0 rows.
 *
 * The actions under test are `generateDraftShare` + `revokeDraftShare` from
 * `@/lib/cms/draft-share-action` (NOT YET BUILT — Plan 33-02). They are
 * `'use server'` actions that read `getVerifiedClaims()` from request cookies, so
 * they cannot be invoked from a bare integration test (no request context). We
 * therefore (mirroring showcase-opt-in.test.ts):
 *   1. ASSERT the action module/exports will exist (a runtime variable-specifier
 *      import — the RED idiom — so `tsc` stays 0 while the exports are absent);
 *   2. EXERCISE the exact RLS boundary the actions rely on (an authenticated owner
 *      UPSERT/UPDATE of `draft_shares` scoped to their own portfolio), proving the
 *      own-row write succeeds and the cross-tenant write changes 0 rows.
 *
 * THE ASYMMETRY: a blocked write silently affects 0 rows (the RLS USING clause
 * filters them out), so we verify "no row changed" by reading back with the
 * service-role admin client — never by inspecting a thrown error.
 *
 * ── WHY RED NOW ───────────────────────────────────────────────────────────────
 * `draft_shares` (migration 030) is applied (33-01-T2) but `draft-share-action.ts`
 * (Plan 33-02) does not exist: the action-export assertion fails (undefined !==
 * 'function'). The RLS-boundary blocks below DO exercise the live 030 table and
 * pass once the table exists; they are the security contract the action depends on.
 * Plan 33-02 turns the action-export assertion GREEN. Do NOT implement the action here.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  adminClient,
  cleanupTestUsers,
  createTestUser,
  sweepLeftoverTestUsers,
  type TestUser,
} from './_setup';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

// The not-yet-built `'use server'` action module (Plan 33-02). Variable specifier
// so there is no STATIC reference for `tsc` to fail on; the runtime exports are
// `undefined` until 33-02 lands → the assertion is RED now.
const DRAFT_SHARE_ACTION_MOD = '@/lib/cms/draft-share-action';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

let userA: TestUser;
let userB: TestUser;
let portfolioA: string;
let portfolioB: string;
let ownerA: SupabaseClient;

async function signedInClient(user: TestUser): Promise<SupabaseClient> {
  const c = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  expect(error).toBeNull();
  return c;
}

/** Provision the owner's real portfolio via the `initialize_portfolio` RPC. */
async function bootstrapPortfolioAs(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.rpc('initialize_portfolio');
  expect(error).toBeNull();
  return data as unknown as string;
}

beforeAll(async () => {
  await sweepLeftoverTestUsers();
  const aName = `dist02a${RUN}`.slice(0, 30);
  const bName = `dist02b${RUN}`.slice(0, 30);

  userA = await createTestUser({
    email: `${aName}@example.test`,
    password: 'Test-Password-123!',
    username: aName,
    display_name: 'DIST-02 User A',
  });
  userB = await createTestUser({
    email: `${bName}@example.test`,
    password: 'Test-Password-123!',
    username: bName,
    display_name: 'DIST-02 User B',
  });

  ownerA = await signedInClient(userA);
  const ownerB = await signedInClient(userB);
  portfolioA = await bootstrapPortfolioAs(ownerA);
  portfolioB = await bootstrapPortfolioAs(ownerB);
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(userA?.id, userB?.id);
});

describe('DIST-02 — draft-share action surface (RED until Plan 33-02)', () => {
  it('exports async generateDraftShare + revokeDraftShare from @/lib/cms/draft-share-action', async () => {
    const mod = (await import(/* @vite-ignore */ DRAFT_SHARE_ACTION_MOD)) as {
      generateDraftShare?: (...a: unknown[]) => Promise<unknown>;
      revokeDraftShare?: (...a: unknown[]) => Promise<unknown>;
    };
    // RED until 33-02 adds the exports: undefined !== 'function'.
    expect(typeof mod.generateDraftShare).toBe('function');
    expect(typeof mod.revokeDraftShare).toBe('function');
  });
});

describe('DIST-02 — owner mints + rotates + revokes their OWN draft_shares row (the action’s RLS write)', () => {
  it('owner A can UPSERT a draft_shares row for their own portfolio (token + 7d expiry, active)', async () => {
    const token = `tok_${crypto.randomUUID().replace(/-/g, '')}`;
    const expires = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();
    const { error } = await ownerA
      .from('draft_shares')
      .upsert(
        { portfolio_id: portfolioA, token, expires_at: expires, revoked_at: null },
        { onConflict: 'portfolio_id' }, // D-03: PK on portfolio_id rotates the single link.
      )
      .select();
    expect(error).toBeNull();

    const { data } = await admin
      .from('draft_shares')
      .select('token, expires_at, revoked_at')
      .eq('portfolio_id', portfolioA)
      .single();
    const row = data as Record<string, unknown>;
    expect(row.token).toBe(token);
    expect(row.revoked_at).toBeNull(); // active (D-01).
    expect(new Date(row.expires_at as string).getTime()).toBeGreaterThan(Date.now()); // ~7d (D-02).
  });

  it('a second generate UPSERT ROTATES the single link (one row, new token) — D-03', async () => {
    const newToken = `tok_${crypto.randomUUID().replace(/-/g, '')}`;
    const expires = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();
    await ownerA
      .from('draft_shares')
      .upsert(
        { portfolio_id: portfolioA, token: newToken, expires_at: expires, revoked_at: null },
        { onConflict: 'portfolio_id' },
      );

    const { data } = await admin
      .from('draft_shares')
      .select('token')
      .eq('portfolio_id', portfolioA);
    expect((data ?? []).length).toBe(1); // one row — rotated, not piled up.
    expect((data![0] as Record<string, unknown>).token).toBe(newToken);
  });

  it('owner A can revoke their own token INSTANTLY (revoked_at set) — D-01', async () => {
    const { error } = await ownerA
      .from('draft_shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('portfolio_id', portfolioA)
      .select();
    expect(error).toBeNull();

    const { data } = await admin
      .from('draft_shares')
      .select('revoked_at')
      .eq('portfolio_id', portfolioA)
      .single();
    expect((data as Record<string, unknown>).revoked_at).not.toBeNull();
  });
});

describe('DIST-02 — cross-tenant draft_shares write changes 0 rows (T-33-02)', () => {
  it('A cannot mint/alter B’s draft_shares row (RLS own_all → 0 rows changed)', async () => {
    // Seed B's row via the service role (bypasses RLS).
    const bToken = `tok_${crypto.randomUUID().replace(/-/g, '')}`;
    await admin.from('draft_shares').upsert(
      {
        portfolio_id: portfolioB,
        token: bToken,
        expires_at: new Date(Date.now() + SEVEN_DAYS_MS).toISOString(),
        revoked_at: null,
      },
      { onConflict: 'portfolio_id' },
    );

    // A (authenticated) attempts to hijack B's row, exactly as a forged action call would.
    await ownerA
      .from('draft_shares')
      .update({ token: 'tok_hijacked', revoked_at: null })
      .eq('portfolio_id', portfolioB);

    // Verify via admin (bypasses RLS): B's token is UNCHANGED — 0 rows changed.
    const { data } = await admin
      .from('draft_shares')
      .select('token')
      .eq('portfolio_id', portfolioB)
      .single();
    expect((data as Record<string, unknown>).token).toBe(bToken);
  });
});
