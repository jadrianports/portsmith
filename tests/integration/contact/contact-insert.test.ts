/**
 * CONT-01 — RED scaffold (Wave 0, Plan 06-01). GREENED BY 06-02-T2.
 *
 * Live-stack proof of the `messages` write boundary (ADR-004 / D-02), mirroring
 * `tests/integration/rls-no-anon-insert.test.ts`:
 *   - the ANON client CANNOT INSERT into `messages` (no public INSERT policy →
 *     RLS denies → non-null error AND no row created); the public anon key must
 *     NOT be a path straight to PostgREST that bypasses Turnstile + rate-limit.
 *   - the SERVICE-ROLE insert (the route's privileged write path) SUCCEEDS and is
 *     scoped to the target portfolio.
 *
 * ── WHY RED NOW ───────────────────────────────────────────────────────────────
 * The no-anon-INSERT half passes on the current foundation (the policy already
 * exists). The RED half is the route helper the slice must ship: the contact-
 * INSERT path is exercised through the not-yet-existing
 * `@/lib/rate-limit/ledger` `countAndRecord` (the ledger gate the route calls
 * before the insert). Imported at RUNTIME via the [05-01] variable specifier so
 * `tsc --noEmit` stays 0; at runtime it is ERR_MODULE_NOT_FOUND until 06-02 lands,
 * making this spec genuinely RED. Reuses `_setup.ts` (via `_cms-fixtures`) — no
 * hand-rolled clients.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from '../cms/_cms-fixtures';
import { anonClient } from '../_setup';

const admin = adminClient();
const anon = anonClient();
const RUN = crypto.randomUUID().slice(0, 8);
const SENTINEL = `contact-insert-sentinel-${RUN}`;

const LEDGER = '@/lib/rate-limit/ledger';

let ctx: TwoUsers;

beforeAll(async () => {
  ctx = await setupTwoUsers('contins', RUN);
  // Publish A's portfolio so the route's pre-insert guard (published & not locked)
  // would pass; the service-role insert is scoped to A's portfolio.
  const pub = await ctx.clientA
    .from('profiles')
    .update({ published: true })
    .eq('id', ctx.userA.id);
  expect(pub.error).toBeNull();
}, 30_000);

afterAll(async () => {
  await admin.from('messages').delete().eq('body', SENTINEL);
  await teardownTwoUsers(ctx);
});

describe('CONT-01 — messages write boundary (ADR-004)', () => {
  it('ANON cannot INSERT into messages (no public INSERT) and creates no row', async () => {
    const { error } = await anon.from('messages').insert({
      portfolio_id: ctx.portfolioA,
      sender_name: 'Attacker',
      sender_email: 'attacker@example.test',
      subject: 'bypass',
      body: SENTINEL,
    });
    // No INSERT policy ⇒ RLS denies ⇒ non-null error.
    expect(error).not.toBeNull();
    // Definitively: no such row exists (service-role read-back).
    const { data } = await admin
      .from('messages')
      .select('id')
      .eq('body', SENTINEL);
    expect(data ?? []).toHaveLength(0);
  });

  it('SERVICE-ROLE insert (the route path) succeeds and is scoped to the target portfolio', async () => {
    const body = `${SENTINEL}-svc`;
    const { error } = await admin.from('messages').insert({
      portfolio_id: ctx.portfolioA,
      sender_name: 'Visitor',
      sender_email: 'visitor@example.test',
      subject: 'Hello',
      body,
    });
    expect(error).toBeNull();
    const { data } = await admin
      .from('messages')
      .select('portfolio_id')
      .eq('body', body)
      .single();
    expect(data!.portfolio_id).toBe(ctx.portfolioA);
    await admin.from('messages').delete().eq('body', body);
  });

  it('exposes the rate-limit ledger gate the route calls before the insert (RED until 06-02)', async () => {
    const mod = (await import(/* @vite-ignore */ LEDGER)) as {
      countAndRecord?: unknown;
    };
    // RED now: the module does not exist → ERR_MODULE_NOT_FOUND at runtime.
    expect(typeof mod.countAndRecord).toBe('function');
  });
});
