import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/service-role';

/**
 * Trusted owner resolution for the contact-notify email (NOTIF-03 · D-03).
 *
 * `import 'server-only'` (the FIRST line) is the compile-time wall — this module
 * holds `supabaseAdmin` (a service-role client that BYPASSES RLS), so it must never
 * reach a browser bundle (same FND-05 discipline as `service-role.ts:1`).
 *
 * SECURITY INVARIANT (NOTIF-03): the owner's email + username are resolved ONLY
 * here, via a `supabaseAdmin` lookup keyed on `portfolioId` (the trusted server
 * value). They are NEVER taken from the visitor's contact payload — otherwise a
 * visitor could choose the recipient (`to`) and email an attacker-chosen address
 * (T-21-09). The contact route already holds `supabaseAdmin`; this module owns the
 * lookup so the invariant is local and impossible for a caller to bypass.
 *
 * The join mirrors the route's existing keyed-on-`portfolio_id` read shape
 * (`route.ts:123-127`): `portfolios.id = portfolioId` → embed `profiles` on
 * `portfolios.user_id = profiles.id` (verified `001:95` UNIQUE FK), selecting the
 * private `(email, username)`. Service-role is the only context allowed to read
 * `profiles.email` (it is REVOKE'd from anon and absent from the public views).
 */

/** The trusted owner identity used to address + link the notification email. */
export interface PortfolioOwner {
  /** The owner's private account email — the `to` address (NEVER client-supplied). */
  email: string;
  /** The owner's portfolio username — used for context (the inbox link is global). */
  username: string;
}

/**
 * Resolve the portfolio owner's `(email, username)` from a trusted server lookup
 * keyed on `portfolioId`. Returns `null` on a miss / error (a deleted portfolio, a
 * lookup failure) so the caller degrades-open and never throws.
 */
export async function getPortfolioOwner(portfolioId: string): Promise<PortfolioOwner | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('portfolios')
      // Embedded join: portfolios.user_id → profiles.id (UNIQUE FK, 001:95). The
      // private (email, username) come from `profiles` — readable only under the
      // service-role context this module holds.
      .select('profiles!inner(email, username)')
      .eq('id', portfolioId)
      .single();

    if (error || !data) return null;

    // The embedded relation may surface as `data.profiles` (an object or a
    // single-element array, per the generated relationship cardinality) OR — when a
    // future call site flattens the select — as `(email, username)` directly on the
    // row. Normalize all three shapes defensively so the trusted values are read the
    // same way regardless of the exact PostgREST embed typing.
    const row = data as {
      profiles?: unknown;
      email?: string | null;
      username?: string | null;
    };
    const rel = row.profiles;
    const profile = (
      rel === undefined ? row : Array.isArray(rel) ? rel[0] : rel
    ) as { email?: string | null; username?: string | null } | undefined;

    if (!profile?.email || !profile?.username) return null;
    return { email: profile.email, username: profile.username };
  } catch {
    // A thrown lookup (network / unexpected) — degrade-open, never throw to notify.
    return null;
  }
}
