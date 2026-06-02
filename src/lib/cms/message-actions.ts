'use server';

/**
 * message-actions — the inbox write half (CONT-02, 06-05): mark a message
 * read/unread and delete a message, both under RLS via the AUTHENTICATED client.
 *
 * Mirrors the CANONICAL SHARED-A skeleton (`publish-action.ts` / `save-section-
 * action.ts`): the server boundary OWNS the gate; the sequence is invariant
 * (verified identity → RLS-scoped write → discriminated-union result). The ONE
 * deliberate omission versus publish-action is the public `revalidatePath`: the
 * inbox is a PRIVATE owner surface — marking a message read or deleting it does
 * NOT change the public portfolio page, so there is NOTHING to revalidate (grep
 * confirms no revalidatePath here, acceptance criterion).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ TENANT BOUNDARY (T-06-13, LOAD-BEARING):                                      │
 * │ Both actions use the AUTHENTICATED cookie/RLS `createClient()` — NEVER        │
 * │ `supabaseAdmin`. The `messages own update` / `messages own delete` policies   │
 * │ (004:196,209) scope every op to the caller's OWN portfolio via the EXISTS     │
 * │ join `portfolios.user_id = auth.uid()`, so a cross-tenant target affects 0    │
 * │ rows. We pass ONLY the message `id` to `.eq('id', …)`; RLS does the           │
 * │ scoping, not an app-code portfolio filter (inbox-rls.test.ts proves user B    │
 * │ cannot mark-read or delete user A's message).                                 │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * D-06 (ledger independence): `deleteMessage` touches ONLY the `messages` table.
 * It NEVER writes `rate_limit_events`, so deleting inbox spam does not reopen a
 * spammer's contact quota (rate-limit.test.ts re-asserts this after delete exists).
 *
 * Source: the verified-claims guard + discriminated-union shape from
 * `publish-action.ts` (SHARED-A); the `messages` RLS policies (004:196,209).
 */
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

/**
 * The inbox-write outcome. `{ ok: true }` on success; `{ ok: false }` (optionally
 * with an `error`) on a not-signed-in / write failure — the same discriminated
 * union the other CMS write actions return (SHARED-A), so the inbox island
 * handles results identically.
 */
export type MessageActionResult = { ok: true } | { ok: false; error?: string };

const NOT_SIGNED_IN = 'Not signed in.';
const UPDATE_FAILED = 'We couldn’t update that message. Please try again.';
const DELETE_FAILED = 'We couldn’t delete that message. Please try again.';

/**
 * Mark a message read or unread (write ONLY `is_read`).
 *
 * @param messageId The message to update.
 * @param isRead `true` → read; `false` → unread.
 */
export async function markMessageRead(
  messageId: string,
  isRead: boolean,
): Promise<MessageActionResult> {
  // 1) Verified identity (AUTH-05 — never getSession). A missing `sub` is a hard
  //    auth failure, never coerced to '' (WR-05).
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 2) SINGLE-COLUMN write under RLS via the AUTHENTICATED client. The
  //    `messages own update` policy scopes this to the owner's portfolio — a
  //    cross-tenant target affects 0 rows (T-06-13). NO public revalidate (the
  //    inbox is private).
  const supabase = await createClient();
  const { error } = await supabase
    .from('messages')
    .update({ is_read: isRead })
    .eq('id', messageId);
  if (error) return { ok: false, error: UPDATE_FAILED };

  return { ok: true };
}

/**
 * Delete one message (hard delete).
 *
 * Touches ONLY the `messages` table — the `rate_limit_events` ledger is
 * independent (D-06), so clearing inbox spam never reopens a spammer's quota.
 *
 * @param messageId The message to delete.
 */
export async function deleteMessage(
  messageId: string,
): Promise<MessageActionResult> {
  // 1) Verified identity (AUTH-05).
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 2) DELETE under RLS via the AUTHENTICATED client. The `messages own delete`
  //    policy scopes this to the owner's portfolio — a cross-tenant delete
  //    affects 0 rows (T-06-13). NO public revalidate; NO ledger write (D-06).
  const supabase = await createClient();
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);
  if (error) return { ok: false, error: DELETE_FAILED };

  return { ok: true };
}
