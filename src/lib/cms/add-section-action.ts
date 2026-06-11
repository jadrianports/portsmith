'use server';

/**
 * addSectionAction — provision a NEW section row on demand (D-01 / D-02 / D-04 /
 * D-18 / D-21). The EDIT-ALL backbone: an owner can add a row for any form-having
 * type they don't already have, regardless of the active template. It mirrors the
 * canonical SHARED-A skeleton (save-section-action.ts) with the same invariant gate
 * sequence (a failure at step N never reaches step N+1):
 *
 *   0. ADDABLE allowlist backstop (Pitfall 6) — reject anything not in
 *      `ADDABLE_SECTION_TYPES` (all 13 form-having types — `blog_preview` is now
 *      INCLUDED as of 13.2-06 / D-16) BEFORE the DB. This allowlist is the guard
 *      keeping an unregistered/crafted type out (the soft-enum gate does not know
 *      the "form-having" subset).
 *   1. getVerifiedClaims() — verified JWT identity (AUTH-05). NEVER the unverified,
 *      spoofable cookie-session getter. A null claim ⇒ { ok:false }. WR-05: a
 *      verified claim MUST carry a `sub` — hard-fail on a missing one (never `?? ''`).
 *   2. Resolve the caller's OWN portfolio id SERVER-SIDE under RLS
 *      (`.eq('user_id', sub).maybeSingle()` — never a client-supplied id), so the
 *      INSERT can only target the caller's own portfolio (cross-tenant → impossible).
 *   4. D-21 seed + the Zod gate: build the seeded D-19 heading content per type and
 *      re-validate it via `validateSectionContent` (the server write gate holds even
 *      for the seed) BEFORE the RPC. D-04: the row starts hidden (`visible:false`).
 *   5. D-12 / WR-02: append ATOMICALLY via the `add_section` SECURITY INVOKER RPC
 *      (migration 020) — one statement computes `MAX(sort_order)+1` and INSERTs, so
 *      two near-simultaneous adds get distinct contiguous sort_order (the read+insert
 *      can no longer race into a non-deterministic order). It runs under the
 *      AUTHENTICATED client: the `sections own all` WITH CHECK scopes the INSERT to
 *      the owner (004_rls_policies.sql:144-155) exactly as a direct insert would.
 *      NEVER the service-role client. A duplicate-type insert collides with
 *      UNIQUE(portfolio_id,type) → Postgres 23505, mapped to { ok:false } (the
 *      insert-race backstop — T-13.1-02-RACE), never a throw/500.
 *   6. revalidatePath('/' + username) — LITERAL path, NO second arg (CLAUDE.md
 *      Pitfall 1; the 'max' profile belongs to revalidateTag, a different function).
 *   7. Return { ok:true, sectionId } so the client can select + first-fill (D-21).
 *
 * Result shape is the discriminated union { ok:true } | { ok:false; error? } —
 * never throws to the caller; messages stay generic (no internal-detail leak).
 *
 * Source: action shape from src/lib/cms/reorder-sections-action.ts (the portfolio-id
 * resolve under RLS) + toggle-visibility-action.ts (the single-row sections write);
 * the gate from src/lib/validations (validateSectionContent); the addable allowlist
 * from src/lib/cms/addable-section-types (a plain sibling — 'use server' modules
 * export only async functions); revalidatePath signature [VERIFIED: Next 16.2.6].
 */
import { revalidatePath } from 'next/cache';

import { isAddableSectionType } from '@/lib/cms/addable-section-types';
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { validateSectionContent } from '@/lib/validations';
import type { Json } from '@/types/database';

/** The add outcome — { ok:true, sectionId } on success; the union otherwise. */
export type AddSectionResult =
  | { ok: true; sectionId: string }
  | { ok: false; error?: string };

const NOT_SIGNED_IN = 'Not signed in.';
const ADD_FAILED = 'Something went wrong adding the section. Please try again.';
const NOT_ADDABLE = 'That section can’t be added.';
const ALREADY_PRESENT = 'You already have that section.';

/** Postgres unique_violation — the UNIQUE(portfolio_id, type) insert-race backstop. */
const UNIQUE_VIOLATION = '23505';

/**
 * The D-19 friendly seed heading per addable type (the same titles the rail uses).
 * `about` has no `heading` field (its content is `{ bio, skills }`), so the seed
 * carries no heading there; every other addable type seeds its `heading`.
 */
const SEED_HEADING: Record<string, string> = {
  hero: 'Hero',
  about: 'About',
  projects: 'Projects',
  experience: 'Experience',
  skills: 'Skills',
  testimonials: 'Testimonials',
  contact: 'Contact',
  education: 'Education',
  metrics: 'Metrics',
  services: 'Services',
  moodboard: 'Moodboard / Gallery',
  certifications: 'Certifications',
  blog_preview: 'From the blog',
};

/**
 * Build the D-21 seed content for a freshly-added section. Each shape is the
 * MINIMAL valid content for its schema (re-validated below via the gate):
 *   - `about`     → `{ bio: '', skills: [] }` (no heading field on the schema).
 *   - `hero`      → `{ heading }` (heading-only).
 *   - `contact`   → `{ heading }`.
 *   - `skills`    → `{ heading, groups: [] }`.
 *   - every item-based type (projects/experience/testimonials/education/metrics/
 *     services/moodboard/certifications) → `{ heading, items: [] }`.
 * An empty `items[]`/`groups[]` is intentional — D-21's blank first item card is
 * created client-side in the editor; the row persists started-but-empty + hidden.
 */
