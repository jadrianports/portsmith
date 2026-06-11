/**
 * CONT-01 — RED scaffold (Wave 0, Plan 06-01). GREENED BY 06-02-T2.
 *
 * Encodes the secure contract of the not-yet-existing `POST /api/contact`
 * service-role route (the sole writer to `messages` — ADR-004 / D-02). The route
 * re-parses `contactFormSchema` at the boundary, verifies Turnstile fail-closed,
 * counts the rate-limit ledger (NOT messages — D-06), guards the target portfolio
 * is published & not locked, then inserts via `supabaseAdmin`. Visitor-facing
 * outcomes are generic (D-04); a 429 never leaks rate-limit specifics.
 *
 * ── WHY THIS IS RED NOW (and survives `tsc --noEmit`) ─────────────────────────
 * The route module `@/app/api/contact/route` does not exist yet. A STATIC import
 * would TS2307 under the tsconfig `.ts` include and break `npx tsc --noEmit`.
 * Per STATE decision [05-01], we import the module at RUNTIME through a VARIABLE
 * specifier with a vite-ignore hint, so `moduleResolution: bundler` skips
 * compile-time resolution — `tsc` stays 0, while at runtime the import throws
 * `ERR_MODULE_NOT_FOUND` and every case is genuinely RED until the slice lands.
 *
 * The mock idiom mirrors `tests/unit/cms/save-section.test.ts`: stub `server-only`,
 * mock the service-role client + Turnstile + the ledger so identity/verify/write
 * are deterministic spies, then load the route AFTER the mocks. Once the route
 * exists, the bad-payload (400) and Turnstile-fail-closed (400) cases pass with
 * NO real I/O; the happy-path insert is asserted against the mocked admin client.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Service-role admin client: a chainable stub. `.insert(...)` resolves no-error;
// the pre-insert portfolio guard read returns a published, non-locked row; the
// ledger count read returns 0 (under cap). None of this touches a real DB.
const insert = vi.fn(async () => ({ error: null }));
const ledgerCount = vi.fn(async () => ({ count: 0, error: null }));
const guardRow = { id: 'p-1', published: true, locked: false };

vi.mock('@/lib/supabase/service-role', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'rate_limit_events') {
        return {
          // count+head select for the ledger window read
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({ gte: vi.fn(() => ledgerCount()) })),
            })),
          })),
          insert,
        };
      }
      if (table === 'messages') return { insert };
      // public_profiles / portfolios guard read
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: guardRow, error: null })),
          })),
        })),
      };
    }),
  },
}));

// Turnstile verifier — overridable per-case. Default: passes.
const verifyTurnstile = vi.fn(async (..._a: unknown[]) => true);
vi.mock('@/lib/auth/turnstile', () => ({
  verifyTurnstile: (...a: unknown[]) => verifyTurnstile(...a),
}));

// The rate-limit ledger helper (also not-yet-existing) — mock so the route's
// guard is a deterministic spy independent of the real implementation.
const countAndRecord = vi.fn(async (..._a: unknown[]) => true);
vi.mock('@/lib/rate-limit/ledger', () => ({
  countAndRecord: (...a: unknown[]) => countAndRecord(...a),
}));

// BotID server gate (D-06 / WR-01 / WR-03) — controllable per-case. Default: human.
// The route gate order is Zod -> checkBotId (after Zod, WR-03) -> Turnstile -> guard ->
// ledger -> insert, and a thrown checkBotId degrades OPEN (isBot=false, WR-01).
const checkBotId = vi.fn(async (): Promise<{ isBot: boolean }> => ({ isBot: false }));
vi.mock('botid/server', () => ({
  checkBotId: () => checkBotId(),
}));

// The not-yet-existing route module — RUNTIME import through a variable specifier
// so `tsc` does not resolve it (no TS2307) but the suite is genuinely RED.
const ROUTE = '@/app/api/contact/route';
async function loadPost(): Promise<
  (req: Request) => Promise<Response>
> {
  const mod = (await import(/* @vite-ignore */ ROUTE)) as {
    POST: (req: Request) => Promise<Response>;
  };
  return mod.POST;
}

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  portfolio_id: '00000000-0000-0000-0000-0000000000aa',
  sender_name: 'Visitor',
  sender_email: 'visitor@example.com',
  subject: 'Hello',
  body: 'I would like to work with you.',
  turnstile_token: 'tok-valid',
};

