import 'server-only';

/**
 * Stateless current-password reauthentication (D-01 / D-02 / T-19-01).
 *
 * `import 'server-only'` (the FIRST line, intentionally) makes any attempt to
 * import this module from a Client Component a BUILD ERROR — the same FND-05
 * compile-time wall used by `service-role.ts:1` and `turnstile.ts:1`. The verify
 * never runs in the browser; credential checking is a server boundary.
 *
 * THE D-01 REAUTH GATE used by ALL THREE sensitive account actions
 * (password / email / delete): each calls `verifyCurrentPassword` FIRST, before
 * the privileged write, so a stolen-but-live session can't silently change the
 * password, swap the email, or delete the account without re-proving the
 * password.
 *
 * WHY A FRESH BARE CLIENT (Pitfall 2 / T-19-01): the verifier is built with the
 * bare `createClient` from `@supabase/supabase-js` — NOT `@/lib/supabase/server`
 * (the `@supabase/ssr` cookie/RLS client) and NOT `supabaseAdmin` (service-role).
 * With `persistSession: false` + `autoRefreshToken: false` it has NO cookie
 * adapter at all: the minted session lives only in memory and is discarded, so it
 * can never read, refresh, or OVERWRITE the user's real `@supabase/ssr` auth
 * cookies. A persisting or cookie-backed client would clobber the live session on
 * a successful (or even attempted) sign-in — the exact failure Pitfall 2 warns
 * about (user logged out / session swapped after a failed password change).
 *
 * WHY `signInWithPassword` AND NOT THE NATIVE `updateUser({ current_password })`
 * (Flag 1): the native field is password-update-specific AND gotrue's Secure
 * password change SKIPS the reauth challenge for sessions created in the last 24h
 * — a user who logged in 10 minutes ago would change their password with no proof.
 * The stateless verify ALWAYS challenges and is uniform across all three actions.
 *
 * CALLER CONTRACT: `email` MUST be sourced from the verified JWT claims
 * (`claims.email`), with a hard-fail upstream if it is absent (never `email ?? ''`
 * — that becomes a silent always-fail / wrong-identity verify). `profiles.email`
 * is stale-by-design after an email change and must NOT be the source.
 *
 * ENUMERATION-SAFE (Pitfall 5 / T-19-01): returns a bare boolean. The caller maps
 * `false` to ONE generic reject; this helper never branches the error or leaks
 * which condition failed (wrong password vs. no such account vs. rate-limited).
 */
import { createClient } from '@supabase/supabase-js';

/**
 * Verify the caller's CURRENT password by attempting a stateless sign-in on a
 * throwaway, non-persisting client.
 *
 * @param email    The current account email, sourced from the verified JWT claims
 *                 (never `profiles.email`, never client-supplied). Hard-failed
 *                 upstream when absent.
 * @param password The current password the user typed into the reauth field.
 * @returns `true` when the credentials authenticate (proceed with the privileged
 *          write); `false` for ANY failure (generic reject — never leak why).
 */
export async function verifyCurrentPassword(
  email: string,
  password: string,
): Promise<boolean> {
  // A FRESH bare client with NO cookie adapter and NO persistence — it cannot
  // touch the user's @supabase/ssr session cookies (Pitfall 2 / T-19-01).
  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await verifier.auth.signInWithPassword({ email, password });
  // Generic: success → proceed; any error → reject, never leak which condition.
  return !error;
}
