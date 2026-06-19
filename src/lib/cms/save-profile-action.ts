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
 *   3. READ the prior row (username + avatar_url + resume_url) BEFORE the write —
 *      one read serving both the revalidate username (PUB-03) and the prior media
 *      URLs the delete-on-replace leg needs.
 *   3b. DELETE-ON-REPLACE leg (D-11 / D-12 / MEDIA-04 — an ADDED leg, NOT a
 *      replacement of the sequence). For BOTH avatar_url and resume_url: when the
 *      parsed NEW value differs from the stored CURRENT value (a replace OR a
 *      clear), the prior Storage object is being dropped — `deleteStorageObject`
 *      frees it synchronously (no orphan), gated by the SERVER-VERIFIED `sub`
 *      (never client input) + the helper's own-folder guard + origin-lock (a
 *      non-Storage / foreign / unchanged URL is a safe no-op; a cross-tenant URL is
 *      rejected — T-05-16/17). We delete the CURRENT object ONLY when it is
 *      genuinely dropped (`current !== next`), so the surviving new object is never
 *      deleted (no TOCTOU). This closes the avatar-replace orphan 05-02 deferred.
 *   4. EXPLICIT 4-COLUMN ALLOWLIST write (RESEARCH Pitfall 4 / T-04-04a) — the
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
 *   5. revalidatePath('/' + username) — on-demand ISR purge so the PUBLISHED
 *      public page reflects the new name/headline/avatar within seconds
 *      (D-P4-01). LITERAL path, NO second arg (RESEARCH Pitfall 1, the one
 *      CLAUDE.md correction — the 'max' / { expire: 0 } profile belongs to
 *      revalidateTag, a DIFFERENT function). Username from the prior profile row
 *      or `input.username`, NEVER the request host.
 *   6. Return { ok: true }.
 *
 * Storage deletes go through the SERVER-SIDE service-role `deleteStorageObject`
 * (founder-approved Option B), NOT the authenticated client — the locked foundation
 * (no SELECT policy on storage.objects; the 002 trigger RAISEs on an authenticated
 * `storage_used_bytes` change) makes the authenticated delete impossible. Carried
 * for /gsd-secure-phase (see delete-object.ts).
 *
 * Source: the SHARED-A skeleton from `save-section-action.ts` (incl. its `deleteUrls`
 * orphan-delete leg, 05-03); the Zod-issues loop from `signup-action.ts`;
 * `profileSchema` from `@/lib/validations/profile.ts`; the verified-claims guard
 * from `@/lib/supabase/server.ts`; `deleteStorageObject` from
 * `@/lib/media/delete-object.ts`.
 */
import { deleteStorageObject } from '@/lib/media/delete-object';
import { revalidatePublicPortfolio } from '@/lib/cms/revalidate-public';
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

  // 3) Read the owner's CURRENT row BEFORE the write — the username for the
  //    revalidate (PUB-03, never the request host) AND the prior avatar_url /
  //    resume_url so the delete-on-replace leg knows which Storage objects are
  //    being dropped. One read serves both (no extra round-trip). Scoped to the
  //    verified `sub` (WR-05: guaranteed present by the guard above — no `?? ''`).
  const supabase = await createClient();
  const { data: priorRow } = await supabase
    .from('profiles')
    .select('username, avatar_url, resume_url')
    .eq('id', sub)
    .single();
  const prior = (priorRow as {
    username?: string;
    avatar_url?: string | null;
    resume_url?: string | null;
  } | null) ?? null;

  // 3b) DELETE-ON-REPLACE leg moved to AFTER the UPDATE succeeds (WR-02) — see below.
  //     Deleting the prior object before the write would strand a broken reference if
  //     the UPDATE then failed (the row still points at the now-deleted object).

  // 4) EXPLICIT 4-COLUMN ALLOWLIST (Pitfall 4 / T-04-04a). Build the update
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
  const { error } = await supabase
    .from('profiles')
    .update(allowlist)
    .eq('id', sub);
  if (error) return { ok: false, error: SAVE_FAILED };

  // 4b) DELETE-ON-REPLACE leg (D-11 / D-12 / MEDIA-04) — runs ONLY AFTER the row
  //     UPDATE is confirmed (WR-02), so a failed save never deletes an object the
  //     surviving row still references. For BOTH avatar_url and resume_url: when the
  //     parsed NEW value differs from the stored CURRENT (a replace OR a clear), the
  //     prior object is dropped — delete it so replacing/clearing either profile
  //     medium frees its Storage. `sub` is the SERVER-VERIFIED subject (step 1),
  //     never client input; deleteStorageObject re-asserts the own-folder guard +
  //     origin-lock, so a non-Storage / foreign / unchanged URL is a safe no-op and a
  //     crafted cross-tenant URL is rejected (T-05-16/17). Only the genuinely-dropped
  //     CURRENT object is deleted (`current !== next`) — the surviving NEW object is
  //     never targeted (no TOCTOU).
  if (prior) {
    const drops: Array<[string | null | undefined, string | undefined]> = [
      [prior.avatar_url, parsed.data.avatar_url],
      [prior.resume_url, parsed.data.resume_url],
    ];
    for (const [current, next] of drops) {
      const currentUrl = (current ?? '').trim();
      const nextUrl = (next ?? '').trim();
      if (currentUrl !== '' && currentUrl !== nextUrl) {
        await deleteStorageObject(currentUrl, sub);
      }
    }
  }

  // 5) Resolve the owner username (prefer the dashboard-passed value; else the
  //    prior-row read above — NEVER the request host, PUB-03) and revalidate the
  //    public page so the change is live within seconds (D-P4-01).
  const username = input.username ?? prior?.username ?? undefined;
  if (username) {
    // Purge the page AND the sibling og-image segment (D-05 / Q1) — a literal
    // revalidatePath('/'+username) does NOT cascade to /[username]/opengraph-image,
    // so a name/headline/avatar change would otherwise leave the carousel/Explore
    // preview card stale up to the 1h ISR backstop. Both LITERAL paths, NO 2nd arg
    // (RESEARCH Pitfall 1 / CLAUDE.md correction).
    revalidatePublicPortfolio(username);
  }

  // 6) Success — the dashboard clears the dirty flag.
  return { ok: true };
}