describe('CONT-01 — POST /api/contact (service-role sole writer)', () => {
  beforeEach(() => {
    insert.mockClear();
    verifyTurnstile.mockClear();
    countAndRecord.mockClear();
    checkBotId.mockReset();
    verifyTurnstile.mockResolvedValue(true);
    countAndRecord.mockResolvedValue(true);
    checkBotId.mockResolvedValue({ isBot: false });
  });

  it('rejects a bad Zod payload with 400 (server re-parse gate, D-02)', async () => {
    const POST = await loadPost();
    // Missing required fields (no portfolio_id / body) → contactFormSchema fails.
    const res = await POST(postReq({ sender_name: 'x' }));
    expect(res.status).toBe(400);
    // The bad payload never reached the privileged insert.
    expect(insert).not.toHaveBeenCalled();
  });

  it('fails CLOSED with 400 when Turnstile verification resolves false', async () => {
    const POST = await loadPost();
    verifyTurnstile.mockResolvedValue(false);
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(400);
    // Turnstile is verified BEFORE the insert; a failed verify blocks the write.
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts into messages on a valid + verified payload and returns 200', async () => {
    const POST = await loadPost();
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalled();
  });

  it('returns a GENERIC 429 when the rate-limit ledger is over cap (no specifics leaked, D-04)', async () => {
    const POST = await loadPost();
    countAndRecord.mockResolvedValue(false); // ledger over cap
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(429);
    // No message was written when rate-limited, and the body must not leak limits.
    expect(insert).not.toHaveBeenCalled();
    const text = await res.text();
    expect(text).not.toMatch(/\b20\b|per hour|limit|wait/i);
  });

  // WR-01 / WR-03 (Phase-16 code-review fixes) — the layered BotID gate. These guard
  // the post-review behavior that shipped in ae0a3ef with no regression test:
  //   - isBot -> a GENERIC 403 { error: 'unavailable' } (same body as the public-target
  //     guard — never a "bot detected" oracle, T-16-13).
  //   - a thrown checkBotId (BotID/OIDC outage) degrades OPEN, never a 500 (WR-01).
  //   - the gate runs AFTER the cheap Zod parse, so a malformed body is a 400 for bot
  //     and human alike and never spends a (billed) BotID call (WR-03).
  describe('WR-01/WR-03 — layered BotID gate (D-06)', () => {
    it('isBot returns a GENERIC 403 { error: "unavailable" } and never inserts', async () => {
      const POST = await loadPost();
      checkBotId.mockResolvedValue({ isBot: true });
      const res = await POST(postReq(validBody));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'unavailable' });
      expect(insert).not.toHaveBeenCalled();
    });

    it('WR-01: a thrown checkBotId degrades OPEN (isBot=false) — the write proceeds, never a 500', async () => {
      const POST = await loadPost();
      checkBotId.mockRejectedValue(new Error('VERCEL_OIDC_TOKEN is not set'));
      const res = await POST(postReq(validBody));
      expect(res.status).toBe(200); // the outage did not throw/500 the route
      expect(insert).toHaveBeenCalled();
    });

    it('WR-03: a malformed body is a 400 BEFORE checkBotId is ever called (Zod-first)', async () => {
      const POST = await loadPost();
      const res = await POST(postReq({ sender_name: 'x' })); // fails contactFormSchema
      expect(res.status).toBe(400);
      expect(checkBotId).not.toHaveBeenCalled(); // no billed bot call on garbage
      expect(insert).not.toHaveBeenCalled();
    });
  });
});
