'use server';

/**
 * saveProfileAction — the profile-edit CMS write (CMS-02 / D-P4-05).
 *
 * Mirrors the CANONICAL SHARED-A skeleton proven by `save-section-action.ts`
 * (04-03): the server boundary OWNS the gate, the sequence is invariant (a
 * failure at step N never reaches step N+1), and the revalidate uses the literal
 * `'/' + username` path with NO second arg. The ONE thing this action adds over
 * the section save is the PROTECTED-COLUMN ALLOWLIST DISCIPLINE — the difference
 * between a clean save and a trigger rejection:
 *
 *   1. getVerifiedClaims()      — verified JWT identity (AUTH-05). NEVER the
 *      unverified, spoofable cookie-session getter. A null claim ⇒
 *      { ok:false, 'Not signed in.' }. Drives the username for the revalidate
 *      (the identity, never the request host — PUB-03 / T-04-04c).
 *   2. profileSchema re-parse    — THE gate (FND-04). The client parse is UX
 *      only; this re-parse is the real boundary (T-04-04b). The four editable
 *      fields' URL columns reuse the SAME `httpUrlOrEmptyOptional` scheme
 *      allowlist as every other URL field, so a `javascript:` / `data:` avatar
 *      or resume URL is rejected HERE, before any DB touch. A ZodError maps to
 *      per-field errors (the verbatim signup-action loop).
 *   3. EXPLICIT 4-COLUMN ALLOWLIST write (RESEARCH Pitfall 4 / T-04-04a) — the
 *      LOAD-BEARING line. The update object is built EXPLICITLY as
 *      `{ display_name, headline, resume_url, avatar_url }`. We NEVER spread the
 *      parsed or input object into the update, and we EXPLICITLY EXCLUDE
 *      `username` even though `profileSchema` includes it: `username` is one of
 *      the 8 columns guarded by the `enforce_protected_profile_columns` trigger
 *      (002:108-118), a username change is out of P4 scope, and writing it would
 *      make the trigger `RAISE`. The allowlist is the demonstrably safe path —
 *      the integration test proves a direct `username` update is rejected by the
 *      trigger while this allowlist succeeds. The write runs under RLS via the
 *      AUTHENTICATED client (never service-role); the profiles own-update policy
 *      + `.eq('id', claims.sub)` scope the UPDATE to the caller's own row.
 *   4. revalidatePath('/' + username) — on-demand ISR purge so the PUBLISHED
 *      public page reflects the new name/headline/avatar within seconds
 *      (D-P4-01). LITERAL path, NO second arg (RESEARCH Pitfall 1, the one
 *      CLAUDE.md correction — the 'max' / { expire: 0 } profile belongs to
 *      revalidateTag, a DIFFERENT function). Username from the verified profile
 *      row or `input.username`, NEVER the request host.
 *   5. Return { ok: true }.
 *
 * Source: the SHARED-A skeleton from `save-section-action.ts`; the Zod-issues
 * loop from `signup-action.ts`; `profileSchema` from
 * `@/lib/validations/profile.ts`; the verified-claims guard from
 * `@/lib/supabase/server.ts`.
 */
import { revalidatePath } from 'next/cache';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { profileSchema } from '@/lib/validations';

/** Per-field validation messages, keyed by the profile field name. */
export type SaveProfileFieldErrors = Record<string, string>;

/**
 * The save outcome. On success the shape is `{ ok: true }`; on failure it is
 * `{ ok: false, error?, fieldErrors? }` — the same discriminated-union shape the
 * section save returns (SHARED-A), so every editor island handles results
 * identically.
 */
export type SaveProfileResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: SaveProfileFieldErrors };

/**
 * The four editable profile fields (CMS-02 / D-P4-05). `username` is OPTIONAL and
 * is used ONLY to build the revalidate path — it is NEVER written as a column
 * (the protected-columns trigger guards it; Pitfall 4).
 */
export interface SaveProfileInput {
  display_name: string;
  headline?: string;
  resume_url?: string;
  avatar_url?: string;
  /**
   * The owner's username, passed from the dashboard (already loaded for the
   * editor) so the revalidate needs no extra round-trip. When omitted the action
   * reads it from the verified profile row — NEVER from the request host (PUB-03).
   */
  username?: string;
}

const NOT_SIGNED_IN = 'Not signed in.';
const SAVE_FAILED = 'Something went wrong saving your changes. Please try again.';

/**
 * The profileSchema requires `username` (it is the full-profile schema), but a
 * profile EDIT in P4 never changes the username. Validate only the four editable
 * fields by picking them off the schema, so the gate runs without demanding a
 * username and without ever admitting one into the parsed payload.
 */
const editableProfileSchema = profileSchema.pick({
  display_name: true,
  headline: true,
  resume_url: true,
  avatar_url: true,
});

export async function saveProfileAction(input: SaveProfileInput): Promise<SaveProfileResult> {
  // 1) Verified identity (AUTH-05 — never getSession). Drives the revalidate path.
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // WR-05: a verified claim MUST carry a subject. Treat a missing `sub` as a hard
  // auth failure — never coerce it to '' (which would scope the UPDATE below to a
  // non-existent row and silently write 0 rows, masking the invariant violation).
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 2) Zod re-parse — THE gate (FND-04). The URL fields reuse the
  //    httpUrlOrEmptyOptional scheme allowlist, so a javascript:/data: avatar or
  //    resume URL is rejected HERE, before the write at step 3.
  const parsed = editableProfileSchema.safeParse({
    display_name: input.display_name,
    headline: input.headline,
    resume_url: input.resume_url,
    avatar_url: input.avatar_url,
  });
  if (!parsed.success) {
    const fieldErrors: SaveProfileFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !(key in fieldErrors)) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  // 3) EXPLICIT 4-COLUMN ALLOWLIST (Pitfall 4 / T-04-04a). Build the update
  //    object by hand — NEVER spread parsed/input — and NEVER include `username`
  //    (a protected column the trigger blocks). This is the LOAD-BEARING line.
  const allowlist = {
    display_name: parsed.data.display_name,
    headline: parsed.data.headline,
    resume_url: parsed.data.resume_url,
    avatar_url: parsed.data.avatar_url,
  };

  // Write under RLS via the AUTHENTICATED client (never service-role). The
  // profiles own-update policy + .eq('id', sub) scope the UPDATE to the owner's
  // own row (WR-05: `sub` is guaranteed present by the guard above — no `?? ''`).
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update(allowlist)
    .eq('id', sub);
  if (error) return { ok: false, error: SAVE_FAILED };

  // 4) Resolve the owner username (prefer the dashboard-passed value; else read
  //    the verified profile row — NEVER the request host, PUB-03) and revalidate
  //    the public page so the change is live within seconds (D-P4-01).
  let username = input.username;
  if (!username) {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', sub) // WR-05: `sub` is guaranteed present (no `?? ''`).
      .single();
    username = (data as { username?: string } | null)?.username ?? undefined;
  }
  if (username) {
    // LITERAL path, NO second arg (RESEARCH Pitfall 1 / CLAUDE.md correction).
    revalidatePath('/' + username);
  }

  // 5) Success — the dashboard clears the dirty flag.
  return { ok: true };
}
