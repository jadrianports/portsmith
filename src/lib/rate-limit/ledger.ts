import 'server-only';

/**
 * Rate-limit ledger (CONT-03 / SAFE-03 cross-cutting) — the count-then-insert cap
 * primitive over the dedicated `rate_limit_events` table.
 *
 * `import 'server-only'` (FIRST line) keeps this off any client bundle — it imports
 * the service-role admin client (`supabaseAdmin`), and `rate_limit_events` has a
 * deny-all client RLS policy (no anon/auth INSERT or SELECT — 004:284-288), so ALL
 * reads/writes happen with the service-role key inside a server route.
 *
 * ── THE LOAD-BEARING D-06 INVARIANT (the one place docs/04 is superseded) ─────────
 * The cap counts the `rate_limit_events` LEDGER, NEVER `messages` rows. An owner
 * deleting inbox spam must not reopen a spammer's quota (Pitfall 2). The count
 * filters `created_at >= now() - windowMs`, so rows outside the window age out of the
 * cap on their own (only the table size grows; correctness is window-bounded).
 *
 * `countAndRecord(bucket, subject, windowMs, cap)`:
 *   - counts the (bucket, subject) events inside the window;
 *   - if `>= cap` → returns `false` (denied) WITHOUT inserting (the caller maps this
 *     to a generic 429 — D-04, never leaking the cap);
 *   - otherwise inserts a fresh ledger event and returns `true` (allowed).
 *
 * Fail-open on a transient COUNT error (documented DEFAULT): the cap is a speed-bump,
 * not the primary bot gate (Turnstile is). A DB blip on the count read must not block
 * a legitimate visitor's contact submit — so a count error returns `true`. (Turnstile
 * + the no-public-INSERT boundary remain in force regardless.)
 *
 * PER-BUCKET FAIL-CLOSED (D-06, Phase 30): for a PRODUCT-LIMIT bucket (e.g.
 * `'username_change'`, cap 1 / 30 days) fail-open is wrong — a DB blip must not let a
 * 2nd change slip through. Pass `{ failClosed: true }` to flip the count-error branch to
 * DENY for that one call. The flag is OPTIONAL and defaults to `false`, so the existing
 * contact/report callers are byte-for-byte unchanged (fail-open).
 */
import { supabaseAdmin } from '@/lib/supabase/service-role';

/**
 * Count the `(bucket, subject)` events in the last `windowMs` and, if under `cap`,
 * record a new event. Returns `true` when the submit is allowed (and recorded),
 * `false` when it is over cap (and NOT recorded).
 *
 * @param bucket   the rate-limit bucket, e.g. `'contact'` (D-06) or `'report_page'`/`'report_sender'` (D-07).
 * @param subject  the rate-limit subject, e.g. the `portfolio_id` or a hashed-IP digest.
 * @param windowMs the rolling window in milliseconds (contact: 3_600_000 = 1h).
 * @param cap      the maximum allowed events in the window (contact: 20).
 * @param options  `{ failClosed }` — when `true`, a transient COUNT error returns `false`
 *                 (DENY) instead of the default `true` (fail-open). Use for product-limit
 *                 buckets like `username_change`; omit for spam speed-bumps (contact/report).
 */
export async function countAndRecord(
  bucket: string,
  subject: string,
  windowMs: number,
  cap: number,
  options?: { failClosed?: boolean },
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();

  const { count, error: countError } = await supabaseAdmin
    .from('rate_limit_events')
    .select('*', { count: 'exact', head: true })
    .eq('bucket', bucket)
    .eq('subject', subject)
    .gte('created_at', since);

  // Count-error posture: fail-OPEN by default (the cap is a speed-bump), but fail-CLOSED
  // (deny) when the caller opts in for a product-limit bucket (D-06 username_change).
  if (countError) return !options?.failClosed;

  if ((count ?? 0) >= cap) return false;

  await supabaseAdmin.from('rate_limit_events').insert({ bucket, subject });
  return true;
}
