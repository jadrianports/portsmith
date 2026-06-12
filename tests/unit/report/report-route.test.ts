/**
 * SAFE-03 — RED scaffold (Wave 0, Plan 06-01). GREENED BY 06-06-T1/T2.
 *
 * Encodes the secure contract of the not-yet-existing `POST /api/report` route —
 * a service-role mirror of `/api/contact` (no public INSERT into `reports`; the
 * route is the sole writer — D-16). It re-parses the NEW `reportSchema` at the
 * boundary, verifies Turnstile fail-closed, applies a two-bucket ledger
 * (per-page `subject=portfolio_id` + per-sender `subject=HMAC(ip)` — D-07), then
 * inserts into `reports`. The `reason` is constrained to the table's CHECK enum
 * MINUS `auto_flagged` (reserved for an automated signal — D-17), so a user-
 * submitted `auto_flagged` (or any value outside the enum) is rejected at the
 * Zod boundary.
 *
 * RED via the [05-01] runtime variable-specifier import (no TS2307; genuinely
 * ERR_MODULE_NOT_FOUND at runtime). Mock idiom mirrors save-section.test.ts.
 *
 * reports.reason CHECK enum (migration 001:235):
 *   'auto_flagged','hate_speech','illegal_content','spam','harassment','other'.
 * User-selectable subset (D-17, auto_flagged EXCLUDED):
 *   'hate_speech','illegal_content','spam','harassment','other'.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const insert = vi.fn(async () => ({ error: null }));
const ledgerCount = vi.fn(async () => ({ count: 0, error: null }));

vi.mock('@/lib/supabase/service-role', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'rate_limit_events') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({ gte: vi.fn(() => ledgerCount()) })),
            })),
          })),
          insert,
        };
      }
      if (table === 'reports') return { insert };
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { id: 'p-1', published: true, locked: false },
              error: null,
            })),
          })),
        })),
      };
    }),
  },
}));

const verifyTurnstile = vi.fn(async (..._a: unknown[]) => true);
vi.mock('@/lib/auth/turnstile', () => ({
  verifyTurnstile: (...a: unknown[]) => verifyTurnstile(...a),
}));

const countAndRecord = vi.fn(async (..._a: unknown[]) => true);
vi.mock('@/lib/rate-limit/ledger', () => ({
  countAndRecord: (...a: unknown[]) => countAndRecord(...a),
}));

// Server-only IP-hash helper (also not-yet-existing) — mock it so the per-sender
// bucket path is deterministic; the route degrades to "skip per-sender" on null.
const hashClientIp = vi.fn(async (..._a: unknown[]): Promise<string | null> => 'deadbeef-hash');
vi.mock('@/lib/trust/ip-hash', () => ({
  hashClientIp: (...a: unknown[]) => hashClientIp(...a),
}));

// BotID server gate (D-06 / WR-01 / WR-03) — controllable per-case. Default: human.
// Gate order: Zod -> checkBotId (after Zod) -> Turnstile -> two-bucket ledger -> insert;
// a thrown checkBotId degrades OPEN (isBot=false, WR-01).
const checkBotId = vi.fn(async (): Promise<{ isBot: boolean }> => ({ isBot: false }));
vi.mock('botid/server', () => ({
  checkBotId: () => checkBotId(),
}));

const ROUTE = '@/app/api/report/route';
async function loadPost(): Promise<(req: Request) => Promise<Response>> {
  const mod = (await import(/* @vite-ignore */ ROUTE)) as {
    POST: (req: Request) => Promise<Response>;
  };
  return mod.POST;
}

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  portfolio_id: '00000000-0000-0000-0000-0000000000bb',
  reason: 'spam',
  details: 'This page is spam.',
  turnstile_token: 'tok-valid',
};

describe('SAFE-03 — POST /api/report (service-role mirror of /api/contact)', () => {
  beforeEach(() => {
    insert.mockClear();
    verifyTurnstile.mockClear();
    countAndRecord.mockClear();
    hashClientIp.mockReset();
    checkBotId.mockReset();
    verifyTurnstile.mockResolvedValue(true);
    countAndRecord.mockResolvedValue(true);
    hashClientIp.mockResolvedValue('deadbeef-hash');
    checkBotId.mockResolvedValue({ isBot: false });
  });

  it('rejects a bad reportSchema payload with 400', async () => {
    const POST = await loadPost();
    const res = await POST(postReq({ reason: 'spam' })); // no portfolio_id / token
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects a reason OUTSIDE the CHECK enum (e.g. "bogus") with 400', async () => {
    const POST = await loadPost();
    const res = await POST(postReq({ ...validBody, reason: 'bogus' }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects the reserved "auto_flagged" reason (not user-selectable — D-17) with 400', async () => {
    const POST = await loadPost();
    const res = await POST(postReq({ ...validBody, reason: 'auto_flagged' }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('fails CLOSED with 400 when Turnstile resolves false', async () => {
    const POST = await loadPost();
    verifyTurnstile.mockResolvedValue(false);
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts into reports on a valid + verified payload and returns 200', async () => {
    const POST = await loadPost();
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalled();
  });

  // WR-01 / WR-03 (Phase-16 code-review fixes, ae0a3ef) — the layered BotID gate,
  // mirroring /api/contact. Guards the post-review behavior that shipped with no test:
  //   - isBot -> a GENERIC 403 { error: 'unavailable' } (no detail leak, T-16-13).
  //   - a thrown checkBotId degrades OPEN, never a 500 (WR-01).
  //   - the gate runs AFTER Zod, so a malformed body is a 400 and never spends a BotID call.
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
      expect(res.status).toBe(200);
      expect(insert).toHaveBeenCalled();
    });

    it('WR-03: a malformed body is a 400 BEFORE checkBotId is ever called (Zod-first)', async () => {
      const POST = await loadPost();
      const res = await POST(postReq({ reason: 'spam' })); // fails reportSchema
      expect(res.status).toBe(400);
      expect(checkBotId).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
    });
  });

  // WR-02 (Phase-16 review) — a per-hashed-IP throttle (`report_ip`) spent BEFORE the
  // billed Turnstile siteverify, distinct from the post-Turnstile `report_sender` write
  // cap. Bounds a single-IP replay flood before the outbound siteverify cost; skipped on
  // a null IP subject (degrade).
  describe('WR-02 — per-IP throttle before Turnstile (report_ip)', () => {
    it('over the per-IP cap → GENERIC 429 BEFORE Turnstile is verified (no insert)', async () => {
      const POST = await loadPost();
      // Only the pre-Turnstile `report_ip` bucket is over cap; subject is the default hash.
      countAndRecord.mockImplementation(async (bucket: unknown) => bucket !== 'report_ip');
      const res = await POST(postReq(validBody));
      expect(res.status).toBe(429);
      expect(verifyTurnstile).not.toHaveBeenCalled(); // billed siteverify never spent
      expect(insert).not.toHaveBeenCalled();
    });

    it('null IP subject → pre-gate SKIPPED (degrade); the write still proceeds', async () => {
      const POST = await loadPost();
      hashClientIp.mockResolvedValue(null);
      const res = await POST(postReq(validBody));
      expect(res.status).toBe(200);
      expect(countAndRecord).not.toHaveBeenCalledWith(
        'report_ip',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      expect(insert).toHaveBeenCalled();
    });
  });
});
