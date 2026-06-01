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
 * The assembled portfolio data passed to a template.
 *
 * - `profile` / `settings` come from the corresponding public views (one row each).
 * - `sections` is the visible-only set, pre-sorted by `sort_order`.
 * - `recentPosts` is always `[]` in this milestone — the blog is deferred (D-19);
 *   `never[]` documents that nothing is ever pushed into it here.
 * - `templateSpec` is the local spec (the P3 field-gating source of truth), not a
 *   DB read (RESEARCH Pitfall 6).
 */
export interface PortfolioData {
  profile: PublicProfile;
  settings: PublicSettings;
  sections: PublicSection[];
  recentPosts: never[];
  templateSpec: TemplateSpec;
}
