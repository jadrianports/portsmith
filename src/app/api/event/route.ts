/**
 * `POST /api/event` — the SOLE, authoritative writer to `analytics_events`
 * (ANLY-05 / D-09). A service-role mirror of `/api/page-view`: `analytics_events`
 * has NO public INSERT policy (owner-select-only RLS — 029), so the anon key in the
 * browser can never reach PostgREST directly; this server-only, `runtime='nodejs'`
 * route holds the service-role key and is the single place an outbound-click event
 * is written. The client beacon (`beacon.tsx`) sends a plain JSON body — it never
 * holds the anon key and never parses Zod (the server parse below is the only gate).
 *
 * Mirrors `/api/page-view` gate-for-gate (D-09), with two ANLY-05-specific points:
 *   - The link `category` (social/contact/project/other) is DERIVED SERVER-SIDE from
 *     `destination_host` (D-10) — the optional client `kind` hint is IGNORED for the
 *     stored category. A client can never forge the category (T-33-16).
 *   - No per-session dedup and no UTM/country: a repeated outbound click is real
 *     engagement signal (unlike a page view).
 *
 * The gate sequence (in order):
 *   1. `req.json()` in try/catch → a non-JSON body is a 400 `bad_request`.
 *   2. `eventSchema.safeParse` re-parse at the boundary — the ONLY Zod gate (the
 *      beacon sends plain JSON). A bad body → 400 `bad_request`; no insert.
 *   3. Server-side bot-UA denylist (`isKnownBot`, D-07) — a match → SILENT 200, no
 *      insert. NO Turnstile, NO BotID: a high-volume fire-and-forget beacon is not a
 *      human-friction write; the flood-guard cap (step 4) is the abuse gate.
 *   4. Flood-guard via the SHARED `rate_limit_events` ledger (`countAndRecord`,
 *      count THEN insert — D-08). Bucket = `event` (soft-enum on `bucket`, no
 *      migration); subject = `hashClientIp` (a GENEROUS per-hashed-IP cap). Over cap
 *      → SILENT 200, no insert (NOT a 429). A null subject (no IP or no secret)
 *      SKIPS the cap (degrade).
 *   5. SERVER-SIDE category derivation (D-10) from `destination_host`.
 *   6. Insert into `analytics_events` via `supabaseAdmin` (RLS bypassed) — the
 *      EXPLICIT 4-column allowlist `{ portfolio_id, destination_host, category,
 *      path }`, NO raw IP, NO `...parsed` spread. A DB error → a SILENT 200 (a
 *      missed click is acceptable).
 *   7. 200 `{ok:true}` — a generic success.
 */
import { NextResponse } from 'next/server';

import { isKnownBot } from '@/lib/analytics/bot-denylist';
import { countAndRecord } from '@/lib/rate-limit/ledger';
import { supabaseAdmin } from '@/lib/supabase/service-role';
import { hashClientIp } from '@/lib/trust/ip-hash';
import { eventSchema } from '@/lib/validations'; // server-side ONLY — never the client/beacon

// service-role client + node:crypto (IP hash) require the Node runtime, never edge.
export const runtime = 'nodejs';

/**
 * Flood-guard cap (OQ-5): mirrors `PAGE_VIEW_CAP` — a GENEROUS per-hashed-IP cap, NOT
 * a per-portfolio popularity cap. A real human never approaches 600 outbound clicks
 * an hour from one IP; a flood does. The single tunable for the click abuse gate
 * (tune down only if abuse appears).
 */
const EVENT_CAP = 600;
const EVENT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Host substrings that mark a `social` outbound destination (D-10). */
const SOCIAL_HOST_SUBSTRINGS: readonly string[] = [
  'linkedin.com',
  'github.com',
  'x.com',
  'twitter.com',
  'instagram.com',
  'youtube.com',
  'youtu.be',
  'facebook.com',
  'fb.com',
  'tiktok.com',
  'dribbble.com',
  'behance.net',
  'medium.com',
  'dev.to',
  'mastodon',
  'threads.net',
  'bsky.app',
  'twitch.tv',
];

/**
 * Derive the coarse link category SERVER-SIDE from the destination host (D-10). The
 * stored category is NEVER read from a client field — only the host the client claims
 * it linked to is inspected here, and the bucketing is the server's decision.
 *   - `contact` — `mailto:`/`tel:` schemes (the beacon sends these as the host) or a
 *     host that looks like a direct contact channel.
 *   - `social`  — a known social/professional network host.
 *   - `project` — any other real outbound host (the default for "a link to my work").
 *   - `other`   — no host at all.
 */
function deriveCategory(destinationHost: string | null | undefined): string {
  if (!destinationHost) return 'other';
  const host = destinationHost.toLowerCase();
  if (host.startsWith('mailto:') || host.startsWith('tel:') || host === 'mailto' || host === 'tel') {
    return 'contact';
  }
  if (SOCIAL_HOST_SUBSTRINGS.some((s) => host.includes(s))) {
    return 'social';
  }
  return 'project';
}

export async function POST(req: Request): Promise<NextResponse> {
  // Parse the JSON body. A non-JSON body is a bad request (the only 400 path besides
  // a schema miss — a malformed body is a programming/abuse error, not a real click).
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // 1) Zod re-parse at the boundary — the ONLY gate (the beacon sends plain JSON).
  const parsed = eventSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const data = parsed.data;

  // 2) Server-side bot-UA denylist (D-07). A match → SILENT no-op (a crawler that ran
  //    JS, or a spoofed UA). Drop, do NOT error. NO Turnstile / NO BotID by design —
  //    a high-volume fire-and-forget click beacon collects no human signal.
  if (isKnownBot(req.headers.get('user-agent'))) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 3) Flood-guard via the shared ledger (count THEN insert — D-08). Subject = hashed
  //    IP. A null subject (no IP / no secret) SKIPS the cap (degrade).
  const subject = await hashClientIp(req);
  if (subject) {
    const allowed = await countAndRecord('event', subject, EVENT_WINDOW_MS, EVENT_CAP);
    // OVER CAP → SILENT DROP (200, no insert). NOT a 429.
    if (!allowed) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
  }

  // 4) SERVER-SIDE category derivation (D-10) — never trust a client `kind` attr.
  const category = deriveCategory(data.destination_host);

  // 5) Insert via service-role (RLS bypassed) — the EXPLICIT 4-column allowlist, NO
  //    raw IP, NO `...parsed` spread. A DB error → a SILENT 200 (a missed click is fine).
  const { error: insertError } = await supabaseAdmin.from('analytics_events').insert({
    portfolio_id: data.portfolio_id,
    destination_host: data.destination_host ?? null,
    category,
    path: data.path ?? null,
  });
  if (insertError) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 6) Generic success.
  return NextResponse.json({ ok: true }, { status: 200 });
}
