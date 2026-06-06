'use server';

/**
 * template-gating-actions — the GATE-04 operator surface write path (12-05).
 *
 * Four admin actions backing /admin/templates: flip a template's visibility,
 * grant/revoke a restricted template to/from a user, and resolve an email/username
 * to a user id for granting. Operator-only, runtime data — ingestion stays a
 * dev/code task (no registration UI). Each mirrors the SHARED-A write shape proven
 * by `lock-action.ts`, with ONE load-bearing divergence:
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ AUTHENTICATED ADMIN-RLS, NOT THE ELEVATED CLIENT (D-P12-16, LOAD-BEARING):    │
 * │ Every grant/visibility write goes through the AUTHENTICATED `createClient()`  │
 * │ under the `templates admin all` (004:239) + `template_grants admin all` (012) │
 * │ RLS policies — there is NO elevated/bypass-RLS client import in this file.    │
 * │ lock-action.ts uses the elevated client ONLY because it flips PROTECTED        │
 * │ columns on ANOTHER user's profile (the protected-columns trigger short-        │
 * │ circuits only for that path). The Phase-12 gating tables have NO protected-    │
 * │ columns trigger + an admin-all RLS policy, so the authenticated admin client   │
 * │ IS the authorization boundary. The ONE cross-user write (the auto-fallback)    │
 * │ is a SECURITY DEFINER RPC whose body self-gates with `is_admin()` (12-02).     │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * DEFENSE-IN-DEPTH (T-06-18): each action is independently callable, so each calls
 * `callerIsAdmin()` FIRST — the `(admin)` route-group gate is the first line, but
 * the action owns its own gate. `callerIsAdmin()` is copied VERBATIM from
 * `lock-action.ts:67-81` (reads the caller's OWN `profiles.role` under RLS).
 *
 * AUTO-FALLBACK (D-P12-10/11): a revoke OR a public→restricted flip can leave users
 * on a template they are no longer allowed — the `fallback_ungranted_to_editorial`
 * DEFINER RPC (12-02) repoints those portfolios onto editorial LOSSLESSLY and
 * returns the affected usernames; this action then `revalidatePath('/' + username)`
 * (LITERAL path, NO second arg — R-1 / Pitfall 1) for EACH so the public ISR page
 * regenerates onto editorial within minutes. flip→public KEEPS grant rows (D-P12-15)
 * — it touches ONLY `templates.visibility`.
 *
 * Source: `callerIsAdmin()` + the SHARED-A shape + the literal-path revalidate from
 * `lock-action.ts`; `templateVisibilitySchema` / `uuidForSlug` from `registry.ts`
 * (12-03); the two gating RPCs from migration 012.
 */
import { revalidatePath } from 'next/cache';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { templateVisibilitySchema, uuidForSlug } from '@/components/templates/registry';

/**
 * The shared admin-action outcome. `{ ok: true }` on success; `{ ok: false }` on a
 * not-admin / not-signed-in / write failure — the action NEVER leaks which guard
 * rejected (generic shape, mirrors `LockActionResult`).
 */
export type GatingActionResult = { ok: true } | { ok: false };

/**
 * The `lookupUser` outcome. On a hit the operator gets exactly what they need to
 * grant (`id`) plus the recognisable `username`/`email`. On a miss it returns the
 * SAME generic `{ ok: false }` shape — enumeration-conscious even on this admin-only
 * surface (the operator learns "no account found", nothing more).
 */
export type LookupUserResult =
  | { ok: true; user: { id: string; username: string; email: string } }
  | { ok: false };

/**
 * Re-assert the caller is an admin (defense-in-depth over the `(admin)` route-group
 * gate). Reads the caller's OWN `profiles.role` under RLS via the AUTHENTICATED
 * client. A null claim / missing `sub` / non-admin role all return `false` (no
 * write). Copied verbatim from `lock-action.ts:67-81`.
 */
async function callerIsAdmin(): Promise<boolean> {
  const claims = await getVerifiedClaims();
  if (!claims) return false;
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', sub)
    .single();
  if (error) return false;
  return (data as { role?: string } | null)?.role === 'admin';
}

