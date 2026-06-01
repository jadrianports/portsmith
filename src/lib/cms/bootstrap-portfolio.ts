'use server';

/**
 * New-account bootstrap (CMS-01 / D-P4-07).
 *
 * `ensurePortfolio()` is the server action the dashboard RSC calls on EVERY load.
 * It wraps the live `initialize_portfolio()` RPC, which is:
 *   - SECURITY DEFINER and `auth.uid()`-guarded — it only ever seeds the CALLER's
 *     own portfolio, and raises 'Not authenticated' on a null uid (T-04-02a).
 *   - IDEMPOTENT — it early-returns the existing portfolio id when the user
 *     already has one, so calling it on every dashboard load is a cheap no-op
 *     after the first (RESEARCH OQ-3 / D-P4-07). On the FIRST call it creates the
 *     portfolio + settings + the 7 default sections with polished, neutral
 *     placeholder content (migration 006) — NO fake name/photo identity.
 *
 * Identity is read via `getVerifiedClaims()` (verified JWT), NEVER the
 * unverified cookie-reading session getter (AUTH-05, T-04-02b): that getter
 * reads cookies without verifying the token and is spoofable. A null claim means
 * no valid session → return null (the caller redirects to login).
 *
 * Failure posture: any RPC error returns `null` rather than throwing, so a
 * transient bootstrap hiccup degrades to "no portfolio yet" instead of crashing
 * the dashboard render. The RSC can re-call on the next load.
 *
 * Source: [VERIFIED: repo `002_functions_triggers.sql` + `006_enrich_bootstrap_placeholder.sql`
 * initialize_portfolio — SECURITY DEFINER, idempotent, returns UUID].
 */
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

export async function ensurePortfolio(): Promise<{ portfolioId: string } | null> {
  const claims = await getVerifiedClaims();
  if (!claims) return null;

  const supabase = await createClient();
  // initialize_portfolio() is SECURITY DEFINER, auth.uid-guarded, IDEMPOTENT:
  // returns the existing portfolio id if one exists, else creates + seeds the
  // 7 default sections with the enriched neutral placeholder content (D-P4-07).
  const { data, error } = await supabase.rpc('initialize_portfolio');
  if (error) return null;

  return { portfolioId: data as string };
}
