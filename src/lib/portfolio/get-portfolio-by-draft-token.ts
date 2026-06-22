import 'server-only';

/**
 * `getPortfolioByDraftToken` — the TOKEN-GATED, SERVICE-ROLE draft read (DIST-02 /
 * D-04 / the security crux of Phase 33). This is the THIRD `PortfolioData` read shape
 * (after the cookie-less anon `get-portfolio.ts` and the authenticated owner
 * `get-portfolio-owner.ts`), and the ONLY sanctioned service-role ANONYMOUS read.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ WHY SERVICE-ROLE (D-04 / SECURITY CRUX — LOAD-BEARING):                        │
 * │ The recipient is ANONYMOUS — a cookieless visitor holding a secret link, with  │
 * │ no session to scope by. So authenticated RLS (which keys on `auth.uid()`)       │
 * │ cannot be the authorization. The TOKEN itself IS the authorization: this read   │
 * │ uses `supabaseAdmin` (RLS bypassed) but is gated STRICTLY by a valid,            │
 * │ non-expired, non-revoked token lookup, then reads ONLY the portfolio that token  │
 * │ row points at. The ONLY request-derived value that ever reaches a query is the   │
 * │ token (an exact-match key); `portfolio_id`/`user_id` come FROM the validated row,│
 * │ never from the request — so a token can never widen the read to another tenant.  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ISOLATION (D-22 — LOAD-BEARING): this module is `import 'server-only'` (first line)
 * and is imported ONLY by `/draft/[token]/page.tsx`. It MUST stay physically separate
 * from `get-portfolio.ts` (the cookie-less anon public read): the public `/[username]`
 * path must never transitively import a service-role client, which would drag the
 * service-role key toward the public bundle and risk the SSG posture. `/draft/[token]`
 * is its own dynamic route, fully isolated from the `/[username]` SSG instance.
 *
 * SECURITY (threat register T-33-05..T-33-11):
 * - T-33-05 (token guessing): the token FORMAT (`/^[A-Za-z0-9_-]{43}$/`, the
 *   base64url shape of a 256-bit `randomBytes(32)`) is validated BEFORE any query, so
 *   a malformed/short token is rejected without touching the DB.
 * - T-33-06 (leaked link lives forever): expiry (`expires_at < now()`) AND revoke
 *   (`revoked_at IS NOT NULL`) are enforced HERE, at read time — a leaked-but-revoked
 *   or expired link resolves to null INSTANTLY (the route then 404s).
 * - T-33-07 (cross-portfolio leak): the read is scoped strictly to the token row's
 *   `user_id`/`portfolio_id`; no other portfolio is reachable.
 * - T-33-08 (private-column leak): the projection is EXPLICIT column-by-column
 *   (PublicProfile/PublicSettings/PublicSection) — NEVER `select('*')`-and-spread — so
 *   `email`/`role`/`storage_used_bytes`/`locked` never reach the recipient.
 * - T-33-11 (which-condition-failed leak): every failure mode returns the SAME `null`
 *   — the route renders one generic 404, revealing nothing about WHY.
 *
 * Returns `PortfolioData | null`. `null` ⇒ the route calls `notFound()`. Projection +
 * assembly mirror `get-portfolio-owner.ts:179-220` (the explicit Public* mapping). The
 * recipient sees the UNPUBLISHED draft exactly as it WOULD publish — `visible === true`
 * sections only (a preview ≡ the would-be public page).
 */
import { resolveSpec, slugForTemplateId } from '@/components/templates/registry';
import type {
  PortfolioData,
  PublicProfile,
  PublicSection,
  PublicSettings,
} from '@/components/templates/types';
import { withHeroResumeUrl } from '@/lib/portfolio/inject-hero-resume';
import { supabaseAdmin } from '@/lib/supabase/service-role';

/**
 * The token format gate (T-33-05): the base64url shape of a 256-bit
 * `randomBytes(32)` token — exactly 43 URL-safe chars (`A-Za-z0-9_-`), no padding.
 * Validated BEFORE any DB query so a malformed token never touches Postgres.
 */
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

/**
 * Resolve the draft `PortfolioData` for a valid, active, unexpired token — or `null`
 * for ANY of: a malformed token, no matching row, an expired row, a revoked row, or a
 * genuinely missing portfolio/settings. Every null path is indistinguishable to the
 * caller (T-33-11) so the route's `notFound()` leaks nothing.
 */
