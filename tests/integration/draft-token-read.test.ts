/**
 * DIST-02 — the `getPortfolioByDraftToken` read contract (Wave 0 RED scaffold,
 * Plan 33-01). Run against the LIVE local Supabase stack (node env, sequential).
 *
 * THE INVARIANT (DIST-02 / D-01 / D-02):
 *   - a VALID, active, unexpired token resolves to EXACTLY that owner's draft
 *     portfolio — and no other portfolio's data leaks into the result.
 *   - an INVALID / EXPIRED / REVOKED token resolves to null / notFound (the draft
 *     route 404s) — expiry (D-02) and revoke (D-01) are enforced ON READ, so a
 *     leaked-but-revoked link is dead instantly.
 *   - the projected draft result NEVER carries a private column (email / role /
 *     storage_used_bytes / locked) — the same column-safety line the public anon
 *     read holds (rls-anon-column-safety.test.ts), because the recipient is an
 *     UNAUTHENTICATED visitor with a secret link, not the owner.
 *
 * The read under test is `getPortfolioByDraftToken` from
 * `@/lib/portfolio/get-portfolio-by-draft-token` (NOT YET BUILT — Plan 33-02). The
 * token read in 33-02 uses `supabaseAdmin` (RLS bypassed — the recipient has no
 * session) gated SOLELY by the token + expiry + revoked_at lookup; this scaffold
 * asserts the function will exist (variable-specifier RED idiom) and exercises the
 * raw `draft_shares` lookup invariants (expired/revoked rows must not resolve) the
 * read is built on.
 *
 * THE ASYMMETRY (mirrors rls-anon-column-safety.test.ts): KEY ABSENCE means the
 * private key is not present at all on the returned row (`Object.keys` excludes
 * it), not merely null — a null value would still leak the column's existence.
 *
 * ── WHY RED NOW ───────────────────────────────────────────────────────────────
 * `draft_shares` (migration 030) is live (33-01-T2) but
 * `get-portfolio-by-draft-token.ts` (Plan 33-02) does not exist: the function-export
 * assertion fails (undefined !== 'function'). The raw-table lookup invariants below
 * pass against the live 030 table; they are the contract the read is built on.
 * Plan 33-02 turns the function-export + projection assertions GREEN.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  PRIVATE_PROFILE_COLUMNS,
  adminClient,
  createTestUser,
  cleanupTestUsers,
  sweepLeftoverTestUsers,
  type TestUser,
} from './_setup';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

// The not-yet-built read module (Plan 33-02). Variable specifier → no STATIC
// reference for `tsc`; the runtime export is `undefined` until 33-02 lands.
const DRAFT_READ_MOD = '@/lib/portfolio/get-portfolio-by-draft-token';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

let userA: TestUser;
let portfolioA: string;
let activeToken: string;
let expiredToken: string;
let revokedToken: string;

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

beforeAll(async () => {
  await sweepLeftoverTestUsers();
  const aName = `dread02${RUN}`.slice(0, 30);
  userA = await createTestUser({
    email: `${aName}@example.test`,
    password: 'Test-Password-123!',
    username: aName,
    display_name: 'DIST-02 Read User',
  });

  const ownerA = await signedInClient(userA);
  const { data: pid, error } = await ownerA.rpc('initialize_portfolio');
  expect(error).toBeNull();
  portfolioA = pid as unknown as string;

  // Seed three token states via the service role (the action that mints them is
  // Plan 33-02; here we set up the raw rows the read must honor). draft_shares is
  // PK'd on portfolio_id, so we cycle the single row across the three states the
  // individual `it` blocks below assert against (active is set last, leaving the
  // row active for the leak/projection check).
  expiredToken = `tok_expired_${crypto.randomUUID().replace(/-/g, '')}`;
  revokedToken = `tok_revoked_${crypto.randomUUID().replace(/-/g, '')}`;
  activeToken = `tok_active_${crypto.randomUUID().replace(/-/g, '')}`;
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(userA?.id);
});

/** Upsert the single draft_shares row into a given state (PK = portfolio_id). */
async function setDraftRow(token: string, expiresMsFromNow: number, revoked: boolean) {
  await admin.from('draft_shares').upsert(
    {
      portfolio_id: portfolioA,
      token,
      expires_at: new Date(Date.now() + expiresMsFromNow).toISOString(),
      revoked_at: revoked ? new Date().toISOString() : null,
    },
    { onConflict: 'portfolio_id' },
  );
}