/**
 * Read the verified caller's subject (used as `granted_by` on a grant insert). A
 * null claim / missing `sub` returns `null` — the caller has already passed
 * `callerIsAdmin()`, so this is the audit-subject read, not a gate.
 */
async function callerSub(): Promise<string | null> {
  const claims = await getVerifiedClaims();
  if (!claims) return null;
  return (claims as { sub?: string }).sub ?? null;
}

/**
 * Run the cross-user auto-fallback for `templateId` and revalidate each affected
 * user's public path. The DEFINER RPC (12-02) self-gates with `is_admin()`, repoints
 * only ungranted-on-this-template portfolios onto editorial (lossless), and returns
 * the affected usernames. We revalidate EACH so the now-editorial page regenerates
 * promptly. A bad/empty result is a calm no-op (no users were affected).
 */
async function runFallbackAndRevalidate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('fallback_ungranted_to_editorial', {
    p_template_id: templateId,
  });
  if (error) return; // RPC self-gate / transient error — calm no-op
  for (const row of (data ?? []) as { username: string }[]) {
    // LITERAL path, NO second arg (R-1 / Pitfall 1 / CLAUDE.md).
    revalidatePath('/' + row.username);
  }
}

/**
 * Flip a template's visibility (public ↔ restricted). Admin-only.
 *
 * Re-parses `visibility` through `templateVisibilitySchema` (the V5 / T-12-05-INPUT
 * gate — `templates.visibility` has NO Postgres CHECK, Zod is the source of truth),
 * writes `templates.visibility` via the AUTHENTICATED admin-RLS client (gated by the
 * EXISTING `templates admin all`, NO new policy), then — ONLY on a flip to
 * `'restricted'` — runs the auto-fallback for any users now ungranted on it and
 * revalidates each. Flipping to `'public'` does NOT touch grants (D-P12-15).
 */
export async function setTemplateVisibility(
  slug: string,
  visibility: string,
): Promise<GatingActionResult> {
  // 1+2) Verified identity + admin re-check (T-06-18). A non-admin never writes.
  if (!(await callerIsAdmin())) return { ok: false };

  // 3) Zod re-parse — the only accepted values are the soft-enum members.
  const parsed = templateVisibilitySchema.safeParse(visibility);
  if (!parsed.success) return { ok: false };

  // 4) Admin-RLS UPDATE of the single `visibility` column (authenticated client only).
  const supabase = await createClient();
  const { error } = await supabase
    .from('templates')
    .update({ visibility: parsed.data })
    .eq('slug', slug);
  if (error) return { ok: false };

  // 5) On flip→restricted ONLY: auto-fallback the now-ungranted users + revalidate
  //    each. flip→public keeps grants and needs no fallback (D-P12-15).
  if (parsed.data === 'restricted') {
    await runFallbackAndRevalidate(supabase, uuidForSlug(slug));
  }

  return { ok: true };
}

/**
 * Grant a (restricted) template to a user. Admin-only.
 *
 * Inserts the `(template_id, user_id)` grant via the AUTHENTICATED admin-RLS client
 * (`template_grants admin all`), stamping `granted_by` with the operator's subject
 * for audit. Idempotent: a duplicate insert (the row already exists) is treated as
 * success — the grant is present either way.
 */
export async function grantTemplate(
  slug: string,
  userId: string,
): Promise<GatingActionResult> {
  // 1+2) Verified identity + admin re-check.
  if (!(await callerIsAdmin())) return { ok: false };

  const sub = await callerSub();
  if (!sub) return { ok: false };

  // 3) Admin-RLS INSERT (authenticated client only). The composite PK makes a re-grant a
  //    duplicate-key error — treat that as success (the grant is present).
  const supabase = await createClient();
  const { error } = await supabase
    .from('template_grants')
    .insert({ template_id: uuidForSlug(slug), user_id: userId, granted_by: sub });
  if (error && error.code !== '23505') return { ok: false };

  return { ok: true };
}

