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
import { redirect } from 'next/navigation';

import { EditorShell } from '@/components/editor/editor-shell';
import { ensurePortfolio } from '@/lib/cms/bootstrap-portfolio';
import { getPortfolioOwnerByUsername } from '@/lib/portfolio/get-portfolio-owner';
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
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('username, storage_used_bytes')
    .eq('id', sub)
    .maybeSingle();
  const username = (profileRow as { username?: string } | null)?.username ?? '';
  const storageUsedBytes =
    (profileRow as { storage_used_bytes?: number } | null)?.storage_used_bytes ?? 0;
  if (!username) {
    // A verified session with no profile row should not happen post-bootstrap, but
    // degrade safely rather than render a broken editor.
    redirect('/login');
  }

  // 4) Load the owner's OWN unpublished portfolio INCLUDING HIDDEN SECTIONS
  //    (CR-01 — `{ includeHidden: true }`) via the authenticated base-table read,
  //    so the editor shows last-saved content AND every hidden section (carrying
  //    its real `visible` flag) the owner can re-show. Owner-only by construction.
  const data = await getPortfolioOwnerByUsername(username, { includeHidden: true });
  if (!data) redirect('/login');

  return (
    <EditorShell
      data={data}
      portfolioId={bootstrap.portfolioId}
      ownerId={sub}
      storageUsedBytes={storageUsedBytes}
    />
  );
}
