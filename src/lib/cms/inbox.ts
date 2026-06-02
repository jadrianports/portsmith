/**
 * Inbox read (CONT-02, 06-05) — the owner's OWN contact-form messages, read via
 * the AUTHENTICATED cookie/RLS client.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ PITFALL 7 (LOAD-BEARING, 06-PATTERNS / T-06-12):                              │
 * │ The inbox is an OWNER read under RLS. It MUST use the AUTHENTICATED            │
 * │ cookie/RLS `createClient()` from `@/lib/supabase/server` — NEVER              │
 * │ `supabaseAdmin` (service-role bypasses RLS and would break tenant isolation)  │
 * │ and never the anon client (revoked for `messages`). The `messages own select` │
 * │ policy (004:188) scopes the read to the caller's OWN portfolio: the EXISTS    │
 * │ join `portfolios.user_id = auth.uid()` filters rows so user B sees 0 of user  │
 * │ A's messages — the OWNER sees only their own portfolio's messages because RLS │
 * │ scopes the read, NOT because app code filters by portfolio_id.                │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * The inbox-rls integration test (tests/integration/contact/inbox-rls.test.ts)
 * proves the isolation against the live stack using the authenticated `clientA` /
 * `clientB` — never `adminClient`.
 *
 * `import 'server-only'` keeps the cookie/RLS read out of any client bundle.
 */
import 'server-only';

import { createClient } from '@/lib/supabase/server';

/**
 * The message-row shape the inbox renders (`messages` columns, database.ts:131-140).
 * `subject` is nullable (the contact form leaves it optional); the inbox renders
 * "(no subject)" when absent. `body` / `sender_name` / `sender_email` are untrusted
 * user input — they are rendered as PLAIN TEXT (React escapes), never interpolated
 * into HTML (T-06-05).
 */
export interface InboxMessage {
  id: string;
  sender_name: string;
  sender_email: string;
  subject: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
}

/**
 * Read the AUTHENTICATED owner's OWN messages, newest-first.
 *
 * RLS (`messages own select`) already scopes the result to the caller's own
 * portfolio — there is no `portfolio_id` filter here BY DESIGN: adding one would
 * imply app-code is the tenant boundary, which it is NOT (RLS is). The read uses
 * the cookie/RLS client so `auth.uid()` is the verified caller.
 *
 * Returns `[]` on a read error (the inbox surfaces a calm load-error Alert and an
 * empty list rather than throwing into an error boundary).
 */
export async function getInboxMessages(): Promise<InboxMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_name, sender_email, subject, body, is_read, created_at')
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as InboxMessage[];
}