function seedContentFor(type: string): unknown {
  if (type === 'about') {
    // aboutContentSchema has no `heading` — bio + skills are the required fields.
    return { bio: '', skills: [] };
  }
  const heading = SEED_HEADING[type] ?? '';
  if (type === 'hero' || type === 'contact') {
    return { heading };
  }
  if (type === 'skills') {
    return { heading, groups: [] };
  }
  if (type === 'blog_preview') {
    // 13.2-06 / D-16: heading + shown-count (the teaser auto-derives from latest
    // published posts; the legacy items[] fallback is not seeded).
    return { heading, post_count: 3 };
  }
  // The item-based families (incl. moodboard's gallery items[]).
  return { heading, items: [] };
}

/**
 * Add a new section of `type` to the caller's portfolio.
 *
 * @param type     The soft-enum section type to add (must be in
 *   `ADDABLE_SECTION_TYPES` — blog_preview / unregistered are refused pre-DB).
 * @param username The owner's username, passed from the dashboard so the revalidate
 *   needs no extra round-trip. When omitted the action reads it from the verified
 *   profile row — NEVER from the request host (PUB-03).
 */
export async function addSectionAction(
  type: string,
  username?: string,
): Promise<AddSectionResult> {
  // 0) ADDABLE allowlist backstop (Pitfall 6) — refuse blog_preview / unregistered
  //    BEFORE any DB access. The picker already filters; this is the server backstop.
  if (!isAddableSectionType(type)) {
    return { ok: false, error: NOT_ADDABLE };
  }

  // 1) Verified identity (AUTH-05 — never getSession). Drives the revalidate path.
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // WR-05: a verified claim MUST carry a subject. Treat a missing `sub` as a hard
  // auth failure — never coerce it to '' (which would make the own-portfolio read a
  // guaranteed 0-row no-op that masks the invariant violation).
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 2) Resolve the caller's OWN portfolio id SERVER-SIDE under RLS (never trusted
  //    from the client). RLS scopes the portfolios row to the owner, so this yields
  //    only the caller's own portfolio; the INSERT then targets it.
  const supabase = await createClient();
  const { data: portfolioRow, error: portfolioError } = await supabase
    .from('portfolios')
    .select('id')
    .eq('user_id', sub) // RLS scopes to the owner; WR-05: `sub` guaranteed present.
    .maybeSingle();
  if (portfolioError) return { ok: false, error: ADD_FAILED };
  const portfolioId = (portfolioRow as { id?: string } | null)?.id;
  if (!portfolioId) return { ok: false, error: ADD_FAILED };

  // 4) D-21 seed + the Zod gate. Build the seeded content and re-validate it via the
  //    server write gate (validateSectionContent throws on bad content). A thrown
  //    gate means a programming error in the seed (not user input) → generic failure.
  let content: unknown;
  try {
    content = validateSectionContent(type, seedContentFor(type));
  } catch {
    return { ok: false, error: ADD_FAILED };
  }

  // 5) D-12 / WR-02: append ATOMICALLY via the `add_section` SECURITY INVOKER RPC
  //    (migration 020). One statement computes MAX(sort_order)+1 and INSERTs the
  //    hidden row (D-04), so two concurrent adds get distinct contiguous sort_order
  //    instead of racing into a non-deterministic order. The RPC runs under the
  //    AUTHENTICATED client — the `sections own all` WITH CHECK scopes the INSERT to
  //    the owner exactly as a direct insert would; NEVER the service-role client. A
  //    duplicate type still collides with UNIQUE(portfolio_id, type) → Postgres 23505
  //    → { ok:false } (no throw/500).
  const { data: newId, error: rpcError } = await supabase.rpc('add_section', {
    p_portfolio_id: portfolioId,
    p_type: type,
    p_content: content as Json,
  });
  if (rpcError) {
    if ((rpcError as { code?: string }).code === UNIQUE_VIOLATION) {
      return { ok: false, error: ALREADY_PRESENT };
    }
    return { ok: false, error: ADD_FAILED };
  }
  const sectionId = (newId as string | null) ?? undefined;
  if (!sectionId) return { ok: false, error: ADD_FAILED };

  // 6) Resolve the owner username (prefer the dashboard-passed value; else read the
  //    verified profile row — NEVER the request host, PUB-03) and revalidate the
  //    public page (a hidden row renders nothing, but the page is purged for parity).
  let resolvedUsername = username;
  if (!resolvedUsername) {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', sub) // WR-05: `sub` guaranteed present (no `?? ''`).
      .single();
    resolvedUsername = (data as { username?: string } | null)?.username ?? undefined;
  }
  if (resolvedUsername) {
    // LITERAL path, NO second arg (RESEARCH Pitfall 1 / CLAUDE.md correction).
    revalidatePath('/' + resolvedUsername);
  }

  // 7) Success — return the new id so the client can select + first-fill (D-21).
  return { ok: true, sectionId };
}
