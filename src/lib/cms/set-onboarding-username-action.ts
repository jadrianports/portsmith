'use server';

/**
 * setOnboardingUsernameAction — the D-06 onboarding handle-edit write path (OAUTH-03).
 *
 * The onboarding "Your URL" step (Plan 04) lets a first-time user confirm or change
 * the handle the `handle_new_user` trigger assigned them (collision-safe, but possibly
 * suffixed — `johndoe7`). `username` is a PROTECTED column: an ordinary authenticated
 * UPDATE is blocked by `enforce_protected_profile_columns`. The ONLY legal path is the
 * sanctioned `set_onboarding_username` RPC (migration 026), a SECURITY DEFINER function
 * gated on `auth.uid()` and scoped to the caller's own NOT-YET-ONBOARDED row, which
 * sets a txn-local GUC the protected-columns trigger honors for exactly that one change.
 *
 * SHARED-A write sequence (every 'use server' CMS write — a failure at step N never
 * reaches N+1):
 *   1. getVerifiedClaims() — verified JWT identity (AUTH-05). NEVER getSession.
 *      WR-05: a verified claim MUST carry a `sub` — hard-fail on a missing one,
 *      never coerce to '' (which would mask the invariant violation).
 *   2. Zod re-parse with `usernameSchema` (the SERVER gate — format + reserved). On
 *      failure return `{ ok:false, fieldErrors: { username } }` so the step shows it inline.
 *   3. Call the sanctioned RPC under the AUTHENTICATED RLS client (`createClient()`) —
 *      NEVER service-role / `supabaseAdmin`, NEVER a raw `.from('profiles').update`
 *      (the protected-columns trigger blocks the raw write; the RPC's GUC sanction is
 *      the only path past it, and only for the own-row, not-yet-onboarded, username-only
 *      change). The RPC re-checks the SAME format + reserved set (CR-03) — double gate.
 *   4. revalidatePath('/' + parsed) — LITERAL path, NO second arg (CLAUDE.md Pitfall 1;
 *      the 'max' profile belongs to revalidateTag, a different function).
 *   5. return { ok: true }.
 *
 * Result shape is the discriminated union `{ ok:true } | { ok:false; error?; fieldErrors? }`
 * — it NEVER throws to the caller; messages stay generic (no internal-detail leak).
 *
 * Source: the getVerifiedClaims → `sub` guard pattern from add-section-action.ts /
 * login-action.ts; the sanctioned-RPC call convention from add-section-action.ts
 * (`supabase.rpc(...)` under the authenticated client); the `set_onboarding_username`
 * RPC + protected-column carve-out from migration 026 (Plan 01); usernameSchema from
 * the `@/lib/validations` barrel; revalidatePath signature [VERIFIED: Next 16.2.6].
 */
import { revalidatePath } from 'next/cache';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { usernameSchema } from '@/lib/validations';

/** The handle-write outcome — generic on failure; an inline field error on a bad handle. */
export type SetOnboardingUsernameResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: { username?: string } };

const NOT_SIGNED_IN = 'Not signed in.';
const WRITE_FAILED = 'Something went wrong saving your URL. Please try again.';

/**
 * Set the caller's onboarding handle (the protected `username` column) through the
 * sanctioned `set_onboarding_username` RPC. Scoped server-side to the caller's own
 * not-yet-onboarded row by the RPC; this action never trusts a client-supplied id.
 *
 * @param input.username The desired handle (re-validated by `usernameSchema` here AND
 *   by the RPC's mirrored guards). On an invalid handle the field error surfaces inline.
 */
export async function setOnboardingUsernameAction(input: {
  username: string;
}): Promise<SetOnboardingUsernameResult> {
  // 1) Verified identity (AUTH-05 — never getSession). WR-05: a missing `sub` is a
  //    hard auth failure, never coerced to '' (which would mask the invariant break).
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 2) Zod re-parse — the SERVER gate (client parse is UX only). Format + reserved.
  const parsed = usernameSchema.safeParse(input.username);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'That username is not valid.';
    return { ok: false, fieldErrors: { username: message } };
  }

  // 3) Sanctioned RPC under the AUTHENTICATED RLS client — NEVER service-role, NEVER a
  //    raw profiles UPDATE (the protected-columns trigger blocks it; the RPC's txn-local
  //    GUC is the only legal path, scoped to the own not-yet-onboarded row). The RPC
  //    re-checks the SAME format + reserved set (CR-03). A collision/blocked write
  //    surfaces as an rpcError → generic { ok:false } (no throw/500, no detail leak).
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc('set_onboarding_username', {
    new_username: parsed.data,
  });
  if (rpcError) {
    // A unique-violation (handle taken between the live check and here) or any other
    // RPC failure returns the SAME generic message — no enumeration / internal leak.
    return { ok: false, error: WRITE_FAILED };
  }

  // 4) revalidatePath('/' + username) — LITERAL path, NO second arg (Pitfall 1). The
  //    public page is purged so the new handle's URL is fresh (it 404s until publish,
  //    but the revalidate keeps the ISR cache consistent with the handle change).
  revalidatePath('/' + parsed.data);

  // 5) Success.
  return { ok: true };
}