export async function getPortfolioByDraftToken(
  token: string,
): Promise<PortfolioData | null> {
  // (1) FORMAT gate (T-33-05) — reject a malformed token before ANY query.
  if (typeof token !== 'string' || !TOKEN_FORMAT.test(token)) return null;

  // Service-role client (RLS bypassed — the recipient has no session). The token is
  // the SOLE authorization; everything below is scoped to the row it resolves.
  const db = supabaseAdmin;

  // (2) Exact-match lookup on the indexed token column. Read back the OWNER's
  //     portfolio_id/user_id + the expiry/revoke fields — these (NOT the request)
  //     drive every subsequent read, so the token can never widen scope (T-33-07).
  const { data: share, error: shareError } = await db
    .from('draft_shares')
    .select('portfolio_id, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle();
  // (3) No row (or a real lookup error) → null (generic 404, T-33-11).
  if (shareError || !share || !share.portfolio_id) return null;

  // (4) EXPIRY (D-02) + REVOKE (D-01) enforced at read time — a leaked link that has
  //     expired or been revoked resolves to null INSTANTLY (T-33-06).
  if (share.revoked_at !== null) return null;
  if (new Date(share.expires_at).getTime() < Date.now()) return null;

  const portfolioId = share.portfolio_id;

  // (5) Read the portfolio scoped to the token row's portfolio_id ONLY — this also
  //     yields user_id (to fetch the profile) + template_id (to resolve the slug).
  const { data: portfolio, error: portfolioError } = await db
    .from('portfolios')
    .select('id, user_id, template_id')
    .eq('id', portfolioId)
    .maybeSingle();
  if (portfolioError || !portfolio || !portfolio.id) return null;

  // The owner profile + settings + ALL sections, scoped strictly to this portfolio's
  // owner. EXPLICIT column selects (never `select('*')` on profiles — Pitfall 6) keep
  // private columns (email/role/storage_used_bytes/locked) out of the result entirely.
  const [
    { data: profile, error: profileError },
    { data: settings, error: settingsError },
    { data: sections, error: sectionsError },
  ] = await Promise.all([
    db
      .from('profiles')
      .select(
        'id, username, display_name, headline, avatar_url, resume_url, published',
      )
      .eq('id', portfolio.user_id)
      .maybeSingle(),
    // `select('*')` on portfolio_settings (mirrors get-portfolio-owner.ts:158) — the
    // multi-column comma-string select confuses the typed client into a union with
    // GenericStringError. Settings carries NO private profile column (the no-leak gate
    // is the EXPLICIT PublicSettings projection below, never the select shape), so a
    // wildcard read here is safe; the projection is still column-by-column.
    db
      .from('portfolio_settings')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .maybeSingle(),
    db
      .from('sections')
      .select('id, portfolio_id, type, sort_order, visible, content')
      .eq('portfolio_id', portfolioId)
      .order('sort_order', { ascending: true }),
  ]);
  if (profileError || settingsError || sectionsError) return null;
  if (!profile || !profile.id || !settings) return null;

  // (6) VISIBLE-ONLY projection (preview ≡ would-publish): drop hidden sections so the
  //     recipient sees exactly what WOULD go live. Map the contract columns explicitly.
  const projectedSections: PublicSection[] = (sections ?? [])
    .filter((s) => s.visible === true)
    .map((s) => ({
      id: s.id,
      portfolio_id: s.portfolio_id,
      type: s.type,
      sort_order: s.sort_order,
      visible: s.visible,
      content: s.content,
    }));

  // Explicit Public* projection (T-33-08) — NO email/role/storage_used_bytes/locked.
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
    socials: settings.socials,
    location: settings.location,
    phone: settings.phone,
  };

  // Resolve the slug from the persisted template_id via the STATIC UUID map (no DB
  // join — Pitfall 6). The draft renders the owner's CURRENT template.
  const templateSlug = slugForTemplateId(portfolio.template_id);

  return {
    profile: profileData,
    settings: settingsData,
    // D-14: inject the LIVE profiles.resume_url into the hero content so the draft's
    // "Download CV" button matches the public render (single source of truth).
    sections: withHeroResumeUrl(projectedSections, profile.resume_url ?? null),
    portfolioId: portfolio.id,
    recentPosts: [], // the draft preview does not render the homepage post teaser.
    templateSlug,
    templateSpec: resolveSpec(templateSlug),
  };
}
