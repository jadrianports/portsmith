/**
 * `GET /api/preview/disable` — turn OFF Draft Mode and return to the dashboard
 * (the symmetric "Exit preview" counterpart to `/api/preview/enable`).
 *
 * Disabling Draft Mode clears the `__prerender_bypass` cookie, so the next visit
 * to `/[username]` falls back to the cookie-LESS public ISR path (Pitfall 2) — the
 * owner-preview branch is no longer taken.
 *
 * 07-05: it ALSO clears the `preview-template` candidate cookie (set by the enable
 * route when previewing a prospective template), so exiting preview drops the
 * candidate — the next preview starts from the owner's persisted template again.
 *
 * No identity check is needed to DISABLE: clearing one's own draft + candidate
 * cookies is harmless (it can only ever turn the requester's own preview off), and
 * the page's owner branch already re-confirms ownership for any cookie that remains.
 *
 * NEXT 16 ASYNC API (RESEARCH Pattern 2): `draftMode()` AND `cookies()` are ASYNC —
 * `await` them first, THEN call `.disable()` / `.delete()`. `redirect()` throws
 * `NEXT_REDIRECT`, so it is called at the top level (never inside a try/catch that
 * would swallow it).
 */
import { cookies, draftMode } from 'next/headers';
import { redirect } from 'next/navigation';

import { PREVIEW_TEMPLATE_COOKIE } from '@/lib/preview/cookie';

export async function GET(): Promise<never> {
  const draft = await draftMode();
  draft.disable();

  // Drop the candidate-template cookie too (07-05) so exiting preview clears the
  // prospective slug. cookies() is async in Next 16 — await before .delete().
  const cookieStore = await cookies();
  cookieStore.delete(PREVIEW_TEMPLATE_COOKIE);

  redirect('/dashboard');
}
