'use server';

/**
 * set-showcase-action — the owner's Explore opt-in write (SHOW-03 / D-06 / D-07).
 * The owner flips `profiles.showcase_opt_in` between on (their published portfolio
 * appears on the public `/explore` gallery) and off (the default — opted out).
 *
 * This mirrors `setPublished` (publish-action.ts) EXACTLY — a single-column,
 * NON-protected, own-row `profiles` write under authenticated RLS — with the ONE
 * mandatory addition the publish action does not need: a server-side Zod re-parse of
 * the boolean payload BEFORE the write. `setPublished` is the only SHARED-A action
 * with a bare-boolean payload, so it has no content schema; the showcase opt-in adds
 * the "Zod on every write" gate (CLAUDE.md) via `showcaseOptInSchema` (T-31-08).
 *
 * Canonical SHARED-A sequence (the server boundary OWNS the gate; a failure at step N
 * never reaches step N+1):
 *
 *   1. getVerifiedClaims() — verified JWT identity (AUTH-05). NEVER getSession()
 *      (unverified, spoofable). A null claim ⇒ { ok: false }.
 *   2. WR-05 explicit `sub` guard — a verified claim MUST carry a subject. A missing
 *      `sub` is a HARD auth failure; NEVER coerce it to '' (which would scope the
 *      UPDATE to a non-existent row and silently flip 0 rows, so the opt-in appears to
 *      succeed while nothing changed).
 *   3. ZOD RE-PARSE (T-31-08, the write gate) — `showcaseOptInSchema.parse(optIn)`
 *      (a strict `z.boolean()`, imported from the `@/lib/validations` barrel). The
 *      write commits the PARSED value, never the raw client `optIn`. A non-boolean
 *      throws → we return a generic SAVE_FAILED and write NOTHING.
 *   4. AUTHENTICATED RLS write — `await createClient()` (NEVER `supabaseAdmin`; the
 *      opt-in is owner-editable, so it goes through the owner's own_* RLS policy, not
 *      the service-role / DEFINER-RPC path the protected `username` column uses).
 *      EXPLICIT single-column allowlist `{ showcase_opt_in: parsed }` (never a spread,
 *      never the raw `optIn`), scoped to the caller's OWN row via `.eq('id', sub)`, so
 *      a cross-tenant attempt silently changes 0 rows (RLS USING clause, T-31-02).
 *      `showcase_opt_in` is NOT one of the 8 columns guarded by the
 *      `enforce_protected_profile_columns` trigger (028 deliberately left it OUT,
 *      D-06), so the owner flips it DIRECTLY — this is the designed capability.
 *   5. revalidatePath('/explore') — LITERAL path, NO second arg (CLAUDE.md / the
 *      'max' profile belongs to revalidateTag, a different function). Fires on BOTH
 *      opt-in and opt-out (D-12) so the gallery reflects either change.
 *   6. Return { ok: true }.
 *
 * Source: the SHARED-A skeleton + `SetPublishedResult` union from publish-action.ts
 * (04-03/PUB-01); the strict re-parse gate from CLAUDE.md "Zod on every write"; the
 * showcase column + view from migration 028 (31-02).
 */
import { revalidatePath } from 'next/cache';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { showcaseOptInSchema } from '@/lib/validations';

/**
 * The opt-in outcome — the SAME discriminated union the other CMS write actions
 * return (SHARED-A), so the toggle handles results identically: `{ ok: true }` on a
 * successful flip; `{ ok: false }` (optionally with an `error`) on a not-signed-in /
 * invalid-payload / write failure.
 */
export type SetShowcaseOptInResult = { ok: true } | { ok: false; error?: string };

const NOT_SIGNED_IN = 'Not signed in.';
const SAVE_FAILED = 'We couldn’t update your page. Please try again.';

/**
 * Flip the owner's Explore opt-in (`profiles.showcase_opt_in`). `true` → their
 * published portfolio is eligible for the `/explore` gallery; `false` → opted out
 * (the default). An immediate single write (like `setPublished`), NOT folded into the
 * SEO form's dirty-guard save.
 *
 * @param optIn `true` → show on Explore; `false` → opt out. Re-parsed server-side
 *   (T-31-08) before the write — a non-boolean is rejected and nothing is written.
 */
export async function setShowcaseOptIn(optIn: boolean): Promise<SetShowcaseOptInResult> {
  // 1) Verified identity (AUTH-05 — never getSession).
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // 2) WR-05: a verified claim MUST carry a subject. A missing `sub` is a hard auth
  //    failure — NEVER coerce it to '' (which would scope the UPDATE to a non-existent
  //    row and silently flip 0 rows).
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 3) ZOD RE-PARSE (T-31-08, the write gate per CLAUDE.md "Zod on every write"). The
  //    write commits the PARSED value, never the raw client `optIn`. A non-boolean
  //    throws → return a generic SAVE_FAILED and write NOTHING.
  let parsed: boolean;
  try {
    parsed = showcaseOptInSchema.parse(optIn);
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }

  // 4) SINGLE-COLUMN write under RLS via the AUTHENTICATED client (NEVER service-role).
  //    `showcase_opt_in` is NOT a protected column (028 left it out of the
  //    enforce_protected_profile_columns guard, D-06), so the owner flips it directly.
  //    EXPLICIT single-column allowlist over the PARSED value — never a spread, never
  //    the raw `optIn`. Scope to the caller's OWN row — a cross-tenant target silently
  //    changes 0 rows (RLS USING clause, T-31-02).
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ showcase_opt_in: parsed })
    .eq('id', sub); // WR-05: `sub` guaranteed present (no `?? ''`).
  if (error) return { ok: false, error: SAVE_FAILED };

  // 5) Revalidate the public Explore gallery so it reflects the change within seconds
  //    (D-12). Fires on BOTH opt-in and opt-out. LITERAL path, NO second arg (CLAUDE.md).
  revalidatePath('/explore');

  // 6) Success — the toggle settles into its saved state.
  return { ok: true };
}
