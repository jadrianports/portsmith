'use server';

/**
 * toggleVisibilityAction — the single-row visibility flip (CMS-05 / CMS-06,
 * D-P4-09 "the public page respects visibility").
 *
 * The second of the TWO optimistic editor operations (the other is reorder);
 * the optimism lives in the CLIENT via TanStack Query (onMutate flips the
 * section's `visible` in the `cmsKeys.sections` cache instantly, onError reverts
 * + announces a destructive Alert — optimistic UI honesty). This server action
 * is the durable write the optimistic flip resolves against. It mirrors the
 * canonical SHARED-A skeleton (save-section-action.ts) with the same invariant
 * gate sequence (a failure at step N never reaches step N+1):
 *
 *   1. getVerifiedClaims()  — verified JWT identity (AUTH-05). NEVER the
 *      unverified, spoofable cookie-session getter. A null claim ⇒
 *      { ok:false, 'Not signed in.' }. Drives the username for the revalidate
 *      (the identity, never the request host — PUB-03 / T-04-05c).
 *   2. createClient() write — authenticated, under RLS. A single-row
 *      `.update({ visible }).eq('id', sectionId)`. The owner's
 *      `sections.own_all` policy + `.eq('id', sectionId)` scope the UPDATE to
 *      the caller; a cross-tenant target silently affects 0 rows (T-04-05a,
 *      proven by tests/integration/cms/reorder-visibility.test.ts). NEVER the
 *      service-role client for a user edit.
 *   3. revalidatePath('/' + username) — on-demand ISR purge so a hidden section
 *      DISAPPEARS from the live page within seconds (D-P4-09; the public_sections
 *      view already filters `visible`). LITERAL path, NO second arg (RESEARCH
 *      Pitfall 1 / the CLAUDE.md correction — the optional second arg only
 *      accepts 'page' | 'layout'; the 'max' / { expire: 0 } profile belongs to
 *      revalidateTag, a DIFFERENT function).
 *   4. Return { ok: true }.
 *
 * Source: action shape from src/lib/cms/save-section-action.ts (SHARED-A) +
 * src/lib/auth/reset-actions.ts updatePassword (the verified-claims-then-write
 * shape); revalidatePath signature [VERIFIED: Next 16.2.6].
 */
import { revalidatePath } from 'next/cache';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

/** The toggle outcome — the same discriminated union the other CMS writes return. */
export type ToggleVisibilityResult = { ok: true } | { ok: false; error?: string };

const NOT_SIGNED_IN = 'Not signed in.';
const TOGGLE_FAILED =
  'Something went wrong updating visibility. Please try again.';

/**
 * Flip one section's visibility.
 *
 * @param sectionId The section row to update (RLS + .eq scope it to the owner).
 * @param visible The new visibility (true = shown on the public page).
 * @param username The owner's username, passed from the dashboard so the
 *   revalidate needs no extra round-trip. When omitted the action reads it from
 *   the verified profile row — NEVER from the request host (PUB-03 / T-04-05c).
 */
export async function toggleVisibilityAction(
  sectionId: string,
  visible: boolean,
  username?: string,
): Promise<ToggleVisibilityResult> {
  // 1) Verified identity (AUTH-05 — never the cookie-session getter). Drives the
  //    revalidate path.
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // WR-05: a verified claim MUST carry a subject. Treat a missing `sub` as a hard
  // auth failure — never coerce it to '' (which would make the username fallback
  // read a guaranteed 0-row no-op that masks the invariant violation).
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 2) Single-row visibility flip under RLS. The own_all policy + .eq('id', …)
  //    scope the UPDATE to the owner; a cross-tenant target changes 0 rows
  //    (T-04-05a).
  const supabase = await createClient();
  const { error } = await supabase
    .from('sections')
    .update({ visible })
    .eq('id', sectionId);
  if (error) return { ok: false, error: TOGGLE_FAILED };

  // 3) Resolve the owner username (prefer the dashboard-passed value; else read
  //    the verified profile row — NEVER the request host, PUB-03) and revalidate
  //    the public page so a hidden section disappears live within seconds
  //    (D-P4-09).
  let resolvedUsername = username;
  if (!resolvedUsername) {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', sub) // WR-05: `sub` guaranteed present (no `?? ''`).
      .single();
    resolvedUsername = (data as { username?: string } | null)?.username ?? undefined;
  }
  if (resolvedUsername) {
    // LITERAL path, NO second arg (RESEARCH Pitfall 1 / CLAUDE.md correction).
    revalidatePath('/' + resolvedUsername);
  }

  return { ok: true };
}
