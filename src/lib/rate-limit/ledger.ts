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
 * Fail-open on a transient COUNT error (documented choice): the cap is a speed-bump,
 * not the primary bot gate (Turnstile is). A DB blip on the count read must not block
 * a legitimate visitor's contact submit — so a count error returns `true`. (Turnstile
 * + the no-public-INSERT boundary remain in force regardless.)
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
 */
export async function countAndRecord(
  bucket: string,
  subject: string,
  windowMs: number,
  cap: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();

  const { count, error: countError } = await supabaseAdmin
    .from('rate_limit_events')
    .select('*', { count: 'exact', head: true })
    .eq('bucket', bucket)
    .eq('subject', subject)
    .gte('created_at', since);

  // Fail-open on a transient count error — the cap is a speed-bump, not the gate.
  if (countError) return true;

  if ((count ?? 0) >= cap) return false;

  await supabaseAdmin.from('rate_limit_events').insert({ bucket, subject });
  return true;
}
