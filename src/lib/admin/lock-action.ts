'use server';

/**
 * lock-action — the moderation kill switch (SAFE-02 / D-12 / D-13).
 *
 * The TAKEDOWN half of the trust-and-safety loop: an operator suspends a bad
 * portfolio so the public page 404s within MINUTES — no deploy. Restore is the
 * inverse. Mirrors the CANONICAL column-flip + `revalidatePath` idiom proven by
 * `publish-action.ts` (04-06):
 *
 *   1. getVerifiedClaims()  — verified JWT identity (AUTH-05). NEVER the
 *      spoofable cookie-session getter. A null claim / missing `sub` ⇒ `{ok:false}`
 *      with NO write (publish-action.ts:75-83 discipline).
 *   2. Admin RE-CHECK (defense-in-depth over the `(admin)` route-group gate,
 *      T-06-18): the caller's OWN `profiles.role` is read via the AUTHENTICATED
 *      RLS client; only `role==='admin'` proceeds. A non-admin ⇒ `{ok:false}`,
 *      no write. The route-group gate already bounces non-admins, but the action
 *      is independently callable, so it owns its own gate.
 *   3. The SERVICE-ROLE write — the ONE structural difference from
 *      publish-action.ts. The kill switch writes PROTECTED columns
 *      (`locked` / `published` / `locked_reason`) on ANOTHER user's row, which
 *      the `enforce_protected_profile_columns` trigger RAISEs for an
 *      authenticated non-admin (Pitfall 4). So it goes through `supabaseAdmin`
 *      (service-role), whose `auth.role()='service_role'` SHORT-CIRCUITS the
 *      trigger (002:55) — all three protected columns flip in ONE write. The
 *      write is scoped by `.eq('username', targetUsername)`; a cross-tenant /
 *      typo'd username silently affects 0 rows.
 *   4. revalidatePath('/' + targetUsername) — the on-demand ISR purge. LITERAL
 *      path, NO second arg (RESEARCH Pitfall 1 / CLAUDE.md — the `'max'` /
 *      `{expire:0}` profile belongs to `revalidateTag`, a DIFFERENT function not
 *      used in this repo). The next visit regenerates → `portfolio_is_public()`
 *      is now false (it requires `locked = false`, 002:148) → the `public_*`
 *      views return NOTHING → `[username]/page.tsx` already `notFound()`s. The
 *      bad page is gone within minutes (R-1, the kill-switch-latency blocker).
 *   5. Return `{ ok: true }`.
 *
 * UNLOCK is the inverse: write `{ locked: false, locked_reason: null }` and
 * revalidate. It does NOT silently re-publish — restoring `published` is a
 * separate explicit owner choice (D-12), so the owner re-publishes when ready.
 *
 * Source: the verified-claims guard + `revalidatePath('/' + username)` idiom from
 * `publish-action.ts`; the service-role write via `supabaseAdmin` (the trigger
 * short-circuit, 002:55); the `is_admin()` posture mirrored as an own-`role`
 * read; revalidatePath signature [VERIFIED: Next 16.2.6].
 */
import { revalidatePath } from 'next/cache';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service-role';

/**
 * The lock/unlock outcome — the same discriminated-union shape the other CMS
 * write actions return (SHARED-A), so `lock-control.tsx` handles results
 * identically. `{ ok: true }` on success; `{ ok: false }` on a not-admin /
 * not-signed-in / write failure (the operator surfaces the generic Alert; the
 * action never leaks which guard rejected).
 */
export type LockActionResult = { ok: true } | { ok: false };

/**
 * Re-assert the caller is an admin (defense-in-depth over the `(admin)`
 * route-group gate). Reads the caller's OWN `profiles.role` under RLS via the
 * AUTHENTICATED client — the `is_admin()` SECURITY DEFINER helper backs the
 * route gate; here the own-row select is sufficient and avoids a second RPC. A
 * null claim / missing `sub` / non-admin role all return `false` (no write).
 */
async function callerIsAdmin(): Promise<boolean> {
  const claims = await getVerifiedClaims();
  if (!claims) return false;
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', sub)
    .single();
  if (error) return false;
  return (data as { role?: string } | null)?.role === 'admin';
}

/**
 * Suspend (lock + unpublish) a portfolio by username (SAFE-02). Admin-only.
 *
 * Writes `locked=true, published=false, locked_reason=reason` on the target via
 * the service-role (the trigger short-circuit covers all three protected
 * columns in one write), then revalidates the public path so the page 404s
 * within minutes.
 *
 * @param targetUsername The username of the portfolio to suspend.
 * @param reason A free-text moderation note recorded in `locked_reason`.
 */
export async function lockPortfolio(
  targetUsername: string,
  reason: string,
): Promise<LockActionResult> {
  // 1+2) Verified identity + admin re-check (T-06-18). A non-admin never writes.
  if (!(await callerIsAdmin())) return { ok: false };

  // 3) SERVICE-ROLE write of the THREE protected columns in one update. The
  //    002:55 service_role short-circuit lets the trigger pass; an authenticated
  //    non-admin doing this same write would be RAISEd (Pitfall 4 / the
  //    kill-switch test's non-admin-rejected assertion). Scope to the target by
  //    username; a typo / cross-tenant target silently affects 0 rows.
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ locked: true, published: false, locked_reason: reason })
    .eq('username', targetUsername);
  if (error) return { ok: false };

  // 4) On-demand ISR purge — LITERAL path, NO 2nd arg (R-1 / Pitfall 1). The
  //    next visit regenerates → portfolio_is_public()=false → public_* empty →
  //    404 within minutes (no deploy).
  revalidatePath('/' + targetUsername);

  return { ok: true };
}

/**
 * Restore (unlock) a suspended portfolio by username. Admin-only.
 *
 * The inverse of {@link lockPortfolio}: clears `locked` + `locked_reason` via the
 * service-role and revalidates the public path. It deliberately LEAVES
 * `published` alone — restoring access does NOT silently re-publish; the owner
 * re-publishes their page when ready (D-12).
 *
 * @param targetUsername The username of the portfolio to restore.
 */
export async function unlockPortfolio(
  targetUsername: string,
): Promise<LockActionResult> {
  // 1+2) Verified identity + admin re-check (T-06-18).
  if (!(await callerIsAdmin())) return { ok: false };

  // 3) SERVICE-ROLE write clearing the lock (locked + locked_reason). `published`
  //    is intentionally untouched — restoring access is not re-publishing (D-12).
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ locked: false, locked_reason: null })
    .eq('username', targetUsername);
  if (error) return { ok: false };

  // 4) Revalidate so a re-published page can be served again promptly (same
  //    literal-path purge idiom).
  revalidatePath('/' + targetUsername);

  return { ok: true };
}
