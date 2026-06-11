/**
 * ANLY-01 / ANLY-02 — RED scaffold (Wave 0, Plan 15-01). GREENED BY Plan 15-03
 * (the `/api/page-view` route handler).
 *
 * Encodes the secure contract of the not-yet-existing `POST /api/page-view` route —
 * a service-role mirror of `/api/report` (no public INSERT into `page_views`; the
 * route is the sole writer — ADR-004) with three deliberate differences from the
 * report route (D-04 / D-08):
 *   1. NO Turnstile (a high-volume beacon is not a human-friction write).
 *   2. Over-cap → SILENT 200 with NO insert (a flood is bot noise), NOT a 429.
 *   3. A server-side bot-UA denylist (`isKnownBot`) → silent 200, NO insert.
 * The insert uses an EXPLICIT 6-column allowlist with NO raw-IP column (ANLY-02 /
 * D-09 / Pitfall 6): `{ portfolio_id, path, referrer, country, utm_source,
 * utm_medium }` — `referrer_host` (payload) maps to `referrer` (column).
 *
 * ── WHY SKIPPED (suite stays GREEN this plan) ─────────────────────────────────
 * The route module (`@/app/api/page-view/route`) does NOT exist until Plan 15-03,
 * so these specs cannot pass yet. Per the sequential-executor RED-scaffold contract
 * (a RED suite would block the next plan's gates), the contract is authored inside a
 * `describe.skip(...)` — the assertions are committed and visible, but inert. Plan
 * 15-03 FLIPS `describe.skip` → `describe` (one-line change) to green them. The mock
 * idiom + the runtime variable-specifier `loadPost()` mirror report-route.test.ts so
 * the flip is mechanical.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Capture the service-role insert call so we can assert the EXACT column allowlist.
// Typed to accept the inserted row so `insert.mock.calls[0][0]` is well-typed.
const insert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));

vi.mock('@/lib/supabase/service-role', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'page_views') return { insert };
      // Defensive default — the route should only ever touch `page_views`.
      return { insert };
    }),
  },
}));

// Flood-guard ledger (NO Turnstile mock — page-view drops Turnstile, D-04).
const countAndRecord = vi.fn(async (..._a: unknown[]) => true);
vi.mock('@/lib/rate-limit/ledger', () => ({
  countAndRecord: (...a: unknown[]) => countAndRecord(...a),
}));

// Server-only IP-hash helper — deterministic so the per-sender bucket path is
// testable; the route degrades to "skip the cap" when it resolves null (D-08/D-09).
const hashClientIp = vi.fn(async (..._a: unknown[]): Promise<string | null> => 'deadbeef-hash');
vi.mock('@/lib/trust/ip-hash', () => ({
  hashClientIp: (...a: unknown[]) => hashClientIp(...a),
}));

// Bot-UA denylist — real module exists (15-01 Task 1), but mock it so each case is
// deterministic regardless of the test-runner UA.
const isKnownBot = vi.fn((_ua: string | null) => false);
vi.mock('@/lib/analytics/bot-denylist', () => ({
  isKnownBot: (ua: string | null) => isKnownBot(ua),
}));

// BotID server gate (D-06 / WR-01) — controllable per-case. Default: human. On the
// high-volume beacon the disposition is a SILENT 200 drop (NOT 403/429), and a thrown
// checkBotId degrades OPEN (isBot=false) so a BotID/OIDC outage never fails the beacon.
const checkBotId = vi.fn(async (): Promise<{ isBot: boolean }> => ({ isBot: false }));
vi.mock('botid/server', () => ({
  checkBotId: () => checkBotId(),
}));

// Runtime variable-specifier import (RED-tolerant: ERR_MODULE_NOT_FOUND at runtime,
// NOT a tsc TS2307) — identical to report-route.test.ts's loadPost().
const ROUTE = '@/app/api/page-view/route';
async function loadPost(): Promise<(req: Request) => Promise<Response>> {
  const mod = (await import(/* @vite-ignore */ ROUTE)) as {
    POST: (req: Request) => Promise<Response>;
  };
  return mod.POST;
}

function postReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/page-view', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const validBody = {
  portfolio_id: '00000000-0000-0000-0000-0000000000bb',
  path: '/jadrianports',
  referrer_host: 'www.linkedin.com',
  utm_source: 'newsletter',
  utm_medium: 'email',
};

// The EXACT column allowlist the insert must use (ANLY-02 / D-09 / Pitfall 6) — no
// `ip`, no `referrer_host`, no spread. `referrer_host` payload → `referrer` column.
const ALLOWED_INSERT_KEYS = [
  'portfolio_id',
  'path',
  'referrer',
  'country',
  'utm_source',
  'utm_medium',
] as const;

