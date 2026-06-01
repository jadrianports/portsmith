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

import { minimalSpec } from '@/components/templates/minimal/spec';
import type { PortfolioData } from '@/components/templates/types';
import type { Database } from '@/types/database';

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

    // (1) public_profiles already filters to published / non-deleted / non-locked.
    // maybeSingle() returns null (not throw) when there is no row → notFound().
    const { data: profile } = await db
      .from('public_profiles')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    if (!profile || !profile.id) return null;

    // (2) the portfolio for that user.
    const { data: portfolio } = await db
      .from('public_portfolios')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle();
    if (!portfolio || !portfolio.id) return null;

    // (3) settings + visible sections (sorted by sort_order) in parallel.
    const [{ data: settings }, { data: sections }] = await Promise.all([
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
    if (!settings) return null;

    return {
      profile,
      settings,
      sections: sections ?? [],
      recentPosts: [], // blog deferred (D-19)
      templateSpec: minimalSpec, // local spec leads the DB row (RESEARCH Pitfall 6)
    };
  },
);
