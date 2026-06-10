/**
 * The `PortfolioData` contract (TMPL-03 engine half / CONTEXT D-19).
 *
 * This is the SINGLE typed shape that the entire rest of Phase 3 imports: the
 * public read service (`get-portfolio.ts`, 03-02) assembles it, the page (03-05)
 * passes it to the renderer, and every `minimal/sections/*.tsx` component (03-06/07/08)
 * consumes it. Defining it here — derived directly from the generated `public_*`
 * view Row types — means downstream executors receive the contract instead of
 * reverse-engineering it.
 *
 * The member types are derived from `Database['public']['Views']` (the
 * `security_invoker` public views from Phase 1) so they automatically track any
 * `supabase gen types` regeneration.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ LOAD-BEARING NULLABILITY NOTE (database.ts — verified):                       │
 * │ EVERY column on EVERY `public_*` view Row is nullable (`| null`) — including  │
 * │ `id`, `username`, `theme_mode`, and `content`. Generated view types are       │
 * │ always fully nullable. Consumers MUST null-guard (`?.` / `??`) before using   │
 * │ any field — e.g. `profile.id` is `string | null`, so `.eq('user_id',          │
 * │ profile.id)` and every render access needs handling. This is the #1           │
 * │ type-friction point in this phase.                                            │
 * └─────────────────────────────────────────────────────────────────────────────┘
 */
import type { Database } from '@/types/database';

import type { TemplateSpec } from './minimal/spec';

type V = Database['public']['Views'];

/** Public profile fields (no email / role / storage — FND-02). All columns `| null`. */
export type PublicProfile = V['public_profiles']['Row'];

/** Public portfolio settings (theme / SEO / social). All columns `| null`. */
export type PublicSettings = V['public_portfolio_settings']['Row'];

/** A single public (visible-only) section row. `content` is `Json | null`. */
export type PublicSection = V['public_sections']['Row'];

/**
 * A published blog post as the public read returns it for the homepage teaser
 * (D-16) — the full `public_blog_posts` view Row (EVERY column `| null`, the
 * all-nullable view-Row rule). The dedicated `/blog` routes use the richer
 * `PublishedPost` shape from `get-posts.ts` (the same view + a derived
 * `reading_time`); the teaser only needs the raw projected columns and null-guards
 * each one. Derived from the generated view type so it tracks `gen types`.
 */
export type PublicPost = V['public_blog_posts']['Row'];

/**
 * The assembled portfolio data passed to a template.
 *
 * - `profile` / `settings` come from the corresponding public views (one row each).
 * - `sections` is the visible-only set, pre-sorted by `sort_order`.
 * - `portfolioId` is the portfolio's id (from `public_portfolios.id`, `| null` per
 *   the view-Row rule). The dedicated blog routes use it to read this portfolio's
 *   published posts via the SEPARATE cookie-less `get-posts.ts` lane (D-22) — it
 *   spares them a second `public_profiles`/`public_portfolios` round-trip.
 * - `recentPosts` carries the latest N published posts (D-16), populated by a SECOND
 *   cookie-less `public_blog_posts` read inside `get-portfolio.ts` (a second
 *   cookie-LESS query does NOT break D-22 — only a cookies()/headers() read does).
 *   The `blog_preview` teaser reads it as its PRIMARY source, falling back to the
 *   legacy `content.items[]` only when empty. Empty `[]` when the blog is unused.
 * - `templateSlug` is the resolved template slug (`slugForTemplateId(
 *   portfolio.template_id)` — Phase 7 / D-P7-13), derived from the STATIC UUID map
 *   (NOT a request-time DB read, so `/[username]` stays ISR — Pitfall 6). The page
 *   passes it straight to `<TemplateRenderer slug={…}>` without re-deriving.
 * - `templateSpec` is the spec for that SAME slug (`resolveSpec(slug)` — the
 *   field-gating source of truth), not a DB read (RESEARCH Pitfall 6).
 */
export interface PortfolioData {
  profile: PublicProfile;
  settings: PublicSettings;
  sections: PublicSection[];
  /** The portfolio id (`public_portfolios.id`, `| null`) — feeds the blog post reads (D-16). */
  portfolioId: string | null;
  /** Latest N published posts for the homepage teaser (D-16); `[]` when unused. */
  recentPosts: PublicPost[];
  templateSlug: string;
  templateSpec: TemplateSpec;
}
