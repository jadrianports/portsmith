'use server';

/**
 * reorderSectionsAction — the batch sort_order write (CMS-05 / CMS-06,
 * D-P4-06 accessible reorder).
 *
 * One of the TWO optimistic editor operations (the other is the eye-toggle);
 * the optimism lives in the CLIENT via TanStack Query (onMutate/onError/
 * onSettled on `cmsKeys.sections`) — this server action is the durable
 * persistence the optimistic flip resolves against. It mirrors the canonical
 * SHARED-A skeleton (save-section-action.ts) with the same invariant gate
 * sequence (a failure at step N never reaches step N+1):
 *
 *   1. getVerifiedClaims()  — verified JWT identity (AUTH-05). NEVER the
 *      unverified, spoofable cookie-session getter. A null claim ⇒
 *      { ok:false, 'Not signed in.' }. Drives the username for the revalidate
 *      (the identity, never the request host — PUB-03 / T-04-05c).
 *   2. createClient() write — authenticated, under RLS. Pitfall 6: the action
 *      takes the FULL ordered id list and writes EACH row's new contiguous
 *      `sort_order` 0..n — never just the moved row. Writing a single row
 *      leaves duplicate / gapped orders that corrupt the public read (which
 *      sorts `sort_order ASC` — get-portfolio.ts). The owner's
 *      `sections.own_all` policy + `.eq('id', id)` scope every UPDATE to the
 *      caller's own rows; a cross-tenant id silently affects 0 rows
 *      (T-04-05a, proven by tests/integration/cms/reorder-visibility.test.ts).
 *      NEVER the service-role client for a user edit.
 *   3. revalidatePath('/' + username) — on-demand ISR purge so the PUBLISHED
 *      public page reflects the new order within seconds (D-P4-01). LITERAL
 *      path, NO second arg (RESEARCH Pitfall 1 / the CLAUDE.md correction —
 *      the optional second arg only accepts 'page' | 'layout'; the 'max' /
 *      { expire: 0 } profile belongs to revalidateTag, a DIFFERENT function).
 *   4. Return { ok: true }.
 *
 * Source: action shape from src/lib/cms/save-section-action.ts (SHARED-A) +
 * src/lib/auth/reset-actions.ts updatePassword (the verified-claims-then-write
 * shape); revalidatePath signature [VERIFIED: Next 16.2.6].
 */
import { revalidatePath } from 'next/cache';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

/** The reorder outcome — the same discriminated union the other CMS writes return. */
export type ReorderSectionsResult = { ok: true } | { ok: false; error?: string };

const NOT_SIGNED_IN = 'Not signed in.';
const REORDER_FAILED =
  'Something went wrong reordering your sections. Please try again.';

/**
 * Persist a new section order.
 *
 * @param orderedIds The FULL ordered list of section ids (index becomes the new
 *   contiguous `sort_order`). Pitfall 6: pass every section, not just the moved
 *   one — partial lists create gaps/collisions.
 * @param username The owner's username, passed from the dashboard (already
 *   loaded for the editor) so the revalidate needs no extra round-trip. When
 *   omitted the action reads it from the verified profile row — NEVER from the
 *   request host (PUB-03 / T-04-05c).
 */
export async function reorderSectionsAction(
  orderedIds: string[],
  username?: string,
): Promise<ReorderSectionsResult> {
  // 1) Verified identity (AUTH-05 — never the cookie-session getter). Drives the
  //    revalidate path.
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    // Nothing to reorder — treat an empty list as a no-op success.
    return { ok: true };
  }

  // 2) Write each row's new contiguous sort_order (0..n) under RLS (Pitfall 6 —
  //    ALL affected rows, never just the moved one). RLS + .eq('id', id) scope
  //    every UPDATE to the owner; a cross-tenant id changes 0 rows (T-04-05a).
  const supabase = await createClient();
  for (let sortOrder = 0; sortOrder < orderedIds.length; sortOrder++) {
    const { error } = await supabase
      .from('sections')
      .update({ sort_order: sortOrder })
      .eq('id', orderedIds[sortOrder]);
    if (error) return { ok: false, error: REORDER_FAILED };
  }

  // 3) Resolve the owner username (prefer the dashboard-passed value; else read
  //    the verified profile row — NEVER the request host, PUB-03) and revalidate
  //    the public page so the new order is live within seconds (D-P4-01).
  let resolvedUsername = username;
  if (!resolvedUsername) {
    const sub = (claims as { sub?: string }).sub;
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', sub ?? '')
      .single();
    resolvedUsername = (data as { username?: string } | null)?.username ?? undefined;
  }
  if (resolvedUsername) {
    // LITERAL path, NO second arg (RESEARCH Pitfall 1 / CLAUDE.md correction).
    revalidatePath('/' + resolvedUsername);
  }

  return { ok: true };
}
