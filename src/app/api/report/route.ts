/**
 * `POST /api/report` — the SOLE, authoritative writer to `reports` (SAFE-03 / D-16).
 * A service-role mirror of `/api/contact`: `reports` has NO public INSERT policy
 * (admin-only RLS — 004), so the anon key in the browser can never reach PostgREST
 * directly; this server-only route holds the service-role key and is the single
 * place an anonymous report is written.
 *
 * The gate sequence (each failure returns a typed JSON body — never a stack, never
 * the rate-limit policy):
 *   1. Zod re-parse of `reportSchema` at the boundary (the client parse is UX only —
 *      the server parse is the real gate, D-02). A bad body, a reason OUTSIDE the
 *      reports CHECK enum, or the reserved `auto_flagged` value (D-17) → 400.
 *   2. Turnstile siteverify — fail-CLOSED (`verifyTurnstile` returns true ONLY on
 *      `{success:true}`). A failed/spent token → 400; no insert.
 *   3. Two-bucket rate-limit via the SHARED `rate_limit_events` LEDGER (the 06-02
 *      slice-refinement — report REUSES the contact ledger, count THEN insert, D-06):
 *        • `report_page`   — subject = `portfolio_id` (a per-page modest cap).
 *        • `report_sender` — subject = `hashClientIp(req)` (a low per-sender cap; the
 *          raw IP is HMAC'd, never stored — D-07/R-5). SKIPPED when `hashClientIp`
 *          returns null (no IP or no `REPORT_IP_HASH_SECRET` — degrade; Turnstile +
 *          the per-page cap remain).
 *      Over EITHER cap → a GENERIC 429 (D-04 — never leak the cap, a wait time, or
 *      which bucket tripped).
 *   4. Insert into `reports` via `supabaseAdmin` (RLS bypassed) — columns
 *      `{ portfolio_id, reason, details }` only; `reviewed` defaults false,
 *      `reviewed_at`/`reviewed_by` stay null. `turnstile_token` is verified, NEVER
 *      stored. A DB error → a generic 500.
 *   5. 200 `{ok:true}` — a generic success (D-04).
 *
 * Mirrors the proven `/api/contact` skeleton: `runtime='nodejs'` (the service-role
 * client AND `node:crypto` for the IP hash both require Node, never edge) + typed
 * JSON errors only.
 */
import { checkBotId } from 'botid/server';
import { NextResponse } from 'next/server';

import { verifyTurnstile } from '@/lib/auth/turnstile';
import { countAndRecord } from '@/lib/rate-limit/ledger';
import { supabaseAdmin } from '@/lib/supabase/service-role';
import { hashClientIp } from '@/lib/trust/ip-hash';
import { reportSchema } from '@/lib/validations/contact';

// service-role client + node:crypto (IP hash) require the Node runtime, never edge.
export const runtime = 'nodejs';

/** Per-page report cap: 10 reports per hour per portfolio (D-07 — modest). */
const REPORT_PAGE_CAP = 10;
/** Per-sender report cap: 5 reports per hour per hashed IP (D-07 — a low speed-bump). */
const REPORT_SENDER_CAP = 5;
const REPORT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: Request): Promise<NextResponse> {
  // Parse the JSON body. A non-JSON body is a bad request.
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // 1) Zod re-parse at the boundary — the server gate (D-02). A reason outside the
  //    human enum (incl. the reserved `auto_flagged`, D-17) fails here → 400.
  const parsed = reportSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const data = parsed.data;

  // D-06 / HARD-02 — layered BotID gate (no-op off-Vercel); generic 403, no detail leak.
  // Now AFTER the cheap Zod shape check (cheap-local-checks-first, WR-03): a malformed
  // body is a 400 for bot and human alike, and a billed BotID call is never spent on
  // garbage. An ADDED layer ABOVE Turnstile + the two-bucket ledger, NOT a replacement.
  // A transient BotID/OIDC outage degrades OPEN (isBot=false), matching the ledger's
  // fail-open posture (WR-01); reuses the route's generic error shape (never a "bot" message).
  let isBot = false;
  try {
    ({ isBot } = await checkBotId());
  } catch {
    isBot = false;
  }
  if (isBot) {
    return NextResponse.json({ error: 'unavailable' }, { status: 403 });
  }

  // 2) Turnstile siteverify — fail-CLOSED. A failed verify blocks the write entirely.
  const verified = await verifyTurnstile(data.turnstile_token);
  if (!verified) {
    return NextResponse.json({ error: 'verification_failed' }, { status: 400 });
  }

  // 3) Two-bucket rate-limit via the shared ledger (count THEN insert — D-06/D-07).
  //    Over EITHER cap → a GENERIC 429 (D-04 — the body never leaks the cap).
  const pageAllowed = await countAndRecord(
    'report_page',
    data.portfolio_id,
    REPORT_WINDOW_MS,
    REPORT_PAGE_CAP,
  );
  if (!pageAllowed) {
    return NextResponse.json({ error: 'try_later' }, { status: 429 });
  }

  // Per-sender cap — SKIPPED when there is no hashed-IP subject (no IP or no
  //    REPORT_IP_HASH_SECRET): the helper returns null and we degrade (R-5).
  const senderSubject = await hashClientIp(req);
  if (senderSubject) {
    const senderAllowed = await countAndRecord(
      'report_sender',
      senderSubject,
      REPORT_WINDOW_MS,
      REPORT_SENDER_CAP,
    );
    if (!senderAllowed) {
      return NextResponse.json({ error: 'try_later' }, { status: 429 });
    }
  }

  // 4) Insert into `reports` via the service-role client (RLS bypassed). Only the
  //    three writable columns; `reviewed`/`reviewed_at`/`reviewed_by` use their
  //    defaults. The verified `turnstile_token` is NEVER stored (not a column).
  const { error: insertError } = await supabaseAdmin.from('reports').insert({
    portfolio_id: data.portfolio_id,
    reason: data.reason,
    details: data.details ?? null,
  });
  if (insertError) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  // 5) Generic success (D-04).
  return NextResponse.json({ ok: true }, { status: 200 });
}
