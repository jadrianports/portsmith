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
 *   2. ATOMIC reorder via the `reorder_sections` RPC (WR-04) — a single
 *      SECURITY INVOKER function (migration 007) that sets every named row's
 *      contiguous 0-based `sort_order` in ONE statement, so all rows commit or
 *      none do. This replaces the former per-row UPDATE loop, whose mid-loop
 *      failure could leave duplicate / gapped orders that corrupt the public
 *      read (which sorts `sort_order ASC` — get-portfolio.ts). Pitfall 6 still
 *      holds: pass the FULL ordered id list (index → new sort_order), never just
 *      the moved row. The RPC runs as the CALLER, so the `sections.own_all` RLS
 *      policy + the `portfolio_id = p_portfolio_id` predicate scope the write to
 *      the owner's own portfolio; a cross-tenant id matches no row (T-04-05a,
 *      proven by tests/integration/cms/reorder-visibility.test.ts). The
 *      `p_portfolio_id` is resolved SERVER-SIDE from the verified identity (the
 *      caller's own portfolio under RLS), never trusted from the client. NEVER
 *      the service-role client for a user edit.
 *   3. revalidatePath('/' + username) — on-demand ISR purge so the PUBLISHED
 *      public page reflects the new order within seconds (D-P4-01). LITERAL
 *      path, NO second arg (RESEARCH Pitfall 1 / the CLAUDE.md correction —
 *      the optional second arg only accepts 'page' | 'layout'; the 'max' /
 *      { expire: 0 } profile belongs to revalidateTag, a DIFFERENT function).
 *   4. Return { ok: true }.
 *
 * Source: action shape from src/lib/cms/save-section-action.ts (SHARED-A) +
 * src/lib/auth/reset-actions.ts updatePassword (the verified-claims-then-write
 * shape); the atomic `reorder_sections` RPC from migration 007 (WR-04);
 * revalidatePath signature [VERIFIED: Next 16.2.6].
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

  // WR-05: a verified claim MUST carry a subject. Treat a missing `sub` as a hard
  // auth failure — never coerce it to '' (which would make the username fallback
  // read a guaranteed 0-row no-op that masks the invariant violation).
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    // Nothing to reorder — treat an empty list as a no-op success.
    return { ok: true };
  }

  // 2) Resolve the caller's OWN portfolio id SERVER-SIDE under RLS (never trusted
  //    from the client). The portfolios row is owner-scoped, so this yields only
  //    the caller's own portfolio; the RPC then scopes the reorder to it.
  const supabase = await createClient();
  const { data: portfolioRow, error: portfolioError } = await supabase
    .from('portfolios')
    .select('id')
    .eq('user_id', sub) // RLS scopes to the owner; WR-05: `sub` guaranteed present.
    .maybeSingle();
  if (portfolioError) return { ok: false, error: REORDER_FAILED };
  const portfolioId = (portfolioRow as { id?: string } | null)?.id;
  if (!portfolioId) return { ok: false, error: REORDER_FAILED };

  // 3) ATOMIC reorder via the SECURITY INVOKER RPC (WR-04 / migration 007): one
  //    statement sets every named row's contiguous 0-based sort_order, all-or-
  //    nothing. RLS + the p_portfolio_id predicate scope it to the owner; a
  //    cross-tenant id matches no row (Pitfall 6 — pass the FULL ordered list).
  const { error } = await supabase.rpc('reorder_sections', {
    p_portfolio_id: portfolioId,
    p_ordered_ids: orderedIds,
  });
  if (error) return { ok: false, error: REORDER_FAILED };

  // 4) Resolve the owner username (prefer the dashboard-passed value; else read
  //    the verified profile row — NEVER the request host, PUB-03) and revalidate
  //    the public page so the new order is live within seconds (D-P4-01).
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
