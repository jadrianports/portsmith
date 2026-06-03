'use server';

/**
 * switch-template-action — the lossless template switch write (TMPL-02 /
 * D-P7-13b). The presentation HALF of the decoupling proof: the owner picks a
 * different template and the public page re-renders under the new template,
 * while EVERY content row (`sections.content` JSONB) is untouched BY
 * CONSTRUCTION — this action mutates ONLY `portfolios.template_id` (+ the
 * `updated_at` Postgres bumps), never a content column.
 *
 * Clones the CANONICAL SHARED-A skeleton proven by `publish-action.ts` (04-05)
 * / `save-section-action.ts` (04-03): the server boundary OWNS the gate, the
 * sequence is invariant (a failure at step N never reaches step N+1), and the
 * revalidate uses the literal `'/' + username` path with NO second arg. The ONE
 * addition vs publish-action is a Zod slug gate — publish-action's payload is a
 * bare `boolean` (nothing to parse); here the untrusted `slug` string crosses
 * the trust boundary, so `templateSlugSchema.safeParse` rejects an unknown /
 * crafted slug BEFORE `uuidForSlug` or the write (V5 / T-07-10):
 *
 *   1. getVerifiedClaims()      — verified JWT identity (AUTH-05). NEVER the
 *      unverified, spoofable cookie-session getter. A null claim ⇒ { ok:false }.
 *      A verified claim MISSING `sub` is a HARD auth failure (WR-05 / T-07-11) —
 *      NEVER coerced to '' (which would scope the UPDATE to a non-existent row
 *      and silently switch 0 rows while appearing to succeed).
 *   2. templateSlugSchema.safeParse(slug) — the V5 Zod gate. `!success` ⇒
 *      { ok:false, error:'Unknown template.' } with NO write (T-07-10). The
 *      single source of truth is the registry's `templateSlugSchema` (derived
 *      from the registry keys), so a 3rd template auto-extends the gate.
 *   3. SINGLE-COLUMN write under RLS via the AUTHENTICATED client. The SHARED-4
 *      deviations vs publish-action: the row lives in `portfolios` (NOT
 *      `profiles`), scoped to the caller's OWN row via `.eq('user_id', sub)`
 *      (portfolios.user_id is the UNIQUE FK to the auth id, 001:95 — NOT
 *      `.eq('id', sub)`). We write ONLY `{ template_id }` — never spread an
 *      unfiltered object. RLS (`portfolios own all`, 004:107-110) is THE
 *      boundary: a cross-tenant target silently changes 0 rows (T-07-09, proven
 *      by the clientA/clientB RLS integration, NEVER adminClient for the
 *      boundary — Pitfall 7). On a write error ⇒ the UI-SPEC B.8 copy.
 *   4. revalidatePath('/' + username) — on-demand ISR purge so the new template
 *      shows within seconds. LITERAL path, NO second arg (RESEARCH Pitfall 5 /
 *      the CLAUDE.md correction — the 'max' / { expire:0 } profile belongs to
 *      revalidateTag, a DIFFERENT function). `portfolios` carries no `username`,
 *      so the revalidate target comes from a SEPARATE `profiles.select(
 *      'username').eq('id', sub)` read (the verified identity, never the request
 *      host — SHARED-2).
 *   5. Return { ok: true }.
 *
 * Source: the SHARED-A skeleton from `publish-action.ts`; the verified-claims
 * guard + clients from `@/lib/supabase/server.ts`; `templateSlugSchema` +
 * `uuidForSlug` from the template registry (the single slug↔UUID source of
 * truth, D-P7-13 / Pitfall 3); revalidatePath signature [VERIFIED: Next 16.2.6].
 */
import { revalidatePath } from 'next/cache';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { templateSlugSchema, uuidForSlug } from '@/components/templates/registry';

/**
 * The switch outcome. `{ ok: true }` on success; `{ ok: false }` (optionally
 * with an `error`) on a not-signed-in / unknown-slug / write failure — the same
 * discriminated-union shape the other CMS write actions return (SHARED-A), so
 * the template-picker control handles results identically.
 */
export type SwitchTemplateResult = { ok: true } | { ok: false; error?: string };

const NOT_SIGNED_IN = 'Not signed in.';
const UNKNOWN_TEMPLATE = 'Unknown template.';
// UI-SPEC §B.8 verbatim — the write-failure copy the template picker surfaces.
const SWITCH_FAILED = 'We couldn’t switch your template. Please try again.';

/**
 * Switch the owner's portfolio to a different template. Mutates ONLY
 * `portfolios.template_id` (the lossless guarantee — content rows are untouched
 * by construction), then literal-path revalidates the public page so the new
 * template renders within seconds.
 *
 * @param slug The target template slug (untrusted; gated by `templateSlugSchema`).
 */
export async function switchTemplateAction(slug: string): Promise<SwitchTemplateResult> {
  // 1) Verified identity (AUTH-05 — never getSession). Drives the revalidate path.
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // WR-05 / T-07-11: a verified claim MUST carry a subject. A missing `sub` is a
  // HARD auth failure — never coerce it to '' (which would scope the UPDATE to a
  // non-existent row and silently switch 0 rows while appearing to succeed).
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 2) V5 Zod gate (T-07-10): reject an unknown / crafted slug BEFORE uuidForSlug
  //    or the write. The single source of truth is the registry's
  //    `templateSlugSchema` (derived from the registry keys).
  const parsed = templateSlugSchema.safeParse(slug);
  if (!parsed.success) return { ok: false, error: UNKNOWN_TEMPLATE };

  // 3) SINGLE-COLUMN write under RLS via the AUTHENTICATED client (never
  //    service-role). SHARED-4 deviations vs publish-action: the row is in
  //    `portfolios` (NOT `profiles`), scoped to the caller's OWN row via
  //    `.eq('user_id', sub)` (portfolios.user_id is the UNIQUE FK, 001:95 — NOT
  //    `.eq('id', sub)`). Write ONLY `{ template_id }`. RLS (`portfolios own
  //    all`) is THE boundary — a cross-tenant target silently changes 0 rows
  //    (T-07-09). On error ⇒ the UI-SPEC B.8 copy.
  const templateId = uuidForSlug(parsed.data);
  const supabase = await createClient();
  const { error } = await supabase
    .from('portfolios')
    .update({ template_id: templateId })
    .eq('user_id', sub); // WR-05: `sub` guaranteed present (no `?? ''`); SHARED-4: user_id, not id.
  if (error) return { ok: false, error: SWITCH_FAILED };

  // 4) Resolve the username from a SEPARATE profiles read (portfolios has no
  //    username column) to drive the revalidate — the verified identity, never
  //    the request host (SHARED-2). LITERAL path, NO second arg (Pitfall 5).
  const { data: prof } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', sub)
    .single();
  const username = (prof as { username?: string } | null)?.username;
  if (username) {
    revalidatePath('/' + username);
  }

  // 5) Success — the template picker fires its confirmation beat.
  return { ok: true };
}
