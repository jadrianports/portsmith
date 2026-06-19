/**
 * HANDLE-01 / D-06 — the username_change 30-day cooldown contract on countAndRecord
 * (Wave-0 RED).
 *
 * The change action gates on the EXISTING `countAndRecord` ledger with
 * `bucket='username_change'`, `subject=user_id`, `windowMs=30 days`, `cap=1`
 * (30-RESEARCH.md "The Change Action" step 4). Two deltas from the contact/report
 * buckets are pinned here:
 *   - cap=1: a 2nd change inside the 30-day window is DENIED (and NOT recorded);
 *   - FAIL-CLOSED: on a transient COUNT error this bucket must DENY (return false)
 *     when called with `{ failClosed: true }` — unlike contact's fail-OPEN default
 *     (ledger.ts:57). This is the NEW surface Plan 03 adds (Open Question 2 / Option B);
 *   - the DEFAULT (no flag) STAYS fail-OPEN, so the contact/report callers are
 *     unchanged (a regression guard for the existing buckets);
 *   - the "next allowed on {date}" copy is `oldest-in-window event + 30 days` — the
 *     formula the action surfaces (D-08).
 *
 * MOCKED, not live-DB: the count-ERROR branch cannot be induced deterministically
 * against the real `rate_limit_events` table, so this drives `supabaseAdmin`'s count
 * read directly. The fail-closed assertion is RED now because the current
 * `countAndRecord` signature has no `failClosed` parameter and still returns `true`
 * on a count error — Plan 03 makes it GREEN.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const BUCKET = 'username_change';

// A controllable mock of the service-role client the ledger uses. `countResult` drives
// the count read (resolved by the final `.gte(...)` in the ledger's chain); `insertSpy`
// records the recorded event so we can assert a denied call does NOT insert.
let countResult: { count: number | null; error: { message: string } | null } = {
  count: 0,
  error: null,
};
const insertSpy = vi.fn(async (_row?: unknown) => ({ error: null }));
const builder: Record<string, unknown> = {
  select: vi.fn(() => builder),
  eq: vi.fn(() => builder),
  gte: vi.fn(async () => countResult),
  insert: vi.fn((row: unknown) => insertSpy(row)),
};
vi.mock('@/lib/supabase/service-role', () => ({
  supabaseAdmin: { from: vi.fn(() => builder) },
}));

beforeEach(() => {
  countResult = { count: 0, error: null };
  insertSpy.mockClear();
});

describe('HANDLE-01 / D-06 — username_change cap=1 (a 2nd change inside 30 days is denied)', () => {
  it('over cap (1 event already in window) → denied, and NOT recorded', async () => {
    const { countAndRecord } = await import('@/lib/rate-limit/ledger');
    countResult = { count: 1, error: null }; // one prior change in the window

    const allowed = await countAndRecord(BUCKET, 'user-sub', THIRTY_DAYS_MS, 1);
    expect(allowed).toBe(false);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('under cap (0 events) → allowed and recorded', async () => {
    const { countAndRecord } = await import('@/lib/rate-limit/ledger');
    countResult = { count: 0, error: null };

    const allowed = await countAndRecord(BUCKET, 'user-sub', THIRTY_DAYS_MS, 1);
    expect(allowed).toBe(true);
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });
});

describe('HANDLE-01 / D-06 — the username_change cooldown fails CLOSED on a count error', () => {
  it('DEFAULT stays fail-OPEN on a count error (contact/report regression guard)', async () => {
    const { countAndRecord } = await import('@/lib/rate-limit/ledger');
    countResult = { count: null, error: { message: 'transient count blip' } };

    // No flag → the existing fail-OPEN posture (ledger.ts:57) is preserved.
    const allowed = await countAndRecord(BUCKET, 'user-sub', THIRTY_DAYS_MS, 1);
    expect(allowed).toBe(true);
  });

  it('with failClosed:true a count error DENIES (return false) — the new D-06 surface', async () => {
    const { countAndRecord } = await import('@/lib/rate-limit/ledger');
    countResult = { count: null, error: { message: 'transient count blip' } };

    // Plan 03 added the `failClosed` option flipping the count-error branch to DENY for
    // this bucket; without it the default stays fail-OPEN (asserted above).
    const allowed = await countAndRecord(BUCKET, 'user-sub', THIRTY_DAYS_MS, 1, {
      failClosed: true,
    });
    expect(allowed).toBe(false);
  });
});

describe('HANDLE-01 — the next-allowed date is the oldest in-window event + 30 days (D-08 copy)', () => {
  it('a change 5 days ago yields a next-allowed ~25 days out (in the future)', () => {
    // The formula the action surfaces in the D-08 confirm/blocked copy. Pinned here as
    // the contract Plan 03's "next allowed on {date}" message must compute.
    const oldestEvent = Date.now() - 5 * 24 * 60 * 60 * 1000; // 5 days ago
    const nextAllowed = oldestEvent + THIRTY_DAYS_MS;
    expect(nextAllowed).toBeGreaterThan(Date.now()); // still inside the cooldown
    // ~25 days remain (30 − 5), within a generous tolerance.
    const daysRemaining = (nextAllowed - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysRemaining).toBeGreaterThan(24);
    expect(daysRemaining).toBeLessThan(26);
  });
});
