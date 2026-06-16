'use server';

/**
 * saveSettingsAction — the Contact & Socials CMS write (SET-01/03/04, D-12/D-13).
 *
 * The SHARED-A write path that did not previously exist for `portfolio_settings`.
 * A near-verbatim clone of `save-profile-action.ts`, with the ONE structural
 * difference being the KEY: settings are keyed on the owner's `portfolio_id`
 * (resolved from the verified `sub`), not on `id = sub`. The invariant SHARED-A
 * sequence is identical and load-bearing (a failure at step N never reaches N+1):
 *
 *   1. getVerifiedClaims()              — verified JWT identity (AUTH-05). NEVER
 *      getSession() (spoofable; not even exported from server.ts). A null claim ⇒
 *      { ok:false, 'Not signed in.' }.  // D-12
 *   1b. hard-fail `sub` guard           — a verified claim MUST carry a subject.
 *       NEVER `sub ?? ''` (which would scope the owning read / UPDATE to a
 *       non-existent row and silently no-op, masking the invariant). // WR-05 / D-12
 *   2. contactSocialsSettingsSchema     — THE gate (FND-04 / SET-02). The client
 *      parse is UX only; this re-parse is the real boundary. The socials `url`
 *      field reuses the http(s)-only CR-01 allowlist, so a `javascript:`/`data:`
 *      social URL is rejected HERE, before any DB touch. A ZodError maps to
 *      per-field errors (the verbatim profile/signup loop).
 *   3. Owning-portfolio read            — one round-trip resolving the owner's
 *      `portfolio_id` (= the UPDATE key) AND `username` (for the revalidate),
 *      scoped `.eq('user_id', sub)` (D-13). Under the AUTHENTICATED RLS client,
 *      never service-role.
 *   4. EXPLICIT 4-COLUMN ALLOWLIST      — `buildSettingsAllowlist` returns EXACTLY
 *      `{ email_public, socials, location, phone }`, built BY HAND. We NEVER spread
 *      the parsed/input object into the UPDATE (mass-assignment defense, D-12 /
 *      SET-04). The write runs under RLS via the AUTHENTICATED client (never
 *      service-role); the `portfolio_settings own all` policy +
 *      `.eq('portfolio_id', owner.id)` scope the UPDATE to the caller's own row —
 *      a cross-tenant `portfolio_id` filters to 0 rows (the RLS tenant boundary,
 *      SET-04, proven by the cross-tenant integration test).
 *   5. revalidatePath('/' + username)   — on-demand ISR purge so the public page
 *      reflects the new contact/socials within seconds. LITERAL path, NO second
 *      arg (the one CLAUDE.md correction — the 'max'/{ expire:0 } profile belongs
 *      to revalidateTag, a DIFFERENT function). Username from the DB read or the
 *      passed prop, NEVER the request host (PUB-03).
 *   6. Return { ok: true }.
 *
 * This action introduces NO forbidden second writer: it does NOT dual-write the old
 * `*_url` columns (D-06 — they are read-only until P25 removes them) and does NOT
 * write `sections.content.email_public` (D-11 — that contact-section writer is P25's
 * concern, not this action's).
 *
 * Source: the SHARED-A skeleton from `save-profile-action.ts` (04-04) and
 * `save-section-action.ts` (04-03); `contactSocialsSettingsSchema` from the
 * `@/lib/validations` barrel (24-01); the verified-claims guard from
 * `@/lib/supabase/server.ts`.
 */
import { revalidatePath } from 'next/cache';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { contactSocialsSettingsSchema, type ContactSocialsSettings } from '@/lib/validations';

/** Per-field validation messages, keyed by the settings field name. */
export type SaveSettingsFieldErrors = Record<string, string>;

/**
 * The save outcome — the same discriminated-union shape SHARED-A returns
 * everywhere, so every editor island handles results identically.
 */
export type SaveSettingsResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: SaveSettingsFieldErrors };

/**
 * The Contact & Socials editable fields (SET-01/03). `username` is OPTIONAL and is
 * used ONLY to build the revalidate path — it is NEVER written as a column.
 */
export interface SaveSettingsInput {
  email_public?: string;
  socials?: ContactSocialsSettings['socials'];
  location?: string;
  phone?: string;
  /**
   * The owner's username, passed from the dashboard (already loaded for the editor)
   * so the revalidate needs no extra round-trip. When omitted the action uses the
   * username resolved by the owning-portfolio read — NEVER the request host (PUB-03).
   */
  username?: string;
}

