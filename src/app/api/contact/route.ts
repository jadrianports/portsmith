/**
 * `POST /api/contact` — the SOLE, authoritative writer to `messages` (CONT-01/03,
 * ADR-004 / D-02). `messages` has NO public INSERT policy, so the anon key in the
 * browser can never reach PostgREST directly; this server-only route holds the
 * service-role key and is the single place a contact message is written.
 *
 * The gate sequence (each failure returns a typed JSON body — never a stack, never
 * the rate-limit policy):
 *   1. Zod re-parse of `contactFormSchema` at the boundary (the client parse is UX
 *      only — the server parse is the real gate, D-02). Bad body → 400 bad_request.
 *   2. Turnstile siteverify — fail-CLOSED (`verifyTurnstile` returns true ONLY on
 *      `{success:true}`). A failed/spent token → 400 verification_failed; no insert.
 *   3. Rate-limit via the `rate_limit_events` LEDGER (count THEN insert — D-06, NOT
 *      a count of `messages` rows). Over cap → a GENERIC 429 try_later (D-04 — never
 *      leak "20/hour", a wait time, or any rate-limit specific).
 *   4. Pre-insert guard (docs/04): the target portfolio must be public — read
 *      `public_portfolios` (the security_invoker view already filters published AND
 *      non-deleted AND non-locked via portfolio_is_public). A missing/non-public
 *      target → a GENERIC failure (do not reveal which condition failed).
 *   5. Insert into `messages` via `supabaseAdmin` (RLS bypassed). `turnstile_token`
 *      is verified, NEVER stored (it is not a `messages` column).
 *   6. `notifyOwnerOfMessage` — the no-op seam (D-01; Resend deferred).
 *   7. 200 `{ok:true}` — a generic success (D-04).
 *
 * Mirrors the proven service-role skeleton in `api/media/upload/route.ts`:
 * `runtime='nodejs'` (service-role needs Node, never edge) + typed JSON errors only.
 */
import { NextResponse } from 'next/server';

import { verifyTurnstile } from '@/lib/auth/turnstile';
import { countAndRecord } from '@/lib/rate-limit/ledger';
import { supabaseAdmin } from '@/lib/supabase/service-role';
import { notifyOwnerOfMessage } from '@/lib/trust/notify';
import { contactFormSchema } from '@/lib/validations/contact';

// service-role client requires the Node runtime, never edge.
export const runtime = 'nodejs';

/** Contact cap: 20 submissions per hour per portfolio (D-06). */
const CONTACT_CAP = 20;
const CONTACT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: Request): Promise<NextResponse> {
  // Parse the JSON body. A non-JSON body is a bad request.
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // 1) Zod re-parse at the boundary — the server gate (D-02). Client parse is UX.
  const parsed = contactFormSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const data = parsed.data;

  // 2) Turnstile siteverify — fail-CLOSED. A failed verify blocks the write entirely.
  const verified = await verifyTurnstile(data.turnstile_token);
  if (!verified) {
    return NextResponse.json({ error: 'verification_failed' }, { status: 400 });
  }

  // 3) Rate-limit via the ledger (count THEN insert — D-06). Over cap → a GENERIC
  //    429 (D-04 — the body must never leak the cap, a wait time, or "per hour").
  const allowed = await countAndRecord(
    'contact',
    data.portfolio_id,
    CONTACT_WINDOW_MS,
    CONTACT_CAP,
  );
  if (!allowed) {
    return NextResponse.json({ error: 'try_later' }, { status: 429 });
  }

  // 4) Pre-insert guard: the target portfolio must be public. `public_portfolios`
  //    (security_invoker) already encodes published AND non-deleted AND non-locked
  //    (portfolio_is_public) — a row present means publishable. A missing/non-public
  //    target returns a GENERIC failure (no info leak about which condition failed).
  const { data: target, error: guardError } = await supabaseAdmin
    .from('public_portfolios')
    .select('id')
    .eq('id', data.portfolio_id)
    .single();
  if (guardError || !target) {
    return NextResponse.json({ error: 'unavailable' }, { status: 404 });
  }

  // 5) Insert into `messages` via the service-role client (RLS bypassed). NOTE:
  //    `turnstile_token` is verified above, NEVER stored — it is not a column.
  const { error: insertError } = await supabaseAdmin.from('messages').insert({
    portfolio_id: data.portfolio_id,
    sender_name: data.sender_name,
    sender_email: data.sender_email,
    subject: data.subject,
    body: data.body,
  });
  if (insertError) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  // 6) Owner notification — the no-op seam (D-01; Resend deferred to brand-domain).
  await notifyOwnerOfMessage({
    portfolioId: data.portfolio_id,
    senderName: data.sender_name,
    subject: data.subject,
  });

  // 7) Generic success (D-04).
  return NextResponse.json({ ok: true }, { status: 200 });
}
