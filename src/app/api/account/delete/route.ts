/**
 * `POST /api/account/delete` — the SAFE AUTHORIZED hard-delete path (ACCT-03 /
 * D-09/D-11/D-12). The single place a user's account is permanently destroyed.
 * NEVER a raw/anon delete: the destructive call only runs AFTER verified identity
 * + current-password reauth (D-01) + a type-exact-username confirm (D-12).
 *
 * WHY A SERVICE-ROLE ROUTE, NOT A SERVER ACTION (D-11): the two privileged steps —
 * the Storage folder-sweep and `auth.admin.deleteUser` — both require service-role
 * (RLS bypass). A route handler is also where the @supabase/ssr session cookies can
 * be cleared in the response (a Server Action can't reliably emit the clearing
 * Set-Cookie). `runtime='nodejs'` because the service-role client never runs on edge.
 *
 * THE GATE SEQUENCE (each failure is a GENERIC typed JSON body — T-19-15: never leak
 * WHICH gate failed: password vs. username vs. session):
 *   1. Parse JSON body — non-JSON → 400 bad_request.
 *   2. `deleteAccountSchema.safeParse` (the server gate; client parse is UX only) —
 *      bad shape → 400 bad_request.
 *   3. `getVerifiedClaims()` → read `sub` + `email`; missing either → 401 unauthorized
 *      (hard-fail, NEVER `sub ?? ''` — T-19-05: a missing session is never a delete).
 *   4. Resolve the verified profile username via the authenticated RLS client (the
 *      user's OWN `profiles.username` row).
 *   5. D-12 type-exact-username gate: `parsed.username !== profileUsername` → 403.
 *   6. D-01 reauth: `verifyCurrentPassword(email, …)` false → 403.
 *   7. `signOut()` on the authenticated cookie client FIRST so the cookie-clearing
 *      Set-Cookie headers ride this response (the subsequent service-role delete
 *      needs no user session).
 *   8. `sweepUserStorage(sub)` — ACCT-05, BEFORE the user delete (Storage is NOT in
 *      the FK cascade; sweep-then-delete so the storage_used_bytes trigger row still
 *      exists and the verified-sub provenance is unambiguous).
 *   9. `supabaseAdmin.auth.admin.deleteUser(sub)` — the FK ON DELETE CASCADE
 *      (migration 001) wipes profiles → portfolios → sections / portfolio_settings /
 *      blog_posts / messages / reports.
 *  10. 200 `{ ok: true }` — the client island then full-page-navigates to /?deleted=1.
 *
 * D-10 (untouched foundation): this route uses `admin.deleteUser` + the FK cascade
 * ONLY. It NEVER calls the dormant soft-delete RPC and NEVER writes the soft-delete
 * timestamp column — the locked 002 protected-columns trigger / carve-out is left
 * exactly as it is. (Verified by the phase grep guard, which must find zero hits.)
 *
 * Mirrors the proven service-role route skeleton in `api/contact/route.ts`.
 */
import { NextResponse } from 'next/server';

import { verifyCurrentPassword } from '@/lib/auth/reauth';
import { sweepUserStorage } from '@/lib/media/sweep-user-storage';
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service-role';
import { deleteAccountSchema } from '@/lib/validations/account';

// service-role client requires the Node runtime, never edge.
export const runtime = 'nodejs';

/** One generic 403 for BOTH gate failures (reauth + username) — never leak which. */
const FORBIDDEN = NextResponse.json({ error: 'forbidden' }, { status: 403 });

export async function POST(req: Request): Promise<NextResponse> {
  // 1) Parse the JSON body. A non-JSON body is a bad request.
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // 2) Zod re-parse at the boundary — the server gate (client parse is UX only).
  const parsed = deleteAccountSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // 3) Verified identity (T-19-05). A missing session is NEVER a delete — 401, no
  //    raw/anon delete path exists. Hard-fail on a missing sub/email (never `?? ''`,
  //    which would become a silent wrong-identity/0-row no-op or a bad reauth).
  const claims = await getVerifiedClaims();
  const sub = (claims as { sub?: string } | null)?.sub;
  const email = (claims as { email?: string } | null)?.email;
  if (!sub || !email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 4) Resolve the verified profile username on the AUTHENTICATED RLS client (the
  //    caller's OWN row — RLS scopes the read to `auth.uid()`). A missing row is
  //    treated as a forbidden state (do not leak it as a distinct condition).
  const supabase = await createClient();
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', sub)
    .single();
  const profileUsername = (profile as { username?: string } | null)?.username;
  if (profileErr || !profileUsername) {
    return FORBIDDEN;
  }

  // 5) D-12 — type-exact-username confirm, asserted against the VERIFIED profile
  //    username (not just the schema). A near-miss must NOT pass. Generic 403.
  if (parsed.data.username !== profileUsername) {
    return FORBIDDEN;
  }

  // 6) D-01 — current-password reauth on a stateless verifier (cannot clobber the
  //    SSR session). `email` is the verified claims email. Generic 403 on failure.
  if (!(await verifyCurrentPassword(email, parsed.data.current_password))) {
    return FORBIDDEN;
  }

  // 7) Clear the @supabase/ssr session FIRST (SIGNED_OUT → cookie-clearing Set-Cookie
  //    on this response). The subsequent service-role steps need no user session.
  await supabase.auth.signOut();

  // 8) ACCT-05 — own-folder-guarded Storage sweep BEFORE the user delete. Storage is
  //    NOT in the FK cascade, so this is the only thing that frees the objects
  //    (the D-09 "frees Storage" criterion). Sweep-then-delete order is load-bearing.
  await sweepUserStorage(sub);

  // 9) The destructive act: delete the auth user → FK ON DELETE CASCADE (migration
  //    001) wipes profiles → portfolios → sections/portfolio_settings/blog_posts/
  //    messages/reports. D-10: hard delete only — never the dormant soft-delete seam.
  const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(sub);
  if (deleteErr) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  // 10) Generic success. The client island full-page-navigates to /?deleted=1.
  return NextResponse.json({ ok: true }, { status: 200 });
}
