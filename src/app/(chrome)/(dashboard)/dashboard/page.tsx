/**
 * The CMS dashboard editor — `/dashboard` (04-09 / D-P4-04, CMS-06 / CMS-07).
 *
 * This RSC is the integration slice that REPLACES the Phase-2 placeholder with the
 * real editor. On every load it:
 *
 *   1. AUTH-GATES via `getVerifiedClaims()` (verified JWT, AUTH-05 — NEVER the
 *      spoofable cookie-session getter) and `redirect('/login')` when there is no
 *      valid session (T-04-09a). The middleware already bounces unauthenticated
 *      requests off `/dashboard`; this is defense-in-depth at the page boundary.
 *   2. BOOTSTRAPS (idempotent) via `ensurePortfolio()` — the `initialize_portfolio`
 *      RPC is SECURITY DEFINER + auth.uid-guarded + IDEMPOTENT, so calling it on
 *      every load is a cheap no-op after the first (RESEARCH OQ-3 / D-P4-07). The
 *      FIRST call seeds the 7 default sections with neutral starter content.
 *   3. LOADS the owner's OWN unpublished portfolio — INCLUDING HIDDEN SECTIONS
 *      (CR-01: `{ includeHidden: true }`) — via `getPortfolioOwnerByUsername`
 *      (the authenticated, base-table, owner-scoped read), so the editor shows
 *      last-saved UNPUBLISHED content AND every hidden section carrying its real
 *      `visible` flag (the owner must be able to re-show a hidden section; the
 *      eye-toggle must round-trip). Hands the loaded rows to the `'use client'`
 *      `EditorShell` island. NOTE: the DRAFT-MODE PREVIEW path
 *      (`[username]/page.tsx`) calls the SAME read WITHOUT `includeHidden`, so the
 *      preview still drops hidden sections and matches the public page.
 *
 * TWO-LAYER IDENTITY (SHARED-E / D-P4-04, LOAD-BEARING): this page and the editor
 * it renders import NO template component and NO template token. The editor is
 * template-DECOUPLED — it reads/writes only the `OwnerPortfolioData` shape and
 * renders in chrome (Evergreen/Copper, Inter) tokens. The only chrome element that
 * ever overlays a template surface is the PreviewBanner, which lives on the public
 * `[username]` page, never here.
 *
 * NEXT 16: this is an RSC; `cookies()` (read transitively by the owner client) is
 * async and awaited inside `createClient`. The page never reads the request host —
 * the username is resolved from the verified profile row (PUB-03).
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { RegisterOwnUsername } from '@/components/dashboard/register-own-username';
import { EditorShell } from '@/components/editor/editor-shell';
import { getOwnerAnalytics } from '@/lib/analytics/owner-analytics';
import { ensurePortfolio } from '@/lib/cms/bootstrap-portfolio';
import { portfolioQrSvg } from '@/lib/qr';
import { getPortfolioOwnerByUsername } from '@/lib/portfolio/get-portfolio-owner';
import { getAvailableTemplates } from '@/lib/templates/available-templates';
import {
  ONBOARDING_SKIP_COOKIE,
  shouldRedirectToOnboarding,
} from '@/lib/onboarding/skip-cookie';
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

/** The dashboard is owner-private + always reflects last-saved (unpublished) state. */
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // 1) AUTH GATE — verified identity only (AUTH-05, never getSession). No session
  //    → bounce to login (the middleware also guards this route).
  const claims = await getVerifiedClaims();
  if (!claims) redirect('/login');

  // 2) IDEMPOTENT BOOTSTRAP on load (RESEARCH OQ-3 / D-P4-07). A null return means
  //    no valid session at the RPC boundary → bounce to login as well.
  const bootstrap = await ensurePortfolio();
  if (!bootstrap) redirect('/login');

  // 3) Resolve the caller's OWN username from the verified profile row (PUB-03 —
  //    never the request host) so the owner read + the editor's revalidate paths
  //    use the canonical slug. WR-05: a verified claim MUST carry a subject — a
  //    missing `sub` is a hard auth failure, never coerced to '' (which would make
  //    the profile read a guaranteed 0-row no-op).
  const supabase = await createClient();
  const sub = (claims as { sub?: string }).sub;
  if (!sub) redirect('/login');
  //    The select also reads `storage_used_bytes` (D-09) — a PROTECTED column the
  //    owner may READ for their own row under RLS; it is threaded into the
  //    read-only StorageMeter and NEVER written from the client (T-05-22).
  //    Also reads `onboarded_at` (D-02 first-run gate, 18-03) — the owner's own
  //    completion marker (null = not yet onboarded), readable by the owner for their
  //    own row under RLS; it drives the wizard-vs-editor routing below.
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('username, storage_used_bytes, locked, onboarded_at')
    .eq('id', sub)
    .maybeSingle();
  // WR-02 (D-14 defense-in-depth): a suspended account must never load an authed
  // surface even if the login-action signOut that should have torn down its session
  // failed transiently. Re-check `locked` on the verified own-row read and bounce a
  // locked account to /login (a fresh login there returns the generic suspended copy).
  // `locked` is readable by the owner for their own row under `profiles own select`.
  if ((profileRow as { locked?: boolean } | null)?.locked === true) {
    redirect('/login');
  }
  const username = (profileRow as { username?: string } | null)?.username ?? '';
  const storageUsedBytes =
    (profileRow as { storage_used_bytes?: number } | null)?.storage_used_bytes ?? 0;
  if (!username) {
    // A verified session with no profile row should not happen post-bootstrap, but
    // degrade safely rather than render a broken editor.
    redirect('/login');
  }

  // 3a) FIRST-RUN ROUTING GATE (D-02 / ONB-02 / ONB-05, 18-03). This RSC is the
  //     single chokepoint every authenticated entry path (login, email-confirm,
  //     direct nav) funnels through, so the gate lives here — NOT in middleware
  //     (which stays lean: no per-request DB read; the "no code between
  //     createServerClient and getClaims" rule is preserved).
  //
  //     Route a NOT-YET-ONBOARDED owner (`onboarded_at IS NULL`) into `/onboarding`
  //     unless the one-shot `onboarding-skip` cookie is present (a soft-skipper, D-04).
  //     The skip cookie is READ-AND-CLEARED (one-shot): when present, this visit falls
  //     through to the editor and the cookie is deleted, so the NEXT visit (cookie gone,
  //     `onboarded_at` still null) re-fires the gate — escapable for one visit, never a
  //     loop. A finished/published owner has `onboarded_at` non-null (stamped by
  //     `markOnboardedAndPublish`, plus the 18-01 founder backfill) → the predicate is
  //     false → NEVER bounced (ONB-05). The redirect target is the LITERAL internal
  //     `/onboarding` — no client-supplied destination, so no open redirect
  //     (T-18-redirect). `redirect()` is at top level (it throws NEXT_REDIRECT).
  //
  //     ONE-SHOT MECHANICS (D-04 / ONB-05): this RSC only READS the skip cookie — a
  //     Server Component may NOT mutate cookies (Next 16 throws
  //     ReadonlyRequestCookiesError on `.set`/`.delete` outside a Server Action /
  //     Route Handler; the codebase clears its other one-shot signals from a handler,
  //     never an RSC). The CLEAR therefore happens in `middleware.ts`, which runs
  //     BEFORE this RSC on the `/dashboard` request and writes the deletion onto the
  //     outgoing response cookies. So the cookie is present for THIS render (the
  //     soft-skipper falls through to the editor) and gone on the NEXT request — the
  //     gate re-fires while `onboarded_at` is still null (escapable for one visit,
  //     never a loop). The durable `onboarded_at` is untouched (D-04 — resumable).
  const onboardedAt =
    (profileRow as { onboarded_at?: string | null } | null)?.onboarded_at ?? null;
  const cookieStore = await cookies();
  const skipCookiePresent = cookieStore.get(ONBOARDING_SKIP_COOKIE) != null;
  if (shouldRedirectToOnboarding(onboardedAt, skipCookiePresent)) {
    redirect('/onboarding');
  }

  // 4) Load the owner's OWN unpublished portfolio INCLUDING HIDDEN SECTIONS
  //    (CR-01 — `{ includeHidden: true }`) via the authenticated base-table read,
  //    so the editor shows last-saved content AND every hidden section (carrying
  //    its real `visible` flag) the owner can re-show. Owner-only by construction.
  //    07-05: `data.templateSlug` (the owner's CURRENT template, resolved from the
  //    static map by 07-04) rides along here and is threaded into EditorShell → the
  //    TemplatePicker so the gallery marks the "● Current" card.
  const data = await getPortfolioOwnerByUsername(username, { includeHidden: true });
  if (!data) redirect('/login');
  const templateSlug = data.templateSlug; // the current template (→ the picker marker).

  // 4a) GATE-02 (D-P12-14): resolve the caller's ALLOWED templates (public ∪
  //     granted-to-me) at the DATA LAYER under the authenticated RLS client — NOT
  //     hidden in the UI. `getAvailableTemplates()` is `server-only`; the result is
  //     PLAIN serializable `{ slug, restricted }[]` threaded into the (zod-free)
  //     picker as a prop, so zod/DB never reach the public/client bundle (D-25). Read
  //     `portfolios.template_fallback_at` (a DASHBOARD-ONLY signal, owner-scoped under
  //     RLS) — a non-null value means a prior auto-fallback fired, so surface the
  //     one-time "pick another" notice (D-P12-10); the notice clears on dismiss via
  //     `clearTemplateFallbackNotice`. The public ISR page never reads this column, so
  //     no public-path change (D-22 untouched).
  const allowedTemplates = await getAvailableTemplates();
  const { data: fallbackRow } = await supabase
    .from('portfolios')
    .select('template_fallback_at')
    .eq('user_id', sub)
    .maybeSingle();
  const showFallbackNotice =
    (fallbackRow as { template_fallback_at?: string | null } | null)?.template_fallback_at != null;

  // 5) Unread-message count for the inbox nav badge (06-05 / CONT-02). A cheap
  //    head-count under RLS via the AUTHENTICATED client (NEVER supabaseAdmin) —
  //    the `messages own select` policy scopes it to the owner's portfolio, so
  //    `is_read=false` already means "unread, mine". The badge is the one
  //    sanctioned scarce-accent "new" signal on the nav (UI-SPEC Surface 3).
  const { count: unreadCount } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);

  // 6) Owner analytics for the glanceable dashboard card (15-05 / ANLY-01 / D-01 /
  //    D-12). The read runs under the SAME authenticated RLS client this page already
  //    uses — the `page_views own select` policy scopes it to the owner's own
  //    portfolio (D-13: no service-role, no DEFINER RPCs, no explicit filter). Calm
  //    defaults on error, so a transient read failure renders the card's error state
  //    rather than breaking the dashboard.
  const ownerAnalytics = await getOwnerAnalytics();

  // 7) 33-03 / DIST-01 (D-06): generate the public-page QR SVG SERVER-SIDE (qrcode is
  //    `server-only`), encoding `siteUrl('/' + username)` — the PUBLIC url, never the
  //    draft token, never the request Host. Threaded into EditorShell as a PLAIN
  //    string prop so the QR lib stays OFF the dashboard client bundle (the Share
  //    panel renders it as static markup + offers a Blob download).
  const qrSvg = portfolioQrSvg(username);

  return (
    <>
      {/* D-06 self-view writer: registers THIS owner's username in
          localStorage['portsmith-own-usernames'] so the public-page beacon skips
          their self-views + draft previews. Renders null — a write-only effect,
          mounted as a SIBLING of EditorShell (not threaded through it). */}
      <RegisterOwnUsername username={username} />

      {/* ANLY-UX-FIX: the glanceable owner analytics (15-UI-SPEC Surface B) moved OUT
          of the persistent above-the-editor banner (it ate vertical space on every
          visit) and INTO an on-demand modal opened from the editor header. The shape
          is threaded into EditorShell as a plain serializable prop; the card itself is
          unchanged. */}
      <EditorShell
        data={data}
        portfolioId={bootstrap.portfolioId}
        ownerId={sub}
        storageUsedBytes={storageUsedBytes}
        unreadMessageCount={unreadCount ?? 0}
        // 07-05: the owner's CURRENT template slug → the TemplatePicker "● Current" mark.
        currentTemplateSlug={templateSlug}
        // 12-04 / GATE-02: the data-layer allowed-list (public ∪ granted-to-me) — the
        // picker renders one card per allowed slug; `restricted` drives the "Exclusive"
        // marker. Plain serializable data (no zod) → stays off the public/client bundle.
        allowedTemplates={allowedTemplates}
        // 12-04 / D-P12-10: surface the one-time post-fallback "pick another" notice.
        showFallbackNotice={showFallbackNotice}
        // 33-03 / DIST-01 (D-06): the server-generated public-page QR SVG (qrcode is
        // server-only) — a plain string prop, so the QR lib stays off the client bundle.
        qrSvg={qrSvg}
        // ANLY-UX-FIX: the glanceable analytics shape → the header "Analytics" modal.
        analytics={ownerAnalytics}
      />
    </>
  );
}
