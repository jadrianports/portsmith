/**
 * `getPortfolioByUsername` — the SINGLE read path the public page consumes
 * (TMPL-03 read half / CONTEXT D-19).
 *
 * A React `cache()`'d, **cookie-LESS** anon Supabase read that assembles the
 * `PortfolioData` contract from the four Phase-1 `public_*` `security_invoker`
 * views and ONLY those views (D-19). The page (03-05) calls this from both
 * `generateMetadata` and the page body — `cache()` dedupes that into one read.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ WHY COOKIE-LESS (RESEARCH Pitfall 2 / PATTERNS SHARED-A — LOAD-BEARING):       │
 * │ The public read MUST use a plain `createClient` from `@supabase/supabase-js`,  │
 * │ NOT `src/lib/supabase/server.ts`'s cookie-reading `createServerClient`. That   │
 * │ module calls `await cookies()`, which silently opts `/[username]` into DYNAMIC │
 * │ rendering — killing ISR and the TMPL-04 perf budget. `persistSession: false`   │
 * │ + the anon key keeps this read static / ISR-cacheable.                         │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * SECURITY (D-19 / threat register T-03-04/05/06/07):
 * - Reads ONLY the column-restricted `public_*` views — never a base table.
 * - Uses the ANON key only — never the service-role key.
 * - `import 'server-only'` keeps it (and the env reads) out of any client bundle.
 * The views themselves enforce published/non-deleted/non-locked + visible-only +
 * column safety; this function never has to re-implement those filters.
 *
 * NULLABILITY (types.ts LOAD-BEARING note / database.ts verified): EVERY column on
 * every `public_*` view Row is nullable — including `profile.id`. So the
 * `.eq('user_id', profile.id)` access must null-guard `profile.id` before use.
 */
import 'server-only';

import { cache } from 'react';

import { createClient } from '@supabase/supabase-js';

import { resolveSpec, slugForTemplateId } from '@/components/templates/registry';
import type { PortfolioData } from '@/components/templates/types';
import type { Database } from '@/types/database';

import { withHeroResumeUrl } from './inject-hero-resume';

/**
 * Assemble {@link PortfolioData} for a published username, or `null` when the
 * username is missing/unpublished (which drives `notFound()` in the page).
 *
 * Wrapped in React `cache()` so the page + `generateMetadata` share one read.
 */
export const getPortfolioByUsername = cache(
  async (username: string): Promise<PortfolioData | null> => {
    // Cookie-LESS anon client — keeps the route ISR-cacheable (Pitfall 2).
    // Uses the NEXT_PUBLIC_* env names (the runtime app surface), NOT the
    // test-only SUPABASE_URL/SUPABASE_ANON_KEY names used by the local-stack
    // integration harness.
    const db = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );

    // WR-02 (03-REVIEW): distinguish a GENUINE not-found (no row → returns null →
    // `notFound()`, which ISR may legitimately cache) from a REAL read error
    // (network blip, RLS misconfig, view-grant revocation, Postgres hiccup). On a
    // real error we THROW so Next renders the error boundary and does NOT cache a
    // hard 404 for a published portfolio for up to `revalidate` (3600s). Only a
    // clean missing/unpublished row yields `null`. Each of the four reads inspects
    // `.error` separately from `.data`. This keeps the path cookie-less + ISR-safe
    // (no request-time dynamism is introduced; the client is still anon/no-session).

    // (1) public_profiles already filters to published / non-deleted / non-locked.
    // maybeSingle() returns { data: null, error: null } when there is no row.
    const { data: profile, error: profileError } = await db
      .from('public_profiles')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    if (profileError) {
      throw new Error(`public_profiles read failed: ${profileError.message}`);
    }
    if (!profile || !profile.id) return null; // genuine not-found / unpublished

    // (2) the portfolio for that user.
    const { data: portfolio, error: portfolioError } = await db
      .from('public_portfolios')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();
    if (portfolioError) {
      throw new Error(`public_portfolios read failed: ${portfolioError.message}`);
    }
    if (!portfolio || !portfolio.id) return null; // genuine not-found

    // (3) settings + visible sections (sorted by sort_order) in parallel.
    const [
      { data: settings, error: settingsError },
      { data: sections, error: sectionsError },
    ] = await Promise.all([
      db
        .from('public_portfolio_settings')
        .select('*')
        .eq('portfolio_id', portfolio.id)
        .maybeSingle(),
      db
        .from('public_sections')
        .select('*')
        .eq('portfolio_id', portfolio.id)
        .order('sort_order', { ascending: true }),
    ]);
    if (settingsError) {
      throw new Error(`public_portfolio_settings read failed: ${settingsError.message}`);
    }
    if (sectionsError) {
      throw new Error(`public_sections read failed: ${sectionsError.message}`);
    }
    if (!settings) return null; // genuine not-found

    // (4) D-16 homepage teaser — the LATEST published posts for this portfolio. This
    // is a SECOND cookie-LESS query (still the anon `db` above, no cookies()/headers()),
    // so it does NOT flip the route to dynamic — only a cookie/header read would
    // (Pitfall 1 / D-22). The `public_blog_posts` view is published-only by
    // construction (blog_post_is_public DEFINER helper). A real read error THROWS
    // (WR-02 — an empty teaser must not mask a broken blog); a clean empty result is
    // a clean empty array. The `blog_preview` section component reads this as its
    // PRIMARY source, falling back to its legacy `content.items[]` only when empty.
    const { data: recentPosts, error: recentPostsError } = await db
      .from('public_blog_posts')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .order('display_date', { ascending: false })
      .limit(3);
    if (recentPostsError) {
      throw new Error(`public_blog_posts (teaser) read failed: ${recentPostsError.message}`);
    }

    // Resolve the slug from `public_portfolios.template_id` (already in hand from
    // the `.select('*')` above — public_portfolios exposes it, 005:88) via the
    // STATIC slug↔UUID map. NO request-time `templates` read → the route stays
    // cookie-less ISR (Pitfall 2/6). `resolveSpec(slug)` selects the matching spec.
    const templateSlug = slugForTemplateId(portfolio.template_id);

    return {
      profile,
      settings,
      // D-14: inject the LIVE profiles.resume_url into the hero content so a CMS resume
      // change drives the "Download CV" button — instead of the value the seed baked in.
      sections: withHeroResumeUrl(sections ?? [], profile.resume_url ?? null),
      portfolioId: portfolio.id, // feeds the dedicated blog routes' get-posts reads (D-16)
      recentPosts: recentPosts ?? [], // D-16 teaser source (latest 3 published posts)
      templateSlug, // resolved from the static map — drives <TemplateRenderer slug>
      templateSpec: resolveSpec(templateSlug), // spec for the SAME slug (Pitfall 6)
    };
  },
);
