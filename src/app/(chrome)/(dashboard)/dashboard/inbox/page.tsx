/**
 * Message inbox — `/dashboard/inbox` (CONT-02, 06-05).
 *
 * The RECEIVING half of the contact capability: the owner reads, triages, and
 * replies to the messages the contact form (06-02) writes. This RSC:
 *
 *   1. AUTH-GATES via `getVerifiedClaims()` (verified JWT, AUTH-05 — NEVER the
 *      spoofable cookie-session getter); a null/sub-less claim `redirect`s to
 *      /login (T-06-V2). The middleware also guards `/dashboard/*`; this is
 *      defense-in-depth at the page boundary.
 *   2. RESOLVES the owner's portfolio id from the verified `sub` via the
 *      AUTHENTICATED client (`portfolios.user_id` is UNIQUE — one portfolio per
 *      user). The id scopes the inbox's TanStack-Query cache key (it does NOT
 *      scope the read — RLS does that).
 *   3. READS the owner's OWN messages, newest-first, via `getInboxMessages()` —
 *      the AUTHENTICATED cookie/RLS read (Pitfall 7: NEVER `supabaseAdmin`). RLS
 *      (`messages own select`) scopes the read to the owner's portfolio.
 *
 * FORCE-DYNAMIC (owner-private; never ISR): the inbox reflects last-state and is
 * gated per-request. It never reads the request host — the identity is the
 * verified `sub` (PUB-03).
 *
 * TWO-LAYER IDENTITY (SHARED-E): this page + the inbox it renders import NO
 * template component and NO template token. They render in chrome (Evergreen /
 * Copper, Inter) tokens only.
 */
import { redirect } from 'next/navigation';

import { MessageInbox } from '@/components/dashboard/inbox/message-inbox';
import { getInboxMessages } from '@/lib/cms/inbox';
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

/** Owner-private + always reflects current state — never ISR. */
export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  // 1) AUTH GATE — verified identity only (AUTH-05, never getSession). WR-05: a
  //    verified claim MUST carry a subject; a missing `sub` is a hard auth failure.
  const claims = await getVerifiedClaims();
  if (!claims) redirect('/login');
  const sub = (claims as { sub?: string }).sub;
  if (!sub) redirect('/login');

  // 2) Resolve the owner's portfolio id (one per user — UNIQUE on user_id) via the
  //    AUTHENTICATED client (NEVER supabaseAdmin). Scopes the TanStack cache key.
  const supabase = await createClient();
  const { data: portfolioRow } = await supabase
    .from('portfolios')
    .select('id')
    .eq('user_id', sub)
    .maybeSingle();
  const portfolioId = (portfolioRow as { id?: string } | null)?.id;
  if (!portfolioId) {
    // A verified session with no portfolio should not happen (the dashboard
    // bootstraps one on load); degrade to the empty inbox rather than a crash.
    return <MessageInbox initialMessages={[]} portfolioId="" />;
  }

  // 3) Read the owner's OWN messages via the AUTHENTICATED RLS read (Pitfall 7).
  const messages = await getInboxMessages();

  return <MessageInbox initialMessages={messages} portfolioId={portfolioId} />;
}