describe('ANLY-01/02 — POST /api/page-view (GREENED BY 15-03)', () => {
  beforeEach(() => {
    insert.mockClear();
    countAndRecord.mockClear();
    hashClientIp.mockClear();
    isKnownBot.mockClear();
    checkBotId.mockReset();
    countAndRecord.mockResolvedValue(true);
    hashClientIp.mockResolvedValue('deadbeef-hash');
    isKnownBot.mockReturnValue(false);
    checkBotId.mockResolvedValue({ isBot: false });
  });

  it('(a) rejects a malformed body with 400 and does NOT insert', async () => {
    const POST = await loadPost();
    const res = await POST(postReq({ path: '/x' })); // no portfolio_id
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('(b) inserts EXACTLY the 6-column allowlist (no IP key) on a valid body → 200', async () => {
    const POST = await loadPost();
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(1);

    const arg = insert.mock.calls[0]![0] as Record<string, unknown>;
    // Exactly the 6 allowlisted columns — no more, no fewer.
    expect(Object.keys(arg).sort()).toEqual([...ALLOWED_INSERT_KEYS].sort());
    // Privacy invariant: NO raw-IP / referrer_host key ever reaches the insert.
    expect(arg).not.toHaveProperty('ip');
    expect(arg).not.toHaveProperty('referrer_host');
    // referrer_host (payload) → referrer (column).
    expect(arg.referrer).toBe('www.linkedin.com');
    expect(arg.portfolio_id).toBe(validBody.portfolio_id);
    expect(arg.path).toBe(validBody.path);
    expect(arg.utm_source).toBe('newsletter');
    expect(arg.utm_medium).toBe('email');
  });

  it('(c) over-cap → silent 200 with NO insert (D-08, NOT a 429)', async () => {
    const POST = await loadPost();
    countAndRecord.mockResolvedValue(false); // over the flood cap
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(200); // silent drop, NOT 429 (Pitfall 4)
    expect(insert).not.toHaveBeenCalled();
  });

  it('(d) bot-UA in the denylist → silent 200 with NO insert (D-07)', async () => {
    const POST = await loadPost();
    isKnownBot.mockReturnValue(true);
    const res = await POST(postReq(validBody, { 'user-agent': 'Slackbot-LinkExpanding 1.0' }));
    expect(res.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
  });

  it('(e) hashClientIp null → per-sender cap SKIPPED (degrade), insert still proceeds', async () => {
    const POST = await loadPost();
    hashClientIp.mockResolvedValue(null); // no IP / secret unset → degrade (D-08/D-09)
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(200);
    expect(countAndRecord).not.toHaveBeenCalled(); // cap skipped when no subject
    expect(insert).toHaveBeenCalledTimes(1); // the view is still recorded
  });

  it('(f) no x-vercel-ip-country header → insert with country: null, no throw', async () => {
    const POST = await loadPost();
    const res = await POST(postReq(validBody)); // local dev: header absent (Pitfall 3)
    expect(res.status).toBe(200);
    const arg = insert.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.country).toBeNull();
  });

  it('(f2) x-vercel-ip-country present → that ISO code is stored', async () => {
    const POST = await loadPost();
    await POST(postReq(validBody, { 'x-vercel-ip-country': 'US' }));
    const arg = insert.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.country).toBe('US');
  });

  // WR-01 (Phase-16 code-review fix, a80ebde) — the BotID silent-drop on the beacon.
  // Unlike contact/report (generic 403), page-view keeps its dropped-beacon posture:
  //   - isBot -> a SILENT 200 { ok:true } with NO insert (never a 403/429 cap-oracle).
  //   - a thrown checkBotId degrades OPEN (isBot=false) so a BotID/OIDC outage never
  //     500s the high-volume beacon — the view is still recorded.
  describe('WR-01 — BotID silent-drop / degrade-open (D-06)', () => {
    it('isBot → silent 200 { ok:true } with NO insert (beacon posture, NOT 403/429)', async () => {
      const POST = await loadPost();
      checkBotId.mockResolvedValue({ isBot: true });
      const res = await POST(postReq(validBody));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(insert).not.toHaveBeenCalled();
    });

    it('WR-01: a thrown checkBotId degrades OPEN — the view is still recorded, never a 500', async () => {
      const POST = await loadPost();
      checkBotId.mockRejectedValue(new Error('VERCEL_OIDC_TOKEN is not set'));
      const res = await POST(postReq(validBody));
      expect(res.status).toBe(200);
      expect(insert).toHaveBeenCalledTimes(1);
    });
  });
});
