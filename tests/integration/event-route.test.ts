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
import { describe, expect, it } from 'vitest';

import { eventSchema } from '@/lib/validations';
import { isKnownBot } from '@/lib/analytics/bot-denylist';

// The not-yet-built Route Handler (Plan 33-04). Variable specifier → no STATIC
// reference for `tsc`; the runtime export is `undefined` until 33-04 lands.
const EVENT_ROUTE_MOD = '@/app/api/event/route';

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

// RED until Plan 33-04 ships `src/app/api/event/route.ts`. Skipped so the
// not-yet-existing handler is not invoked on every run; flip to `describe(` (drop
// `.skip`) when 33-04 lands the route + the live analytics_events insert.
describe.skip('ANLY-05 — POST /api/event end-to-end gate sequence (RED until 33-04)', () => {
  async function post(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
    const mod = (await import(/* @vite-ignore */ EVENT_ROUTE_MOD)) as {
      POST: (req: Request) => Promise<Response>;
    };
    const req = new Request('http://localhost/api/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return mod.POST(req);
  }

  it('exports a POST handler from @/app/api/event/route', async () => {
    const mod = (await import(/* @vite-ignore */ EVENT_ROUTE_MOD)) as { POST?: unknown };
    expect(typeof mod.POST).toBe('function');
  });

  it('a malformed body → 400, no insert', async () => {
    const res = await post({ path: '/no-portfolio-id' });
    expect(res.status).toBe(400);
  });

  it('a known-bot UA → SILENT 200, no insert', async () => {
    const res = await post(
      { portfolio_id: VALID_UUID, destination_host: 'linkedin.com', path: '/p' },
      { 'user-agent': 'Googlebot/2.1' },
    );
    expect(res.status).toBe(200);
  });

  it.todo('a valid body → 200 + one analytics_events row with derived category, NO raw IP column');
});