/**
 * Revoke a template grant from a user. Admin-only.
 *
 * Deletes the `(template_id, user_id)` grant via the AUTHENTICATED admin-RLS client,
 * then runs the auto-fallback for that template — the now-ungranted user's portfolio
 * (if it was on this restricted template) is repointed onto editorial losslessly and
 * the action revalidates each returned username. A revoke of a grant on a PUBLIC
 * template is harmless: the fallback's `NOT EXISTS`-grant predicate still holds, but
 * a public template is reachable by everyone so no portfolio is ungranted on it.
 */
export async function revokeGrant(
  slug: string,
  userId: string,
): Promise<GatingActionResult> {
  // 1+2) Verified identity + admin re-check.
  if (!(await callerIsAdmin())) return { ok: false };

  const templateId = uuidForSlug(slug);

  // 3) Admin-RLS DELETE (authenticated client only), scoped to the composite key.
  const supabase = await createClient();
  const { error } = await supabase
    .from('template_grants')
    .delete()
    .eq('template_id', templateId)
    .eq('user_id', userId);
  if (error) return { ok: false };

  // 4) The now-ungranted user falls back to editorial (lossless) + revalidate.
  await runFallbackAndRevalidate(supabase, templateId);

  return { ok: true };
}

/**
 * Read the impact count for a flip→restricted or revoke confirm. Admin-only.
 *
 * Returns how many users would be moved to editorial (the count + their usernames)
 * via the purpose-built `count_ungranted_on_template` DEFINER read (12-02) — NOT a
 * broad `portfolios admin select` (Pitfall 1 / T-12-05-LEAK — keeps admin's reach
 * narrow). The panel calls this BEFORE the destructive action: a count of 0 skips
 * the confirm entirely (D-P12-11); a count > 0 opens the impact-note dialog. On a
 * non-admin / error this returns `{ ok: false }` so the panel can fail safe.
 */
export async function templateImpactCount(
  slug: string,
): Promise<{ ok: true; count: number; usernames: string[] } | { ok: false }> {
  if (!(await callerIsAdmin())) return { ok: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('count_ungranted_on_template', {
    p_template_id: uuidForSlug(slug),
  });
  if (error) return { ok: false };

  // The DEFINER read returns a single row { n, usernames }.
  const row = ((data ?? []) as { n: number; usernames: string[] }[])[0];
  return {
    ok: true,
    count: row?.n ?? 0,
    usernames: row?.usernames ?? [],
  };
}

/**
 * Resolve an email OR username to an existing account for granting (D-P12-06).
 * Admin-only.
 *
 * Reads `profiles` via the AUTHENTICATED admin-RLS client (`profiles admin select`,
 * 004:89) with TWO parameterised `.eq()` reads — email first, then username
 * (T-12-05-INPUT: each value is bound by the Supabase client, NEVER interpolated
 * into a filter string like `.or('email.eq.' + needle)`, which would let a `,`/`)`
 * in the input break out of the PostgREST filter grammar). The lookup is trimmed +
 * lower-cased to match the canonical-email / username storage. A miss returns the
 * SAME generic `{ ok: false }` shape (enumeration-conscious even on this admin-only
 * surface).
 */
export async function lookupUser(
  emailOrUsername: string,
): Promise<LookupUserResult> {
  if (!(await callerIsAdmin())) return { ok: false };

  const needle = emailOrUsername.trim().toLowerCase();
  if (needle.length === 0) return { ok: false };

  const supabase = await createClient();

  // Parameterised email match first.
  const byEmail = await supabase
    .from('profiles')
    .select('id, username, email')
    .eq('email', needle)
    .maybeSingle();
  if (byEmail.error) return { ok: false };
  if (byEmail.data) {
    return {
      ok: true,
      user: {
        id: byEmail.data.id,
        username: byEmail.data.username,
        email: byEmail.data.email,
      },
    };
  }

  // Fall back to a parameterised username match.
  const byUsername = await supabase
    .from('profiles')
    .select('id, username, email')
    .eq('username', needle)
    .maybeSingle();
  if (byUsername.error || !byUsername.data) return { ok: false };

  return {
    ok: true,
    user: {
      id: byUsername.data.id,
      username: byUsername.data.username,
      email: byUsername.data.email,
    },
  };
}