describe('DIST-02 — getPortfolioByDraftToken surface (RED until Plan 33-02)', () => {
  it('exports an async getPortfolioByDraftToken from the read module', async () => {
    const mod = (await import(/* @vite-ignore */ DRAFT_READ_MOD)) as {
      getPortfolioByDraftToken?: (token: string) => Promise<unknown>;
    };
    // RED until 33-02 adds the export: undefined !== 'function'.
    expect(typeof mod.getPortfolioByDraftToken).toBe('function');
  });
});

describe('DIST-02 — the draft_shares lookup invariants the read enforces (ACTIVE, against live 030)', () => {
  it('an ACTIVE, unexpired token row resolves to exactly this owner’s portfolio', async () => {
    await setDraftRow(activeToken, SEVEN_DAYS_MS, false);
    const { data } = await admin
      .from('draft_shares')
      .select('portfolio_id, expires_at, revoked_at')
      .eq('token', activeToken)
      .single();
    const row = data as Record<string, unknown>;
    expect(row.portfolio_id).toBe(portfolioA);
    expect(row.revoked_at).toBeNull();
    expect(new Date(row.expires_at as string).getTime()).toBeGreaterThan(Date.now());
  });

  it('an EXPIRED token row is detectable as expired (read enforces expiry — D-02)', async () => {
    await setDraftRow(expiredToken, -SEVEN_DAYS_MS, false); // expired a week ago.
    const { data } = await admin
      .from('draft_shares')
      .select('expires_at')
      .eq('token', expiredToken)
      .single();
    expect(new Date((data as Record<string, unknown>).expires_at as string).getTime()).toBeLessThan(
      Date.now(),
    );
  });

  it('a REVOKED token row is detectable as revoked (read enforces revoke — D-01)', async () => {
    await setDraftRow(revokedToken, SEVEN_DAYS_MS, true);
    const { data } = await admin
      .from('draft_shares')
      .select('revoked_at')
      .eq('token', revokedToken)
      .single();
    expect((data as Record<string, unknown>).revoked_at).not.toBeNull();
  });
});

// RED until Plan 33-02 ships the read + its column-safe projection. Skipped so the
// not-yet-existing read is not invoked on every run; flip to `describe(` when 33-02
// lands `getPortfolioByDraftToken`.
describe.skip('DIST-02 — the resolved draft result is column-safe + non-leaking (RED until 33-02)', () => {
  it('a valid token → only this owner’s draft (no other portfolio leaks)', async () => {
    const mod = (await import(/* @vite-ignore */ DRAFT_READ_MOD)) as {
      getPortfolioByDraftToken: (token: string) => Promise<{ portfolio?: { id?: string } } | null>;
    };
    const result = await mod.getPortfolioByDraftToken(activeToken);
    expect(result?.portfolio?.id).toBe(portfolioA);
  });

  it('invalid / expired / revoked token → null (notFound)', async () => {
    const mod = (await import(/* @vite-ignore */ DRAFT_READ_MOD)) as {
      getPortfolioByDraftToken: (token: string) => Promise<unknown | null>;
    };
    expect(await mod.getPortfolioByDraftToken('tok_does_not_exist')).toBeNull();
    expect(await mod.getPortfolioByDraftToken(expiredToken)).toBeNull();
    expect(await mod.getPortfolioByDraftToken(revokedToken)).toBeNull();
  });

  it('the projected result carries NO private profile column (email/role/storage/locked)', async () => {
    const mod = (await import(/* @vite-ignore */ DRAFT_READ_MOD)) as {
      getPortfolioByDraftToken: (token: string) => Promise<Record<string, unknown> | null>;
    };
    const result = await mod.getPortfolioByDraftToken(activeToken);
    const serialized = JSON.stringify(result ?? {});
    for (const col of PRIVATE_PROFILE_COLUMNS) {
      expect(serialized).not.toContain(`"${col}"`);
    }
  });
});
