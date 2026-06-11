/**
 * `POST /api/page-view` — the SOLE, authoritative writer to `page_views`
 * (ANLY-01 / ANLY-02 / ADR-004). A service-role mirror of `/api/report`:
 * `page_views` has NO public INSERT policy (owner-select-only RLS — 004), so the
 * anon key in the browser can never reach PostgREST directly; this server-only,
 * `runtime='nodejs'` route holds the service-role key and is the single place an
 * anonymous page view is written. The client beacon (`beacon.tsx`) sends a plain
 * JSON body — it never holds the anon key and never parses Zod (the server parse
 * below is the only gate).
 *
 * Two deliberate DEVIATIONS from the `/api/report` skeleton (D-04 / D-08):
 *   1. NO Turnstile. A high-volume fire-and-forget beacon is not a human-friction
 *      write; the flood-guard rate-limit (step 3) is the abuse gate. There is no
 *      `verifyTurnstile` import and no `turnstile_token` in `pageViewSchema`.
 *   2. SILENT-DROP over-cap (NOT a 429). Every non-malformed outcome — over the
 *      flood cap, a known-bot UA, or even a DB insert error — returns a generic
 *      `200 {ok:true}` with NO insert. A 429 would let a flood binary-search the
 *      cap and would surface as a console error for legitimate-but-bursty traffic
 *      (Pitfall 4). A missed view is acceptable for a beacon. ONLY a malformed
 *      body is a 400 (it indicates a programming/abuse error, not a real visitor).
 *
 * The gate sequence (in order):
 *   1. `req.json()` in try/catch → a non-JSON body is a 400 `bad_request`.
 *   2. `pageViewSchema.safeParse` re-parse at the boundary — the server gate (D-04,
 *      NO Turnstile). A bad body → 400 `bad_request`; no insert.
 *   3. Server-side bot-UA denylist (`isKnownBot`, D-07) — a match → SILENT 200, no
 *      insert (a crawler that ran JS, or a spoofed UA; drop, do not error).
 *   4. Flood-guard via the SHARED `rate_limit_events` ledger (`countAndRecord`,
 *      count THEN insert — D-08). Bucket = global `page_view`; subject = `hashClientIp`
 *      (a GENEROUS per-hashed-IP cap, NOT a per-portfolio popularity cap — a popular
 *      portfolio must never be throttled). Over cap → SILENT 200, no insert (D-08,
 *      Pitfall 4 — NOT a 429). A null subject (no IP or no `REPORT_IP_HASH_SECRET`)
 *      SKIPS the cap (degrade, D-09) — exactly like `/api/report`.
 *   5. Visitor country from the FREE Vercel `x-vercel-ip-country` header into the
 *      existing `country` column (D-11). ABSENT in local dev → `null` (Pitfall 3).
 *      Read here in the POST handler ONLY — never on the public page render branch,
 *      so `/[username]` stays ● SSG/ISR (D-20/Pitfall 2).
 *   6. Insert into `page_views` via `supabaseAdmin` (RLS bypassed) — the EXPLICIT
 *      6-column allowlist `{ portfolio_id, path, referrer, country, utm_source,
 *      utm_medium }`, NO raw IP, NO `...parsed` spread (D-09/Pitfall 6). The payload
 *      `referrer_host` maps to the existing `referrer` column (host only — D-10). A
 *      DB error → a SILENT 200 (a missed view is acceptable).
 *   7. 200 `{ok:true}` — a generic success.
 *
 * Mirrors the proven `/api/report` skeleton: `runtime='nodejs'` (the service-role
 * client AND `node:crypto` for the IP hash both require Node, never edge) + typed
 * JSON bodies only.
 */
import { checkBotId } from 'botid/server';
import { NextResponse } from 'next/server';

import { isKnownBot } from '@/lib/analytics/bot-denylist';
import { countAndRecord } from '@/lib/rate-limit/ledger';
import { supabaseAdmin } from '@/lib/supabase/service-role';
import { hashClientIp } from '@/lib/trust/ip-hash';
import { pageViewSchema } from '@/lib/validations'; // server-side ONLY — never the client/beacon

// service-role client + node:crypto (IP hash) require the Node runtime, never edge.
export const runtime = 'nodejs';

/**
 * Flood-guard cap (D-08): a GENEROUS per-hashed-IP cap, NOT a per-portfolio
 * popularity cap. A real human never approaches 600 views/hour from one IP; a
 * flood does. The single tunable named constant for the page-view abuse gate.
 */
const PAGE_VIEW_CAP = 600;
const PAGE_VIEW_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: Request): Promise<NextResponse> {
  // Parse the JSON body. A non-JSON body is a bad request (the only 400 path
  // besides a schema miss — a malformed body is a programming/abuse error).
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // 1) Zod re-parse at the boundary — the server gate (D-04). NO Turnstile.
  const parsed = pageViewSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const data = parsed.data;

  // 2) Server-side bot-UA denylist (D-07). A match → SILENT no-op (a crawler that
  //    ran JS, or a spoofed UA). Drop, do NOT error.
  if (isKnownBot(req.headers.get('user-agent'))) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 2b) D-06 / HARD-02 — BotID silent-drop, keep the beacon posture (no friction);
  //     no-op off-Vercel. Joins the UA denylist as a SILENT drop returning the route's
  //     EXISTING dropped-beacon shape (200 {ok:true}) — NOT a 403/429/204, so the
  //     high-volume beacon never surfaces friction. No BotIdClient protect entry here.
  const { isBot } = await checkBotId();
  if (isBot) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 3) Flood-guard via the shared ledger (count THEN insert — D-08). Subject =
  //    hashed IP. A null subject (no IP / no secret) SKIPS the cap (degrade, D-09).
  const subject = await hashClientIp(req);
  if (subject) {
    const allowed = await countAndRecord('page_view', subject, PAGE_VIEW_WINDOW_MS, PAGE_VIEW_CAP);
    // OVER CAP → SILENT DROP (200, no insert) — D-08. NOT a 429 (Pitfall 4).
    if (!allowed) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
  }

  // 4) Visitor country from the free Vercel header — null in local dev (D-11/Pitfall 3).
  const country = req.headers.get('x-vercel-ip-country') ?? null;

  // 5) Insert via service-role (RLS bypassed) — the EXPLICIT 6-column allowlist, NO
  //    raw IP, NO `...parsed` spread (D-09/Pitfall 6). `referrer_host` (payload) maps
  //    to the existing `referrer` column (host only — D-10).
  const { error: insertError } = await supabaseAdmin.from('page_views').insert({
    portfolio_id: data.portfolio_id,
    path: data.path,
    referrer: data.referrer_host ?? null,
    country,
    utm_source: data.utm_source ?? null,
    utm_medium: data.utm_medium ?? null,
  });
  // Even a DB error is a SILENT 200 for the beacon (a missed view is acceptable).
  if (insertError) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 6) Generic success (D-04).
  return NextResponse.json({ ok: true }, { status: 200 });
}
