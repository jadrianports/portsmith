/**
 * `/api/health` — Supabase keep-alive (free-tier projects pause after 7 days of
 * inactivity). A GitHub Actions schedule (`.github/workflows/keepalive.yml`) pings this
 * every few days; the single ANON read below touches Postgres through the Data API,
 * which registers activity and keeps the project from pausing.
 *
 * Public, read-only, at most one row (an `id` from the anon-readable `public_profiles`
 * `security_invoker` view) — no service-role, no user input, no data returned to the
 * caller beyond an `ok` flag. Cookie-less anon client (the same pattern as the public
 * portfolio read) so the handler carries no auth/session surface.
 */
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import type { Database } from '@/types/database';

export const runtime = 'nodejs';
// Never cache — every ping MUST run the query so it actually touches the DB.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const db = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  // Cheapest read that still hits Postgres: fetch at most one id (registers activity).
  const { error } = await db.from('public_profiles').select('id').limit(1);

  if (error) {
    return NextResponse.json({ ok: false, db: 'down' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, db: 'up' }, { status: 200 });
}
