/**
 * `getPortfolioOwnerByUsername` — the AUTHENTICATED, owner-scoped read that backs
 * Draft Mode preview (TMPL-05 / D-P4-09 / RESEARCH Pitfall 3).
 *
 * This is the SEPARATE counterpart to the cookie-LESS public read
 * (`get-portfolio.ts`). It assembles the SAME `PortfolioData` shape — so the
 * `minimal` template renders byte-for-byte identically — but it INVERTS two
 * things versus the public read:
 *
 *   1. CLIENT: it uses the AUTHENTICATED cookie/RLS `createClient()` from
 *      `@/lib/supabase/server` (NOT the anon `@supabase/supabase-js` client),
 *      because the owner needs to read their OWN unpublished + hidden rows under
 *      their `own_*` RLS policies.
 *   2. TABLES: it reads the BASE tables (`profiles` / `portfolios` /
 *      `portfolio_settings` / `sections`) — NOT the `public_*` views, which filter
 *      `published=true` + `visible=true` and would hide exactly the unpublished /
 *      hidden content Draft Mode exists to preview (Pitfall 3).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ISOLATION RULE (SHARED-F / RESEARCH Pitfall 2 — LOAD-BEARING):                │
 * │ This module MUST stay separate from `get-portfolio.ts`. The public path must  │
 * │ never transitively import a cookie-reading client (`@/lib/supabase/server`    │
 * │ calls `await cookies()`), which would silently opt `/[username]` into DYNAMIC │
 * │ rendering for EVERY visitor — killing ISR and the TMPL-04 perf budget. The    │
 * │ page reaches this module ONLY inside the `draftMode().isEnabled` branch.      │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * SECURITY (threat register T-04-07a/d/e):
 * - getVerifiedClaims() (verified JWT via getClaims) — NEVER getSession() (AUTH-05).
 * - OWNER-ONLY (defense-in-depth over RLS): the caller's own profile is resolved
 *   from `claims.sub`; if the requested `username` is not the caller's own, we
 *   return null. RLS would already scope the base-table reads to the caller's own
 *   rows, but the explicit ownership check makes a non-owner preview impossible
 *   even before any row read (the integration test proves non-owner → null).
 * - VISIBILITY (D-P4-09 / CR-01): this read backs TWO consumers with OPPOSITE
 *   needs, so visibility filtering is the CALLER's choice via `opts.includeHidden`:
 *     · the DRAFT-MODE PREVIEW ([username]/page.tsx) must DROP hidden sections so
 *       the preview is byte-for-byte the PUBLIC page (hidden stays hidden) — it
 *       calls with the default (`includeHidden` falsy) and gets visible-only rows;
 *     · the OWNER EDITOR (dashboard/page.tsx) must SEE ALL sections carrying their
 *       REAL `visible` flag so the owner can re-show a hidden section (the
 *       eye-toggle must round-trip) — it calls with `{ includeHidden: true }`.
 *   Either way every returned row carries its REAL `visible` value; the option
 *   only controls whether hidden rows are present.
 *
 * `import 'server-only'` keeps this (and the cookie/env reads) out of any client
 * bundle.
 */
import 'server-only';

import { resolveSpec, slugForTemplateId } from '@/components/templates/registry';
import type {
  PortfolioData,
  PublicProfile,
  PublicSection,
  PublicSettings,
} from '@/components/templates/types';
import { createClient } from '@/lib/supabase/server';

/** The owner read returns the template contract PLUS the live `published` flag the
 *  PreviewBanner needs ("This page is not public yet."). */
export type OwnerPortfolioData = PortfolioData & { published: boolean };

/**
 * Options for {@link getPortfolioOwnerByUsername}.
 *
 * `includeHidden` (CR-01) selects the consumer's visibility contract:
 *   - omitted / false → DRAFT-MODE PREVIEW: hidden sections are dropped so the
 *     preview matches the public page exactly (D-P4-09).
 *   - true            → OWNER EDITOR: ALL sections are returned with their real
 *     `visible` flag so the owner can see + re-show hidden sections.
 */
export interface GetPortfolioOwnerOptions {
  /** Return hidden sections too (the editor needs them; the preview must not). */
  includeHidden?: boolean;
}

/**
 * Assemble {@link OwnerPortfolioData} for the AUTHENTICATED caller's OWN portfolio
 * — including UNPUBLISHED + (hidden-filtered) rows — or `null` when:
 *   - there is no verified session,
 *   - the requested `username` is not the caller's own (owner-only), or
 *   - the caller has no portfolio/settings yet (genuine not-found).
 *
 * Reads BASE tables under RLS; throws on a REAL read error (so the page renders an
 * error boundary rather than a misleading 404) but returns `null` on a genuine
 * missing row — the same null-guard discipline as `get-portfolio.ts`.
 *
 * NOT wrapped in React `cache()`: the cookie/RLS client makes this request-scoped
 * (the page calls it once, only inside the draft branch), and the page's own
 * `generateMetadata` stays on the cookie-less public read.
 */
