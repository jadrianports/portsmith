'use server';

/**
 * changeUsernameAction — the HANDLE-01 / HANDLE-03 owner-initiated username-change write
 * path. Mirrors set-onboarding-username-action.ts (the SHARED-A skeleton) with three
 * additions for the post-onboarding change: a no-op short-circuit, a fail-CLOSED 30-day
 * cooldown gate (D-06), and a dual-path revalidate (old + new URL).
 *
 * `username` is a PROTECTED column — the ONLY legal change path is the sanctioned
 * `change_username` SECURITY DEFINER RPC (migration 027), which sets a txn-local GUC the
 * `enforce_protected_profile_columns` trigger honors for the own-row, onboarded,
 * username-only change. This action NEVER uses service-role / `supabaseAdmin` and NEVER a
 * raw `.from('profiles').update({ username })` (the trigger blocks it; the RPC's GUC is
 * the only path past it).
 *
 * SHARED-A + Phase-30 sequence (a failure at step N never reaches N+1):
 *   1. getVerifiedClaims() — verified JWT identity (AUTH-05; never getSession). WR-05:
 *      a missing `sub` is a hard auth failure, never coerced to '' .
 *   2. usernameSchema re-parse (the SERVER gate — format + reserved). On failure →
 *      `{ ok:false, fieldErrors:{ username } }`.
 *   3. Read the caller's CURRENT handle (own-row authenticated read) — powers the no-op
 *      guard AND the dual-path revalidate.
 *   4. NO-OP guard: parsed == current → `{ ok:true }` WITHOUT touching the cooldown or
 *      the RPC (no history row, no cooldown burn).
 *   5. COOLDOWN (D-06, fail-CLOSED): countAndRecord('username_change', sub, 30d, 1,
 *      { failClosed: true }). On denial → a generic, DATED `{ ok:false, error }` (no cap
 *      leak). The exact per-user date needs the service-role ledger (which this owner-
 *      authenticated action must not touch), so the message carries the conservative
 *      upper bound `now + 30d`; the precise date is surfaced by the settings UI.
 *   6. change_username RPC under the AUTHENTICATED RLS client (`createClient()`). On
 *      rpcError (incl. a union-uniqueness collision) → the generic `{ ok:false, error }`.
 *   7. Dual-path revalidate: revalidatePath('/' + old) AND revalidatePath('/' + new) —
 *      both LITERAL, NO second arg (CLAUDE.md Pitfall 1).
 *   8. return { ok: true }.
 *
 * Result shape is the discriminated union — it NEVER throws to the caller; messages stay
 * generic (no enumeration / cap / internal-detail leak).
 */
import { revalidatePath } from 'next/cache';

import { countAndRecord } from '@/lib/rate-limit/ledger';
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { usernameSchema } from '@/lib/validations';

import { THIRTY_DAYS_MS, formatNextAllowedDate } from './username-cooldown';

/** The change outcome — generic on failure; an inline field error on a bad handle. */
export type ChangeUsernameResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: { username?: string } };

const NOT_SIGNED_IN = 'Not signed in.';
const WRITE_FAILED = 'Something went wrong changing your username. Please try again.';

/**
 * Change the caller's handle (the protected `username` column) through the sanctioned
 * `change_username` RPC, gated by verified identity, a Zod re-parse, and a fail-closed
 * 30-day cooldown. Scoped server-side to the caller's own onboarded row by the RPC; this
 * action never trusts a client-supplied id.
 *
 * @param input.username The desired handle (re-validated here AND by the RPC's mirrored
 *   guards). An invalid/reserved handle surfaces as an inline field error.
 */
export async function changeUsernameAction(input: {
  username: string;
}): Promise<ChangeUsernameResult> {
  // 1) Verified identity (never getSession). WR-05: a missing `sub` is a hard auth fail.
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

  const supabase = await createClient();

  // 3) Read the caller's CURRENT handle (own-row authenticated read) for the no-op guard
  //    + the dual-path revalidate. RLS scopes this to the owner's row.
  const { data: current, error: readError } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', sub)
    .single();
  if (readError || !current?.username) {
    return { ok: false, error: WRITE_FAILED };
  }
  const oldUsername = current.username;

  // 4) NO-OP: changing to the current handle does nothing — no cooldown burn, no RPC
  //    write (the RPC also RETURNs early, but short-circuiting here keeps the cooldown
  //    untouched and avoids an unnecessary round-trip).
  if (oldUsername === parsed.data) {
    return { ok: true };
  }

  // 5) COOLDOWN (D-06) — fail-CLOSED for this product-limit bucket: one change / 30 days.
  //    A transient count error DENIES (the failClosed flag). On denial, return a generic
  //    DATED message (no cap leak). The exact next-allowed instant lives in the service-
  //    role ledger this owner action must not read, so the copy carries the conservative
  //    upper bound `now + 30d`; the settings UI surfaces the precise date (Plan 05).
  const allowed = await countAndRecord('username_change', sub, THIRTY_DAYS_MS, 1, {
    failClosed: true,
  });
  if (!allowed) {
    const nextAllowed = formatNextAllowedDate(Date.now() + THIRTY_DAYS_MS);
    return {
      ok: false,
      error: `You can change your username again on ${nextAllowed}.`,
    };
  }

  // 6) Sanctioned RPC under the AUTHENTICATED RLS client — NEVER service-role, NEVER a
  //    raw profiles UPDATE. A union-uniqueness collision / blocked write surfaces as an
  //    rpcError → the SAME generic message (no enumeration / internal leak).
  const { error: rpcError } = await supabase.rpc('change_username', {
    new_username: parsed.data,
  });
  if (rpcError) {
    return { ok: false, error: WRITE_FAILED };
  }

  // 7) Dual-path revalidate (both LITERAL, NO second arg — Pitfall 1): the OLD path so
  //    /old re-renders into its 308 redirect, and the NEW path so the new URL is fresh.
  revalidatePath('/' + oldUsername);
  revalidatePath('/' + parsed.data);

  // 8) Success.
  return { ok: true };
}
