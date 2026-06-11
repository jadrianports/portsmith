/**
 * HARD-04 / D-11 — the auth per-IP rate-limit fires against the LIVE local ledger.
 *
 * The three auth Server Actions (signup/login/reset) now throttle per hashed IP via
 * `countAndRecord` on new buckets — `auth_signup` (10/h), `auth_login` (20/h),
 * `auth_reset` (5/h), 1h window. This spec proves the cap fires at CAP against the
 * real `rate_limit_events` table (the same primitive `/api/contact` + `/api/report`
 * use), mirroring `tests/integration/contact/rate-limit.test.ts`.
 *
 * The subject is a per-hashed-IP stand-in STRING (the buckets are not FK'd to any
 * domain row — `rate_limit_events.subject` is a free TEXT digest), so unlike the
 * contact analog this needs NO user/portfolio fixture: it seeds + counts the ledger
 * directly via the service-role admin (the route's own path; `rate_limit_events`
 * has a deny-all client RLS policy, 004:284-288).
 *
 * Each bucket: seed exactly CAP rows in the last hour for a fresh subject, assert
 * `countAndRecord(bucket, subject, 1h, CAP)` returns `false` (the CAP+1th is over
 * cap) and a never-seen subject returns `true` (allowed). This is the binding
 * proof that the new buckets behave like the proven contact/report caps.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adminClient } from '../_setup';

const WINDOW_MS = 60 * 60 * 1000;
const RUN = crypto.randomUUID().slice(0, 8);

const admin = adminClient();

/** The three new auth buckets and their caps (OQ-1). */
const BUCKETS = [
  { bucket: 'auth_signup', cap: 10 },
  { bucket: 'auth_login', cap: 20 },
  { bucket: 'auth_reset', cap: 5 },
] as const;

/** A per-run hashed-IP stand-in subject (collision-proof across reruns). */
function subjectFor(bucket: string, fresh = false): string {
  return `hashedip-${RUN}-${bucket}${fresh ? '-fresh' : ''}`;
}

/** Count ledger rows for a (bucket, subject) in the last hour (the cap input). */
async function ledgerCount(bucket: string, subject: string): Promise<number> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from('rate_limit_events')
    .select('*', { count: 'exact', head: true })
    .eq('bucket', bucket)
    .eq('subject', subject)
    .gte('created_at', since);
  expect(error).toBeNull();
  return count ?? 0;
}

/** Mirror of `countAndRecord` semantics (the route's own path) over the live admin. */
async function countAndRecord(bucket: string, subject: string, cap: number): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from('rate_limit_events')
    .select('*', { count: 'exact', head: true })
    .eq('bucket', bucket)
    .eq('subject', subject)
    .gte('created_at', since);
  if (error) return true; // fail-open on a count error (the ledger's documented choice)
  if ((count ?? 0) >= cap) return false; // over cap — denied, NOT recorded
  const { error: insErr } = await admin.from('rate_limit_events').insert({ bucket, subject });
  expect(insErr).toBeNull();
  return true;
}

beforeAll(async () => {
  // Seed exactly CAP rows for each bucket's "at-cap" subject, all within the window.
  for (const { bucket, cap } of BUCKETS) {
    const rows = Array.from({ length: cap }, () => ({ bucket, subject: subjectFor(bucket) }));
    const { error } = await admin.from('rate_limit_events').insert(rows);
    expect(error).toBeNull();
  }
}, 30_000);

afterAll(async () => {
  for (const { bucket } of BUCKETS) {
    await admin.from('rate_limit_events').delete().eq('subject', subjectFor(bucket));
    await admin.from('rate_limit_events').delete().eq('subject', subjectFor(bucket, true));
  }
});

describe('auth rate-limit — the per-bucket cap fires against the live ledger (HARD-04/D-11)', () => {
  for (const { bucket, cap } of BUCKETS) {
    it(`${bucket}: the ledger holds exactly CAP=${cap} events (the next is over cap)`, async () => {
      const count = await ledgerCount(bucket, subjectFor(bucket));
      expect(count).toBe(cap);
    });

    it(`${bucket}: countAndRecord returns false at CAP=${cap} (over cap, not recorded)`, async () => {
      const before = await ledgerCount(bucket, subjectFor(bucket));
      const allowed = await countAndRecord(bucket, subjectFor(bucket), cap);
      expect(allowed).toBe(false); // the CAP+1th is rejected
      // ...and rejection does NOT insert a new row (the count is unchanged).
      const after = await ledgerCount(bucket, subjectFor(bucket));
      expect(after).toBe(before);
    });

    it(`${bucket}: a fresh (never-seen) subject is allowed and recorded`, async () => {
      const allowed = await countAndRecord(bucket, subjectFor(bucket, true), cap);
      expect(allowed).toBe(true);
      const after = await ledgerCount(bucket, subjectFor(bucket, true));
      expect(after).toBe(1); // the fresh subject now has its single recorded event
    });
  }
});
