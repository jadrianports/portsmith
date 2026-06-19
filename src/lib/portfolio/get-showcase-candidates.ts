/**
 * `getShowcaseCandidates` — the cookie-LESS anon read powering the public
 * `/explore` gallery (SHOW-04 / SHOW-05; 31-RESEARCH § Q3/Q4, 31-PATTERNS).
 *
 * It assembles the opted-in, publish-ready candidate pool from the three
 * `public_*` `security_invoker` views and ONLY those views — the same cookie-less
 * anon posture as `getPortfolioByUsername` (`get-portfolio.ts:48`).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ WHY COOKIE-LESS (D-22 / RESEARCH Pitfall 2 — LOAD-BEARING):                     │
 * │ This MUST use a plain `createClient` from `@supabase/supabase-js` with the      │
 * │ ANON key + `persistSession: false`, NOT the cookie-reading SSR server client.   │
 * │ A `cookies()`/`headers()`/host read would silently flip `/explore` to DYNAMIC,  │
 * │ killing ISR (T-31-12). Nothing here reads cookies/headers/searchParams/host.    │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * SECURITY (SHOW-05 / T-31-10): reads ONLY the column-restricted `public_*` views —
 * never a base table, never `supabaseAdmin`. The `public_showcase_profiles` DEFINER
 * helper already filters opt-in + published + non-locked + non-deleted, so this
 * function never re-implements those filters. No private column (e.g. the private
 * `profiles.updated_at`) is read; ordering uses the public `created_at` proxy (D-10).
 *
 * THE READ CHAIN (RESEARCH § Q3, reconstructable from public views only):
 *   1. public_showcase_profiles → the opted-in candidate set (7 public cols).
 *   2. public_portfolios .in('user_id', candidateIds) → portfolio_id + created_at.
 *   3. public_sections .in('portfolio_id', portfolioIds) → hero/about/projects content.
 *   4. JS: build CompletenessInput per candidate, run isPublishReady() (D-08
 *      correct-by-construction), sort by created_at DESC (D-10 launch proxy), cap
 *      at 60 (D-11, warn on truncation).
 *
 * ERROR DISCIPLINE (get-portfolio.ts:60-79 — load-bearing): a REAL read error THROWS
 * (so ISR never caches a broken gallery); a clean empty result is a clean empty list
 * (driving the D-14 empty-state). Every (nullable) view column is null-guarded.
 *
 * NULLABILITY: every `public_*` view Row column is nullable (database.ts convention) —
 * including `id`/`username`. Guard before use.
 */
import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { isPublishReady } from '@/lib/cms/completeness';
import type { Database } from '@/types/database';

/** The per-item shape the `/explore` gallery (ShowcaseCard) consumes. */
export interface ShowcaseCandidate {
  /** The published portfolio username — drives the printed URL + siteUrl() href. */
  username: string;
  /** Display name for the card aria-label / caption (falls back to username). */
  displayName: string;
}

/** D-11 — the generous single-page cap. Pool is tiny at launch; no pagination yet. */
const SHOWCASE_CAP = 60;

/**
 * Read the opted-in, publish-ready showcase pool, newest-published-first, capped at
 * {@link SHOWCASE_CAP}. Returns `[]` when the pool is empty (the D-14 empty-state).
 *
 * A real read error THROWS (ISR must not cache a broken gallery); an empty result is
 * a clean empty array.
 */
export async function getShowcaseCandidates(): Promise<ShowcaseCandidate[]> {
  // Cookie-LESS anon client (Pitfall 2) — the NEXT_PUBLIC_* runtime env names, NOT
  // the test-only SUPABASE_* names used by the local-stack integration harness.
  const db = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  // (1) The opted-in candidate set. The DEFINER helper behind the view already
  // filters opt-in + published + non-locked + non-deleted (SHOW-05).
  const { data: profiles, error: profilesError } = await db
    .from('public_showcase_profiles')
    .select('*');
  if (profilesError) {
    throw new Error(`public_showcase_profiles read failed: ${profilesError.message}`);
  }

  // Null-guard: keep only rows with a usable id + username (both nullable on the view).
  const candidates = (profiles ?? []).filter(
    (p): p is typeof p & { id: string; username: string } =>
      !!p.id && !!p.username,
  );
  if (candidates.length === 0) return []; // clean empty pool → D-14 empty-state.

  const candidateIds = candidates.map((p) => p.id);

  // (2) Each candidate's portfolio — for portfolio_id (the section join key) and the
  // public created_at ordering proxy (D-10 / A1; profiles.updated_at is PRIVATE).
  const { data: portfolios, error: portfoliosError } = await db
    .from('public_portfolios')
    .select('id, user_id, created_at')
    .in('user_id', candidateIds);
  if (portfoliosError) {
    throw new Error(`public_portfolios read failed: ${portfoliosError.message}`);
  }

  // user_id → { portfolioId, createdAt }. Null-guard both join keys.
  const byUser = new Map<string, { portfolioId: string; createdAt: string | null }>();
  const portfolioIds: string[] = [];
  for (const pf of portfolios ?? []) {
    if (pf.id && pf.user_id) {
      byUser.set(pf.user_id, { portfolioId: pf.id, createdAt: pf.created_at });
      portfolioIds.push(pf.id);
    }
  }
  if (portfolioIds.length === 0) return [];

  // (3) The sections for those portfolios. The view already filters visible = true
  // AND portfolio_is_public(...) (defense in depth) — we only need hero/about/projects
  // content to run the eligibility predicate.
  const { data: sections, error: sectionsError } = await db
    .from('public_sections')
    .select('portfolio_id, type, content')
    .in('portfolio_id', portfolioIds);
  if (sectionsError) {
    throw new Error(`public_sections read failed: ${sectionsError.message}`);
  }

  // Group sections by portfolio_id into the CompletenessInput.sections shape.
  const sectionsByPortfolio = new Map<string, { type: string; content: unknown }[]>();
  for (const s of sections ?? []) {
    if (!s.portfolio_id || !s.type) continue; // null-guard nullable view columns.
    const list = sectionsByPortfolio.get(s.portfolio_id) ?? [];
    list.push({ type: s.type, content: s.content });
    sectionsByPortfolio.set(s.portfolio_id, list);
  }

  // (4) JS: filter via isPublishReady (D-08 correct-by-construction), then sort by the
  // created_at proxy DESC (D-10). Carry created_at on the intermediate shape so the
  // sort has the key without exposing it on the returned contract.
  const ready = candidates
    .map((c) => {
      const pf = byUser.get(c.id);
      if (!pf) return null; // candidate without a public portfolio row — drop.
      const portfolioSections = sectionsByPortfolio.get(pf.portfolioId) ?? [];
      const isReady = isPublishReady({
        displayName: c.display_name,
        avatarUrl: c.avatar_url,
        sections: portfolioSections,
      });
      if (!isReady) return null;
      return {
        username: c.username,
        displayName: c.display_name ?? c.username, // null-guard the nullable name.
        createdAt: pf.createdAt,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    // Newest-published-first via the public created_at proxy (D-10 / A1). A null
    // created_at sorts last (treated as epoch 0).
    .sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });

  // D-11 — cap at SHOWCASE_CAP; never silently truncate (RESEARCH § Q4).
  if (ready.length > SHOWCASE_CAP) {
    console.warn('[explore] showcase pool exceeded cap, truncating', ready.length);
  }

  return ready.slice(0, SHOWCASE_CAP).map(({ username, displayName }) => ({
    username,
    displayName,
  }));
}