export async function getPortfolioOwnerByUsername(
  username: string,
  opts: GetPortfolioOwnerOptions = {},
): Promise<OwnerPortfolioData | null> {
  const includeHidden = opts.includeHidden === true;
  // Authenticated cookie/RLS client — the owner's own_* policies let them read
  // their UNPUBLISHED + HIDDEN base-table rows (Pitfall 3).
  const db = await createClient();

  // (0) Verified identity (AUTH-05 — getClaims, never getSession).
  const {
    data: claimsData,
    error: claimsError,
  } = await db.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) return null; // no verified session.
  const callerId = claimsData.claims.sub as string;

  // (1) Resolve the CALLER's OWN profile by id (RLS scopes this to their row).
  //     `published` rides along for the banner. maybeSingle() → no row = null.
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id, username, display_name, headline, avatar_url, resume_url, published')
    .eq('id', callerId)
    .maybeSingle();
  if (profileError) {
    throw new Error(`profiles read failed: ${profileError.message}`);
  }
  if (!profile || !profile.id) return null; // no profile row.

  // (2) OWNER-ONLY (T-04-07a): the requested username MUST be the caller's own.
  //     Any other username → null (a non-owner can never preview someone else's
  //     unpublished portfolio, even though RLS would already block the row reads).
  if (profile.username !== username) return null;

  // (3) The caller's own portfolio (RLS-scoped to user_id = callerId).
  //     Select `template_id` too (Phase 7) so the preview renders the owner's
  //     PERSISTED template, not a hardcoded 'minimal' — resolved via the static map.
  const { data: portfolio, error: portfolioError } = await db
    .from('portfolios')
    .select('id, template_id')
    .eq('user_id', profile.id)
    .maybeSingle();
  if (portfolioError) {
    throw new Error(`portfolios read failed: ${portfolioError.message}`);
  }
  if (!portfolio || !portfolio.id) return null; // no portfolio yet.

  // (4) settings + ALL sections (base table carries hidden rows) in parallel.
  const [
    { data: settings, error: settingsError },
    { data: sections, error: sectionsError },
  ] = await Promise.all([
    db
      .from('portfolio_settings')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .maybeSingle(),
    db
      .from('sections')
      .select('*')
      .eq('portfolio_id', portfolio.id)
      .order('sort_order', { ascending: true }),
  ]);
  if (settingsError) {
    throw new Error(`portfolio_settings read failed: ${settingsError.message}`);
  }
  if (sectionsError) {
    throw new Error(`sections read failed: ${sectionsError.message}`);
  }
  if (!settings) return null; // no settings row (genuine not-found).

  // (5) VISIBILITY (D-P4-09 / CR-01): map EVERY base-table row carrying its REAL
  //     `visible` flag (never forced true), then drop hidden rows ONLY when the
  //     caller did not opt in to seeing them. The PREVIEW (default) keeps the
  //     visible-only filter so it matches the public page; the EDITOR
  //     (`includeHidden: true`) keeps hidden rows so the eye-toggle can round-trip.
  const projectedSections: PublicSection[] = (sections ?? [])
    .filter((s) => includeHidden || s.visible === true)
    .map((s) => ({
      id: s.id,
      portfolio_id: s.portfolio_id,
      type: s.type,
      sort_order: s.sort_order,
      visible: s.visible, // the REAL flag — the editor relies on it (CR-01)
      content: s.content,
    }));

  // (6) Project the base rows into the `public_*`-shaped contract so the template
  //     renderer consumes an identical `PortfolioData` (the view Row types are the
  //     contract; base rows carry a superset, so we map the contract columns).
  const profileData: PublicProfile = {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    headline: profile.headline,
    avatar_url: profile.avatar_url,
    resume_url: profile.resume_url,
    published: profile.published,
  };

  const settingsData: PublicSettings = {
    portfolio_id: settings.portfolio_id,
    color_preset: settings.color_preset,
    font_preset: settings.font_preset,
    theme_mode: settings.theme_mode,
    visitor_theme_toggle: settings.visitor_theme_toggle,
    page_title: settings.page_title,
    meta_description: settings.meta_description,
    og_image_url: settings.og_image_url,
    favicon_url: settings.favicon_url,
    email_public: settings.email_public,
    github_url: settings.github_url,
    linkedin_url: settings.linkedin_url,
    twitter_url: settings.twitter_url,
    dribbble_url: settings.dribbble_url,
    website_url: settings.website_url,
  };

  // Resolve the slug from the owner's persisted `portfolios.template_id` via the
  // STATIC map (no extra DB read; Pitfall 6) so the preview renders the owner's
  // CURRENT template. The candidate-slug preview override lands in 07-05; here the
  // draft branch just stops hardcoding 'minimal'.
  const templateSlug = slugForTemplateId(portfolio.template_id);

  return {
    profile: profileData,
    settings: settingsData,
    sections: projectedSections,
    recentPosts: [], // blog deferred (D-19) — matches the public read.
    templateSlug, // owner's persisted slug (resolved from the static map).
    templateSpec: resolveSpec(templateSlug), // spec for the SAME slug (Pitfall 6).
    published: profile.published, // for the PreviewBanner "not public yet" caption.
  };
}
