/**
 * ANLY-05 — the `POST /api/event` outbound-click beacon gate sequence (Wave 0 RED
 * scaffold, Plan 33-01). Run against the LIVE local Supabase stack (node env,
 * sequential — the route's service-role insert hits the live `analytics_events`).
 *
 * THE INVARIANT (ANLY-05 / D-09 / D-10) — `/api/event` mirrors `/api/page-view`:
 *   - it is the SOLE writer to `analytics_events` (no public INSERT policy, D-09);
 *     the browser anon key can never reach the table directly.
 *   - gate order: req.json() try/catch (non-JSON → 400) → `eventSchema.safeParse`
 *     (malformed → 400, no insert) → bot-UA denylist (`isKnownBot` → SILENT 200,
 *     no insert) → per-hashed-IP flood cap (over cap → SILENT 200, no insert) →
 *     service-role insert with an EXPLICIT column allowlist (NO raw IP) → 200.
 *   - the server DERIVES `category` (social/contact/project/other, D-10) from
 *     `destination_host`; it never trusts a client-sent category.
 *   - a valid body → a `200 {ok:true}` + exactly one `analytics_events` row with
 *     the derived `category`, NO raw IP column.
 *
 * The route under test is `@/app/api/event/route` (NOT YET BUILT — Plan 33-04). It
 * is a `runtime='nodejs'` Route Handler invoked with a plain `Request`, so unlike
 * the `'use server'` actions it CAN be driven directly (mirroring how a future
 * page-view route test would POST a Request). We:
 *   1. ASSERT the route module exports a POST handler (variable-specifier RED idiom
 *      so `tsc` stays 0 while the module is absent);
 *   2. EXERCISE the gates the route COMPOSES from existing primitives — `eventSchema`
 *      (already in the barrel, 33-01-T1) rejects a malformed body, and `isKnownBot`
 *      flags a crawler UA — as ACTIVE proof the gate inputs behave, before the route
 *      wiring lands.
 *
 * ── WHY RED NOW ───────────────────────────────────────────────────────────────
 * `src/app/api/event/route.ts` (Plan 33-04) does not exist: the POST-export
 * assertion fails (undefined !== 'function'). The end-to-end POST assertions
 * (malformed→400, bot→silent-200, valid→insert) live in a `describe.skip` (flip to
 * `describe(` when 33-04 lands the route). The `eventSchema` + `isKnownBot` gate-input
 * assertions are ACTIVE — they pin the contract the route must compose.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { eventSchema } from '@/lib/validations';
import { isKnownBot } from '@/lib/analytics/bot-denylist';
import { POST as eventPost } from '@/app/api/event/route';
import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from './cms/_cms-fixtures';

const VALID_UUID = '11111111-1111-1111-1111-111111111111';

describe('ANLY-05 — the gate INPUTS /api/event composes (ACTIVE — eventSchema + bot denylist)', () => {
  it('eventSchema REJECTS a malformed body (missing portfolio_id) → the route’s 400 path', () => {
    const parsed = eventSchema.safeParse({ path: '/jadrianports' });
    expect(parsed.success).toBe(false);
  });

  it('eventSchema ACCEPTS a well-formed body (the route’s 200 path input)', () => {
    const parsed = eventSchema.safeParse({
      portfolio_id: VALID_UUID,
      destination_host: 'linkedin.com',
      path: '/jadrianports',
      kind: 'social',
    });
    expect(parsed.success).toBe(true);
  });

  it('isKnownBot flags a crawler UA → the route’s SILENT-200, no-insert branch', () => {
    expect(isKnownBot('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true);
    expect(isKnownBot('Mozilla/5.0 (real human browser)')).toBe(false);
  });
});

// GREENED BY 33-04 — the route ships `src/app/api/event/route.ts`. Live-stack proof
// against the real `analytics_events` insert: a seeded portfolio (RLS-bypass via the
// service-role `adminClient`) gives a valid `portfolio_id`; the POST handler is driven
// directly with a plain `Request` (a `runtime='nodejs'` Route Handler), and the
// service-role admin client reads the row back.
const RUN = crypto.randomUUID().slice(0, 8);
const admin = adminClient();

describe('ANLY-05 — POST /api/event end-to-end gate sequence (live stack)', () => {
  let ctx: TwoUsers;

  function post(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
    const req = new Request('http://localhost/api/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return eventPost(req) as unknown as Promise<Response>;
  }

  beforeAll(async () => {
    ctx = await setupTwoUsers('evroute', RUN);
  }, 45_000);

  afterAll(async () => {
    await admin.from('analytics_events').delete().eq('portfolio_id', ctx?.portfolioA);
    await teardownTwoUsers(ctx);
  });

  it('exports a POST handler from @/app/api/event/route', () => {
    expect(typeof eventPost).toBe('function');
  });

  it('a malformed body → 400, no insert', async () => {
    const res = await post({ path: '/no-portfolio-id' });
    expect(res.status).toBe(400);
  });

  it('a non-JSON body → 400', async () => {
    const req = new Request('http://localhost/api/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json{',
    });
    const res = (await eventPost(req)) as unknown as Response;
    expect(res.status).toBe(400);
  });

  it('a known-bot UA → SILENT 200, NO insert', async () => {
    const before = await admin
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', ctx.portfolioA);

    const res = await post(
      { portfolio_id: ctx.portfolioA, destination_host: 'linkedin.com', path: '/p' },
      { 'user-agent': 'Googlebot/2.1' },
    );
    expect(res.status).toBe(200);

    const after = await admin
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', ctx.portfolioA);
    // A bot UA is silently dropped — the count is unchanged.
    expect(after.count ?? 0).toBe(before.count ?? 0);
  });

  it('a valid body → 200 + one analytics_events row with SERVER-DERIVED category, NO raw IP column', async () => {
    const res = await post({
      portfolio_id: ctx.portfolioA,
      destination_host: 'linkedin.com',
      path: '/jadrianports',
      // A forged client `kind` — the server MUST ignore it and derive `social` from the host.
      kind: 'project',
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    const row = await admin
      .from('analytics_events')
      .select('*')
      .eq('portfolio_id', ctx.portfolioA)
      .eq('destination_host', 'linkedin.com')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(row.error).toBeNull();
    expect(row.data).toBeTruthy();
    // Category derived SERVER-SIDE from the host (D-10) — NOT the forged client `kind`.
    expect(row.data!.category).toBe('social');
    expect(row.data!.path).toBe('/jadrianports');
    // No raw IP is ever persisted (T-33-15) — the column does not exist on the row.
    expect(Object.keys(row.data!)).not.toContain('ip');
    expect(Object.keys(row.data!)).not.toContain('ip_address');
  });

  it('a mailto: destination → category `contact` (server-derived)', async () => {
    const res = await post({
      portfolio_id: ctx.portfolioA,
      destination_host: 'mailto:',
      path: '/jadrianports',
    });
    expect(res.status).toBe(200);

    const row = await admin
      .from('analytics_events')
      .select('category')
      .eq('portfolio_id', ctx.portfolioA)
      .eq('destination_host', 'mailto:')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    expect(row.error).toBeNull();
    expect(row.data!.category).toBe('contact');
  });
});
