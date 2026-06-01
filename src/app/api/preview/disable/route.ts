/**
 * `GET /api/preview/disable` — turn OFF Draft Mode and return to the dashboard
 * (the symmetric "Exit preview" counterpart to `/api/preview/enable`).
 *
 * Disabling Draft Mode clears the `__prerender_bypass` cookie, so the next visit
 * to `/[username]` falls back to the cookie-LESS public ISR path (Pitfall 2) — the
 * owner-preview branch is no longer taken.
 *
 * No identity check is needed to DISABLE: clearing one's own draft cookie is
 * harmless (it can only ever turn the requester's own preview off), and the page's
 * owner branch already re-confirms ownership for any cookie that remains.
 *
 * NEXT 16 ASYNC API (RESEARCH Pattern 2): `draftMode()` is ASYNC — `await` it
 * first, THEN call `.disable()`. `redirect()` throws `NEXT_REDIRECT`, so it is
 * called at the top level (never inside a try/catch that would swallow it).
 */
import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET(): Promise<never> {
  const draft = await draftMode();
  draft.disable();

  redirect('/dashboard');
}
