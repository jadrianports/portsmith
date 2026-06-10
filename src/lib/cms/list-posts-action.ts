'use server';

/**
 * listPostsAction — the thin `'use server'` owner-read handoff the blog panel
 * (`blog-panel.tsx`) calls via TanStack Query to lazily load the owner's posts
 * (drafts + published) WITHOUT threading them through the dashboard RSC props
 * (D-19: the Blog panel is a lazy rail destination, not part of the initial editor
 * payload). It mirrors the SHARED-A auth/sub gate (read-only — no write):
 *
 *   1. getVerifiedClaims() — verified JWT identity (AUTH-05 — never getSession).
 *      A null claim ⇒ []. WR-05: a verified claim MUST carry a `sub` — hard-fail
 *      (return []) on a missing one, never coerce to '' (a 0-row no-op masking the
 *      violation).
 *   2. Resolve the caller's OWN portfolio id SERVER-SIDE under RLS
 *      (`.eq('user_id', sub).maybeSingle()` — never a client-supplied id), so the
 *      list can only ever be the caller's own posts (cross-tenant → impossible).
 *   3. Delegate to `getOwnerPosts(portfolioId)` (the base-table, RLS-scoped owner
 *      read, drafts included).
 *
 * It performs NO write (no `.insert`/`.update`/`.delete`) — a pure read behind the
 * owner gate. `import 'server-only'` is unnecessary on a `'use server'` action (it
 * is already server-only by construction); the underlying `getOwnerPosts` carries
 * the `server-only` import.
 *
 * Source: the portfolio-id resolve under RLS from `add-section-action.ts:139-150`;
 * the owner list read from `get-posts-owner.ts`.
 */
import { getOwnerPosts, type OwnerPostListItem } from '@/lib/portfolio/get-posts-owner';
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

/**
 * List the authenticated caller's OWN posts (drafts + published), most-recently-
 * edited first. Returns [] for an unauthenticated caller or a portfolio with no
 * posts. The portfolio id is resolved server-side under RLS — never trusted from
 * the client.
 */
export async function listPostsAction(): Promise<OwnerPostListItem[]> {
  // 1) Verified identity (AUTH-05 — never getSession).
  const claims = await getVerifiedClaims();
  if (!claims) return [];

  // 2) WR-05 hard `sub` guard — never coerce to ''.
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return [];

  // 3) Resolve the caller's OWN portfolio id under RLS (never client-supplied).
  const supabase = await createClient();
  const { data: portfolioRow, error: portfolioError } = await supabase
    .from('portfolios')
    .select('id')
    .eq('user_id', sub) // RLS scopes to the owner; WR-05: `sub` guaranteed present.
    .maybeSingle();
  if (portfolioError) return [];
  const portfolioId = (portfolioRow as { id?: string } | null)?.id;
  if (!portfolioId) return [];

  // 4) Delegate to the base-table owner read (drafts included).
  return getOwnerPosts(portfolioId);
}
