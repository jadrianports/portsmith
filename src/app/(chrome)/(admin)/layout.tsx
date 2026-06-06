/**
 * (admin) route-group gate (SAFE-02 / T-06-18) — the `is_admin()` boundary.
 *
 * Every route under `(admin)` (the /admin Trust-and-Safety surface) is
 * operator-only. This async RSC layout is the FIRST line of that gate:
 *
 *   1. getVerifiedClaims()  — the verified JWT identity (AUTH-05). Uses
 *      `@supabase/ssr` `getClaims()` (signature-verified), NEVER the spoofable
 *      `getSession()` (CLAUDE.md). A null claim / missing `sub` ⇒ `notFound()`
 *      (detail-free — a non-operator is told nothing about the surface's
 *      existence; no redirect chrome that hints at /admin).
 *   2. is_admin() RE-CHECK — the caller's admin status via the Phase-1
 *      `is_admin()` SECURITY DEFINER RPC (002:232), NEVER an inline
 *      `EXISTS (SELECT … FROM profiles …)` (that re-triggers the profiles RLS
 *      policies → "infinite recursion detected in policy for relation profiles",
 *      the documented foot-gun the helper exists to avoid). A non-admin ⇒
 *      `notFound()`. The `lock-action.ts` server actions ALSO re-check admin
 *      server-side (defense-in-depth) since they are independently callable.
 *
 * An admin passes through to the children, BELOW the two-tab `(admin)` nav
 * (Trust & Safety / Templates — 12-05; the nav is the only JSX added to this gate,
 * the gate logic is unchanged). [CHROME] — this is platform chrome (Evergreen &
 * Copper, Inter); it imports NO template token.
 *
 * FORCE-DYNAMIC: the gate is per-request (it reads the verified session); /admin
 * is owner-private and must NEVER be statically cached. It does not regress the
 * public `/[username]` ISR route, which is a separate, cookie-less SSG/ISR tree.
 *
 * Source: `getVerifiedClaims()` (`@/lib/supabase/server`); the `is_admin()` RPC
 * (002:232, proven in functions.test.ts); the `notFound()` detail-free gate
 * posture (Next 16 App Router).
 */
import { notFound } from 'next/navigation';

import { AdminNav } from '@/components/admin/admin-nav';
import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

/** Per-request operator gate; /admin is owner-private, never statically cached. */
export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1) Verified identity (AUTH-05 — never getSession). No session ⇒ not here.
  const claims = await getVerifiedClaims();
  const sub = claims ? (claims as { sub?: string }).sub : undefined;
  if (!sub) notFound();

  // 2) Admin re-check via the recursion-safe is_admin() SECURITY DEFINER helper
  //    (002:232) — NEVER an inline EXISTS over profiles (policy-recursion risk).
  const supabase = await createClient();
  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (error || isAdmin !== true) notFound();

  // The two-tab admin nav renders above every (admin) route's content. The gate
  // logic above is unchanged — only the returned JSX gains the nav wrapper.
  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
