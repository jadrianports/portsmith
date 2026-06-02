/**
 * CONT-03 — RED scaffold (Wave 0, Plan 06-01). GREENED BY 06-02-T2
 * (re-asserted after delete by 06-05).
 *
 * The LOAD-BEARING D-06 invariant: the contact rate limit counts the dedicated
 * `rate_limit_events` LEDGER (`bucket='contact'`, `subject=portfolio_id`), NOT
 * `messages` rows — so an owner deleting inbox spam NEVER reopens a spammer's
 * quota (Pitfall 2; this refines the handoff's "count messages rows"). This spec
 * encodes that forbidden coupling as a binding assertion:
 *   1. seed 20 ledger rows in the last hour → the 21st is OVER cap;
 *   2. DELETE all `messages` rows for that portfolio;
 *   3. assert the LEDGER count (hence the cap) is UNAFFECTED by the message delete.
 *
 * `rate_limit_events` has no client RLS policy (deny-all, 004:284-288) → all
 * ledger reads/writes are service-role inside the route, so this spec seeds and
 * counts via the service-role admin (the route's own path).
 *
 * ── WHY RED NOW ───────────────────────────────────────────────────────────────
 * The ledger-vs-messages independence holds at the DB level. The RED half is the
 * shared cap helper the route calls — `countAndRecord` /
 * `isContactRateLimited` from the not-yet-existing `@/lib/rate-limit/ledger`,
 * imported at RUNTIME via the [05-01] variable specifier (tsc stays 0;
 * ERR_MODULE_NOT_FOUND until 06-02). Reuses `_setup.ts` via `_cms-fixtures`.
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
const TAG = `ratelimit-${RUN}`;
const CONTACT_CAP = 20;

const LEDGER = '@/lib/rate-limit/ledger';

let ctx: TwoUsers;

/** Count contact-bucket ledger rows for a portfolio in the last hour (the cap input). */
async function ledgerCount(portfolioId: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from('rate_limit_events')
    .select('*', { count: 'exact', head: true })
    .eq('bucket', 'contact')
    .eq('subject', portfolioId)
    .gte('created_at', since);
  expect(error).toBeNull();
  return count ?? 0;
}

beforeAll(async () => {
  ctx = await setupTwoUsers('ratelim', RUN);
  // Seed exactly CONTACT_CAP ledger rows for A's portfolio (all within the window).
  const rows = Array.from({ length: CONTACT_CAP }, () => ({
    bucket: 'contact',
    subject: ctx.portfolioA,
  }));
  const { error: ledgerErr } = await admin.from('rate_limit_events').insert(rows);
  expect(ledgerErr).toBeNull();
  // Seed a couple of messages for the same portfolio (to be deleted in the test).
  const { error: msgErr } = await admin.from('messages').insert([
    {
      portfolio_id: ctx.portfolioA,
      sender_name: 'Spammer',
      sender_email: 'spam@example.test',
      body: `${TAG}-1`,
    },
    {
      portfolio_id: ctx.portfolioA,
      sender_name: 'Spammer',
      sender_email: 'spam@example.test',
      body: `${TAG}-2`,
    },
  ]);
  expect(msgErr).toBeNull();
}, 30_000);

afterAll(async () => {
  await admin.from('rate_limit_events').delete().eq('subject', ctx.portfolioA);
  await admin.from('messages').delete().like('body', `${TAG}%`);
  await teardownTwoUsers(ctx);
});

describe('CONT-03 — rate limit counts the LEDGER, never messages (D-06)', () => {
  it('the ledger holds 20 contact events for the portfolio (the 21st is over cap)', async () => {
    const count = await ledgerCount(ctx.portfolioA);
    expect(count).toBe(CONTACT_CAP);
    expect(count).toBeGreaterThanOrEqual(CONTACT_CAP); // the next submit would be the 21st → rejected
  });

  it('DELETING all messages for the portfolio does NOT reduce the ledger count (D-06)', async () => {
    const before = await ledgerCount(ctx.portfolioA);
    // Owner-style spam cleanup: remove every message row for the portfolio.
    const { error } = await admin
      .from('messages')
      .delete()
      .eq('portfolio_id', ctx.portfolioA);
    expect(error).toBeNull();
    // Confirm the messages are gone...
    const { data: remaining } = await admin
      .from('messages')
      .select('id')
      .eq('portfolio_id', ctx.portfolioA);
    expect((remaining ?? []).length).toBe(0);
    // ...yet the LEDGER (hence the cap) is UNCHANGED — the quota did not reopen.
    const after = await ledgerCount(ctx.portfolioA);
    expect(after).toBe(before);
    expect(after).toBe(CONTACT_CAP);
  });

  it('exposes the shared cap helper the route uses to count the ledger (RED until 06-02)', async () => {
    const mod = (await import(/* @vite-ignore */ LEDGER)) as {
      countAndRecord?: unknown;
    };
    // RED now: the ledger helper module does not exist yet.
    expect(typeof mod.countAndRecord).toBe('function');
  });
});
