/**
 * `GET /api/account/export` — download the owner's portfolio content as a versioned
 * JSON attachment (ACCT-04 / D-13 / D-14).
 *
 * This is an AUTHENTICATED RLS OWNER READ — it runs on the user's OWN cookie/RLS
 * `createClient()` session, NEVER `supabaseAdmin` / the service-role key (D-14 /
 * ACCT-05 / T-19-18). It is a read-only, non-destructive export, so it does NOT
 * require the current-password reauth the password/email/delete actions enforce
 * (D-01 explicitly exempts export). Identity is the VERIFIED claim subject
 * (`getVerifiedClaims()` → `sub`); a missing/invalid session is a 401 (T-19-19).
 *
 * EXPLICIT-COLUMN ALLOWLISTS (D-13 / T-19-17). The export ships the user's own
 * AUTHORED CONTENT only:
 *   • profile  — the NON-SECRET content columns ONLY (username, display_name,
 *     headline, avatar_url, resume_url). EXCLUDES email / role / storage_used_bytes
 *     / locked / locked_reason / deleted_at / created_at and the internal columns
 *     (id / onboarded_at / updated_at / published). Never `select('*')` on profiles.
 *   • settings — the user-facing portfolio_settings columns INCLUDING `email_public`
 *     (the intended-public contact address — an allowed exception to the bare-"email"
 *     exclusion). EXCLUDES the internal id / portfolio_id / updated_at.
 *   • sections — ALL sections INCLUDING HIDDEN ones (no `visible` filter — D-13).
 *   • blog_posts — the authored post fields (the column is `body_md`, not `body`).
 * The contact-inbox `messages` table is DELIBERATELY NOT read (D-13 — it is
 * third-party VISITOR PII, not the user's own content; T-19-17).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ WHY THE READS ARE OWNER-SCOPED (not bare RLS `.single()`):                     │
 * │ `profiles` and `portfolio_settings` BOTH carry a PUBLIC-SELECT RLS policy      │
 * │ (`profiles public select` on published rows, `portfolio_settings public select`│
 * │ on public portfolios — 004_rls_policies.sql:70/117) IN ADDITION to the owner   │
 * │ policy. So an authenticated owner's UNFILTERED read returns their OWN row PLUS  │
 * │ every PUBLISHED profile / public portfolio's row — a `.single()` then fails     │
 * │ (PGRST116) and an unscoped read would LEAK other tenants' published content     │
 * │ into the export. RLS alone does NOT scope these to one tenant. The route        │
 * │ therefore scopes every read to the VERIFIED owner: `profiles` by `id = sub`,    │
 * │ and settings/sections/blog_posts by the owner's OWN `portfolios.id` (resolved   │
 * │ via `user_id = sub`). The `sub` is the server-verified claim, never client      │
 * │ input — cross-tenant export (T-19-16) is impossible: a different user's rows    │
 * │ are filtered out by the `sub`-derived scope AND by RLS.                          │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Mirrors the route-handler skeleton in `api/contact/route.ts` (`runtime='nodejs'`,
 * generic typed JSON errors — never an internal-detail leak).
 */
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

// Match the sibling account/contact route handlers: the Node runtime.
export const runtime = 'nodejs';

/** D-13 non-secret profile content allowlist (NEVER `select('*')` on profiles). */
const PROFILE_COLUMNS = 'username, display_name, headline, avatar_url, resume_url';

/**
 * D-13 user-facing portfolio_settings allowlist — INCLUDES `email_public` (the
 * intended-public contact address); EXCLUDES the internal id / portfolio_id /
 * updated_at. portfolio_settings has no secret columns, but the allowlist is
 * explicit so a future added column is never silently exported.
 */
const SETTINGS_COLUMNS =
  'color_preset, email_public, favicon_url, font_preset, location, ' +
  'meta_description, og_image_url, page_title, phone, socials, ' +
  'theme_mode, visitor_theme_toggle';

/** ALL sections incl. hidden — no `visible` filter (D-13). */
const SECTION_COLUMNS = 'type, sort_order, visible, content';

/** Authored blog-post fields (the markdown column is `body_md`). */
const BLOG_POST_COLUMNS =
  'title, slug, body_md, excerpt, cover_image_url, cover_image_alt, ' +
  'meta_title, meta_description, tags, published, published_at';

export async function GET(): Promise<Response> {
  // 1) Verified-identity gate — NO reauth (read-only, D-14). A missing/invalid
  //    session (or a claim with no subject) is a 401; never coerce `sub` to ''.
  const claims = await getVerifiedClaims();
  const sub = (claims as { sub?: string } | null)?.sub;
  if (!sub) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2) Authenticated RLS client — the owner's OWN cookie/RLS session. NEVER the
  //    service-role admin client (D-14 / T-19-18).
  const supabase = await createClient();

  // 3) Resolve the owner's OWN portfolio id (scope for settings/sections/blog_posts).
  //    `portfolios own all` (auth.uid()=user_id) scopes this to the owner; the
  //    `.eq('user_id', sub)` is the explicit owner scope (the public-select policy
  //    can otherwise surface other public portfolios). A user with no portfolio
  //    exports empty content rather than erroring.
  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id')
    .eq('user_id', sub)
    .maybeSingle();
  const portfolioId = (portfolio as { id?: string } | null)?.id ?? null;

  // 4) The four owner-scoped content reads, in parallel. Every read is scoped to
  //    the verified owner (profiles by `id = sub`; the rest by the owner's own
  //    portfolio id) — RLS's public-select policy means a bare read would return
  //    OTHER tenants' published rows, so the explicit scope is REQUIRED for both
  //    correctness (a single own row) and tenant isolation (T-19-16).
  const [profileRes, settingsRes, sectionsRes, postsRes] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', sub).single(),
    portfolioId
      ? supabase
          .from('portfolio_settings')
          .select(SETTINGS_COLUMNS)
          .eq('portfolio_id', portfolioId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    portfolioId
      ? supabase
          .from('sections')
          .select(SECTION_COLUMNS)
          .eq('portfolio_id', portfolioId)
      : Promise.resolve({ data: [], error: null }),
    portfolioId
      ? supabase
          .from('blog_posts')
          .select(BLOG_POST_COLUMNS)
          .eq('portfolio_id', portfolioId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // A profile read error is the one hard failure (the owner must have an own row);
  // a generic 500 with no internal detail (never leak the PostgREST message).
  if (profileRes.error || !profileRes.data) {
    return new Response(JSON.stringify({ error: 'export_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 5) The versioned envelope (D-13). `messages` is intentionally absent (visitor
  //    PII — D-13 / T-19-17). Pretty-printed for a human-readable download.
  const body = JSON.stringify(
    {
      export_version: 1,
      exported_at: new Date().toISOString(),
      profile: profileRes.data ?? null,
      settings: settingsRes.data ?? null,
      sections: sectionsRes.data ?? [],
      blog_posts: postsRes.data ?? [],
    },
    null,
    2,
  );

  // 6) The download response — a JSON attachment (D-14). The Content-Disposition
  //    makes the browser save it as a file.
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="portsmith-export.json"',
    },
  });
}
