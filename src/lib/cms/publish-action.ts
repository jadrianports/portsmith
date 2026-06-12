'use server';

/**
 * publish-action — the portfolio-level publish/unpublish write (PUB-01 / PUB-02 /
 * D-P4-02). The publish HALF of the loop: the owner flips their portfolio between
 * Draft and Live, and the public page goes live or 404s within seconds.
 *
 * Mirrors the CANONICAL SHARED-A skeleton proven by `save-section-action.ts`
 * (04-03) and `save-profile-action.ts` (04-04): the server boundary OWNS the
 * gate, the sequence is invariant (a failure at step N never reaches step N+1),
 * and the revalidate uses the literal `'/' + username` path with NO second arg.
 * The ONE thing this action is NOT is Zod-gated — the payload is a single
 * `boolean`, so there is no content schema to re-parse; the gate here is purely
 * the verified-identity guard + the RLS-scoped, single-column write:
 *
 *   1. getVerifiedClaims()      — verified JWT identity (AUTH-05). NEVER the
 *      unverified, spoofable cookie-session getter. A null claim ⇒ { ok:false }.
 *      Drives the username for the revalidate (the identity, never the request
 *      host — PUB-03 / T-04-06c).
 *   2. SINGLE-COLUMN write under RLS — `.update({ published }).eq('id', sub)`.
 *      `published` is NOT one of the 8 columns guarded by the
 *      `enforce_protected_profile_columns` trigger (002:108-118 — verified
 *      ABSENT), so the owner flips it DIRECTLY under RLS (the profiles own-update
 *      policy). This is the designed capability, not an escalation (T-04-06b).
 *      We still write ONLY the `published` column — never spread an unfiltered
 *      object — and scope it to the caller's OWN row via `.eq('id', claims.sub)`,
 *      so a cross-tenant publish silently affects 0 rows (RLS USING clause). The
 *      integration test proves a cross-tenant publish is rejected (T-04-06a).
 *   3. revalidatePath('/' + username) — on-demand ISR purge so the live/404 flip
 *      shows within seconds (PUB-01 / D-P4-02). LITERAL path, NO second arg
 *      (RESEARCH Pitfall 1, the one CLAUDE.md correction — the 'max' / { expire:0 }
 *      profile belongs to revalidateTag, a DIFFERENT function). Username from the
 *      verified profile row (the `select('username')` on the same write), NEVER the
 *      request host.
 *   4. Return { ok: true }.
 *
 * PUB-02 needs NO new code: setting `published=false` makes `portfolio_is_public()`
 * (002:138-150) false → the `public_*` views return NOTHING → the public read
 * returns null → `[username]/page.tsx` already `notFound()`s. The 404 chain is the
 * SAME one `get-portfolio.ts` already relies on; this action only flips the bit.
 *
 * Publishing is NOT confirmed and is frictionless (it is safe, reversible, and the
 * goal); the confirm asymmetry — only UNpublishing carries a confirm — lives in
 * the `publish-toggle.tsx` control (UI-SPEC §12), not here.
 *
 * Source: the SHARED-A skeleton from `save-section-action.ts`; the
 * verified-claims guard from `@/lib/supabase/server.ts`; the action shape from the
 * 04-RESEARCH.md "Publish/unpublish" snippet (distilled from these);
 * revalidatePath signature [VERIFIED: Next 16.2.6].
 */
import { revalidatePath } from 'next/cache';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

/**
 * The publish outcome. `{ ok: true }` on success; `{ ok: false }` (optionally with
 * an `error`) on a not-signed-in / write failure — the same discriminated-union
 * shape the other CMS write actions return (SHARED-A), so the publish control
 * handles results identically.
 */
export type SetPublishedResult = { ok: true } | { ok: false; error?: string };

const NOT_SIGNED_IN = 'Not signed in.';
const UPDATE_FAILED = 'We couldn’t update your page. Please try again.';

/**
 * Flip the owner's portfolio between Live (`published=true`) and Draft
 * (`published=false`). Frictionless publish; unpublish friction lives in the UI.
 *
 * @param published `true` → Live; `false` → Draft (the public page 404s via the
 *   existing `portfolio_is_public` predicate, PUB-02).
 */