const NOT_SIGNED_IN = 'Not signed in.';
const SAVE_FAILED = 'Something went wrong saving your changes. Please try again.';

/** The exact shape written to `portfolio_settings` — exactly four columns. */
export interface SettingsAllowlist {
  email_public: string;
  socials: NonNullable<ContactSocialsSettings['socials']>;
  location: string | null;
  phone: string | null;
}

/** Empty string / undefined → null (D-10 set-and-clear); any non-empty value passes through. */
function emptyToNull(value: string | undefined): string | null {
  return value && value !== '' ? value : null;
}

/**
 * Build the EXPLICIT `portfolio_settings` UPDATE payload BY HAND (D-12 / SET-04 —
 * the mass-assignment defense). Returns EXACTLY the four sanctioned columns; any
 * extra key on `parsed` (a smuggled portfolio_id / id / role / storage_used_bytes)
 * is dropped — it can never reach `.update()`. Pure (no I/O) so the unit test pins
 * the key set + the empty→null normalization directly.
 */
// D-12 / SET-04
export function buildSettingsAllowlist(parsed: ContactSocialsSettings): SettingsAllowlist {
  return {
    email_public: parsed.email_public ?? '',
    socials: parsed.socials ?? [],
    location: emptyToNull(parsed.location),
    phone: emptyToNull(parsed.phone),
  };
}

export async function saveSettingsAction(input: SaveSettingsInput): Promise<SaveSettingsResult> {
  // 1) Verified identity (AUTH-05 — never getSession). // D-12
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // 1b) WR-05 hard-fail: a verified claim MUST carry a subject — never `sub ?? ''`
  //     (which would scope the owning read / UPDATE to a non-existent row and
  //     silently write 0 rows, masking the invariant violation). // D-12
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 2) Zod re-parse — THE gate (FND-04 / SET-02). The socials `url` reuses the
  //    http(s)-only CR-01 allowlist, so a javascript:/data: social URL is rejected
  //    HERE, before the write at step 4.
  const parsed = contactSocialsSettingsSchema.safeParse({
    email_public: input.email_public,
    socials: input.socials,
    location: input.location,
    phone: input.phone,
  });
  if (!parsed.success) {
    const fieldErrors: SaveSettingsFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !(key in fieldErrors)) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  // 3) Owning-portfolio read (one round-trip — D-13). Resolve the owner's
  //    portfolio_id (= the UPDATE key) + username (for the revalidate, PUB-03 — never
  //    the request host) under the AUTHENTICATED RLS client (never service-role).
  //    Scoped `.eq('user_id', sub)` so owner.id is GUARANTEED the caller's portfolio.
  const supabase = await createClient();
  const { data: ownerRow } = await supabase
    .from('portfolios')
    .select('id, profiles!inner(username)')
    .eq('user_id', sub)
    .single();
  const owner = (ownerRow as {
    id?: string;
    profiles?: { username?: string } | { username?: string }[] | null;
  } | null) ?? null;
  if (!owner?.id) return { ok: false, error: SAVE_FAILED };

  // 4) EXPLICIT 4-COLUMN ALLOWLIST (D-12 / SET-04). Built BY HAND — NEVER a spread of
  //    parsed/input. portfolio_settings has NO protected-columns trigger, so the
  //    allowlist IS the column guard; RLS is the tenant boundary.
  const allowlist = buildSettingsAllowlist(parsed.data);

  // Write under RLS via the AUTHENTICATED client (never service-role). The
  // `portfolio_settings own all` policy + .eq('portfolio_id', owner.id) scope the
  // UPDATE to the caller's own row — a cross-tenant portfolio_id filters to 0 rows
  // (the RLS tenant boundary, SET-04).
  const { error } = await supabase
    .from('portfolio_settings')
    .update(allowlist)
    .eq('portfolio_id', owner.id);
  if (error) return { ok: false, error: SAVE_FAILED };

  // 5) Resolve the owner username (prefer the dashboard-passed value; else the
  //    DB read above — NEVER the request host, PUB-03) and revalidate the public
  //    page so the change is live within seconds.
  const embeddedProfiles = owner.profiles;
  const dbUsername = Array.isArray(embeddedProfiles)
    ? embeddedProfiles[0]?.username
    : embeddedProfiles?.username;
  const username = input.username ?? dbUsername ?? undefined;
  if (username) {
    // LITERAL path, NO second arg (the one CLAUDE.md correction — Pitfall 1).
    revalidatePath('/' + username);
  }

  // 6) Success — the editor clears its dirty flag.
  return { ok: true };
}
