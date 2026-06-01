'use server';

/**
 * saveSectionAction — the CANONICAL Zod-gated CMS write (CMS-03 / CMS-06,
 * D-P4-01 / D-P4-03).
 *
 * This is the TEMPLATE every later write slice mirrors (profile, reorder,
 * visibility, publish — SHARED-A). It is a Server Action (`'use server'`) so the
 * server boundary OWNS the validation gate: a bot calling this directly still
 * hits the same `validateSectionContent` re-parse + `getVerifiedClaims()` guard
 * (T-04-03c). The gate sequence is invariant — a failure at step N never reaches
 * step N+1:
 *
 *   1. getVerifiedClaims()      — verified JWT identity (AUTH-05). NEVER the
 *      unverified, spoofable cookie-session getter. A null claim ⇒
 *      { ok:false, 'Not signed in.' }.
 *      Drives the username for the revalidate (the identity, never the request
 *      host — PUB-03 / T-04-03d).
 *   2. validateSectionContent   — THE gate (FND-04 / CMS-08). It `.parse()`s
 *      (throws) for a known type with bad content OR an unregistered type. The
 *      client parse is UX only; this re-parse is the real boundary (T-04-03a/c).
 *      A ZodError maps to per-field errors (the verbatim signup-action loop); a
 *      non-Zod throw (unregistered type) maps to a generic error.
 *   3. createClient() write      — authenticated, under RLS. The owner's
 *      `sections.own_all` policy + `.eq('id', sectionId)` scope the UPDATE to the
 *      caller's own row; a cross-tenant target silently affects 0 rows (proven by
 *      tests/integration/cms/rls-write.test.ts — T-04-03b). Touch ONLY `content`
 *      (the save_section_history + update_updated_at triggers fire automatically).
 *      NEVER the service-role client for a user edit.
 *   4. revalidatePath('/' + username) — on-demand ISR purge so the PUBLISHED
 *      public page is fresh within seconds (D-P4-01). LITERAL path, NO second
 *      arg: per the live Next 16 docs the optional second arg only takes
 *      'page' | 'layout' — the 'max' / { expire: 0 } profile belongs to
 *      revalidateTag, a DIFFERENT function (RESEARCH Pitfall 1, the one CLAUDE.md
 *      correction). Authoring a second arg here is forbidden.
 *   5. Return { ok: true }.
 *
 * The content Save is NOT optimistic (UI-SPEC "optimistic UI honesty"): the UI
 * shows "Saving…" until this action resolves — it never claims the page is live
 * before the revalidate fires. Only reorder + visibility are optimistic.
 *
 * Source: action shape from src/lib/auth/signup-action.ts (the Zod-issues loop is
 * copied verbatim); the gate from src/lib/validations/sections.ts
 * (validateSectionContent); the verified-claims guard from
 * src/lib/supabase/server.ts; revalidatePath signature [VERIFIED: Next 16.2.6].
 */
import { revalidatePath } from 'next/cache';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { validateSectionContent } from '@/lib/validations';

/** Per-field validation messages, keyed by the section content field name. */
export type SaveSectionFieldErrors = Record<string, string>;

/**
 * The save outcome. On success the shape is `{ ok: true }`; on failure it is
 * `{ ok: false, error?, fieldErrors? }` — the same discriminated union shape the
 * signup action returns (SHARED-A), so every editor island handles results
 * identically.
 */
export type SaveSectionResult =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: SaveSectionFieldErrors };

/** The save input: which section, its soft-enum type, and the new content. */
export interface SaveSectionInput {
  sectionId: string;
  type: string;
  content: unknown;
  /**
   * The owner's username, passed from the dashboard (already loaded for the
   * editor) so the revalidate needs no extra round-trip. When omitted the action
   * reads it from the verified profile row — NEVER from the request host.
   */
  username?: string;
}

const NOT_SIGNED_IN = 'Not signed in.';
const SAVE_FAILED = 'Something went wrong saving your changes. Please try again.';
const INVALID_TYPE = 'This section type can’t be saved.';

/**
 * Map a thrown gate error to a failure result. A ZodError carries per-field
 * issues (mirrors the signup-action loop — first issue per path key); any other
 * throw (e.g. an unregistered type) is a generic error.
 */
function gateErrorToResult(e: unknown): Extract<SaveSectionResult, { ok: false }> {
  const issues = (e as { issues?: unknown }).issues;
  if (Array.isArray(issues)) {
    const fieldErrors: SaveSectionFieldErrors = {};
    for (const issue of issues as { path?: unknown[]; message?: string }[]) {
      const key = issue.path?.[0];
      if (typeof key === 'string' && !(key in fieldErrors)) {
        fieldErrors[key] = issue.message ?? 'Invalid value';
      }
    }
    // A refine/whole-object issue may have an empty path → no field key.
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, fieldErrors };
    }
  }
  return { ok: false, error: INVALID_TYPE };
}

export async function saveSectionAction(input: SaveSectionInput): Promise<SaveSectionResult> {
  // 1) Verified identity (AUTH-05 — never getSession). Drives the revalidate path.
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // 2) Zod re-parse — THE gate (FND-04). validateSectionContent .parse()s, so it
  //    THROWS on a known type with bad content or on an unregistered type. The
  //    write at step 3 is unreachable when this throws.
  let parsed: unknown;
  try {
    parsed = validateSectionContent(input.type, input.content);
  } catch (e) {
    return gateErrorToResult(e);
  }

  // 3) Write under RLS via the AUTHENTICATED client (never service-role). The
  //    sections.own_all policy + .eq('id', sectionId) scope the UPDATE to the
  //    owner; a cross-tenant target silently changes 0 rows (T-04-03b). Touch
  //    ONLY content — the history + updated_at triggers fire automatically.
  const supabase = await createClient();
  const { error } = await supabase
    .from('sections')
    .update({ content: parsed })
    .eq('id', input.sectionId);
  if (error) return { ok: false, error: SAVE_FAILED };

  // 4) Resolve the owner username (prefer the one the dashboard passed; else read
  //    the verified profile row — NEVER the request host, PUB-03) and revalidate
  //    the public page so the change is live within seconds (D-P4-01).
  let username = input.username;
  if (!username) {
    const sub = (claims as { sub?: string }).sub;
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', sub ?? '')
      .single();
    username = (data as { username?: string } | null)?.username ?? undefined;
  }
  if (username) {
    // LITERAL path, NO second arg (RESEARCH Pitfall 1 / CLAUDE.md correction).
    revalidatePath('/' + username);
  }

  // 5) Success — the dashboard clears the dirty flag + fires the saved-&-live beat.
  return { ok: true };
}