export async function setPublished(published: boolean): Promise<SetPublishedResult> {
  // 1) Verified identity (AUTH-05 — never getSession). Drives the revalidate path.
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // WR-05: a verified claim MUST carry a subject. Treat a missing `sub` as a hard
  // auth failure — never coerce it to '' (which would scope the publish UPDATE to a
  // non-existent row and silently flip 0 rows, so the user's publish appears to
  // succeed while nothing changed).
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 2) SINGLE-COLUMN write under RLS via the AUTHENTICATED client (never
  //    service-role). `published` is NOT a protected column (verified absent from
  //    the 002:108-118 guard list), so the owner flips it directly. Scope to the
  //    caller's OWN row — a cross-tenant target silently changes 0 rows
  //    (T-04-06a). Select the username back on the same write to drive the
  //    revalidate (the verified identity, never the request host — PUB-03).
  const supabase = await createClient();
  const { data: prof, error } = await supabase
    .from('profiles')
    .update({ published })
    .eq('id', sub) // WR-05: `sub` guaranteed present (no `?? ''`).
    .select('username')
    .single();
  if (error) return { ok: false, error: UPDATE_FAILED };

  // 3) Revalidate the public page so the live/404 flip is within seconds (PUB-01 /
  //    D-P4-02). LITERAL path, NO second arg (RESEARCH Pitfall 1 / CLAUDE.md).
  const username = (prof as { username?: string } | null)?.username;
  if (username) {
    revalidatePath('/' + username);
  }

  // 4) Success — the control fires the publish beat / the calm unpublish flip.
  return { ok: true };
}

/**
 * Mark the owner FINISHED with onboarding AND flip their portfolio Live in ONE
 * authenticated RLS write (ONB-06 / ONB-05 / D-14). This is the canonical
 * "finished onboarding" write the wizard's Publish step calls: it is `setPublished`'s
 * thin sibling, identical in every respect EXCEPT the write payload is a TWO-COLUMN
 * allowlist — `{ published: true, onboarded_at }` — so the same single write both
 * publishes and durably stamps WHEN the user completed onboarding.
 *
 * `onboarded_at` (like `published`) is NOT one of the 8 columns guarded by the
 * `enforce_protected_profile_columns` trigger (002:108-118 — verified ABSENT), so the
 * owner writes it DIRECTLY under RLS (the profiles own-update policy). We write ONLY
 * the explicit two columns — never spread `...parsed`/`...input` — and scope to the
 * caller's OWN row via `.eq('id', sub)`, so a cross-tenant call silently stamps 0 rows
 * (RLS USING clause). NEVER service-role: this file imports `createClient`, not
 * `supabaseAdmin`. The integration proof (onboarding-publish.test.ts) shows the
 * own-row write succeeds and the cross-tenant write leaves `onboarded_at` UNCHANGED.
 *
 * `onboarded_at` is set from the SERVER's `new Date().toISOString()`, never client
 * input — the "when" is authoritative and unforgeable (T-18-publish-stamp). Phase 21's
 * activation funnel later consumes this timestamp.
 *
 * Why a SEPARATE action and not a `setPublished` param: `setPublished` is reused by the
 * editor toggle AND the preview banner (a plain Live/Draft flip that must NOT re-stamp
 * onboarding on every toggle); the wizard's terminal publish is the ONE moment that
 * marks the user finished (ONB-05 — never forced back through onboarding). Keeping them
 * separate keeps `setPublished` byte-unchanged and every existing publish test green.
 */
export async function markOnboardedAndPublish(): Promise<SetPublishedResult> {
  // 1) Verified identity (AUTH-05 — never getSession). Drives the revalidate path.
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // WR-05: a verified claim MUST carry a subject. Treat a missing `sub` as a hard
  // auth failure — never coerce it to '' (which would scope the UPDATE to a
  // non-existent row and silently stamp 0 rows, so the wizard's publish appears to
  // succeed while the user is never marked onboarded — and would re-show the wizard).
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 2) TWO-COLUMN write under RLS via the AUTHENTICATED client (never service-role).
  //    Both `published` and `onboarded_at` are NOT protected columns (verified absent
  //    from the 002:108-118 guard list), so the owner writes them directly. EXPLICIT
  //    2-col allowlist — never spread an unfiltered object. Scope to the caller's OWN
  //    row — a cross-tenant target silently stamps 0 rows (T-18-publish-stamp). Select
  //    the username back on the same write to drive the revalidate (the verified
  //    identity, never the request host — PUB-03). `onboarded_at` is the server's clock
  //    (`new Date().toISOString()`), never client input — the "when" is unforgeable.
  const supabase = await createClient();
  const { data: prof, error } = await supabase
    .from('profiles')
    .update({ published: true, onboarded_at: new Date().toISOString() })
    .eq('id', sub) // WR-05: `sub` guaranteed present (no `?? ''`).
    .select('username')
    .single();
  if (error) return { ok: false, error: UPDATE_FAILED };

  // 3) Revalidate the public page so the live/404 flip is within seconds (PUB-01 /
  //    D-P4-02). LITERAL path, NO second arg (RESEARCH Pitfall 1 / CLAUDE.md).
  const username = (prof as { username?: string } | null)?.username;
  if (username) {
    revalidatePath('/' + username);
  }

  // 4) Success — the wizard's terminal Publish step lands the user on their live page.
  return { ok: true };
}
