/**
 * `/dashboard/settings` — the single account-settings page (ACCT-01..05, D-15).
 *
 * The RSC that assembles the four account-settings islands into one single-scroll
 * surface, in the locked D-15 order:
 *   1. Email     → <ChangeEmailForm>    (ACCT-02, double-confirm + pending banner)
 *   2. Password  → <ChangePasswordForm> (ACCT-01, reauth-gated in-app change)
 *   3. Export    → <ExportButton>       (ACCT-04, the JSON-download trigger)
 *   4. Danger Zone → <DangerZone>       (ACCT-03, permanent delete — ISOLATED, LAST)
 *
 * AUTH GATE (mirrors dashboard/page.tsx, AUTH-05 / D-17): `getVerifiedClaims()` —
 * the VERIFIED JWT read, NEVER the spoofable `getSession()` — and `redirect('/login')`
 * on no session or a missing `sub` (hard-fail, never coerced). The route is nested
 * under `/dashboard`, which the middleware already guards (D-15 — NO matcher change);
 * this page-level gate is defense-in-depth at the boundary.
 *
 * PENDING-EMAIL BANNER DATA (D-07 / Flag 2). The pending NEW email lives on the User
 * object as `user.new_email` — the JWT claims do NOT carry it — so it is read here via
 * `supabase.auth.getUser()` and threaded into <ChangeEmailForm> as `pendingEmail`. The
 * CURRENT email is `claims.email`. The Danger Zone's exact-username confirm (`username`)
 * comes from the owner's OWN profile row (read under RLS by the verified `sub`).
 *
 * TWO-LAYER IDENTITY (chrome single-layer): this page lives in the `(chrome)` route
 * group and renders in chrome tokens ONLY (Inter, Evergreen/Copper) — no template
 * `.tmpl-*` token. The Danger Zone island stays visually isolated (its own bordered
 * destructive card). The page reads no request host and adds no host-read to any
 * public branch (D-22 untouched — this surface is entirely under /dashboard).
 *
 * NEXT 16: RSC; `cookies()` (read transitively by `createClient`) is async. The page
 * is owner-private and reflects live auth state → `force-dynamic`.
 */
import { redirect } from 'next/navigation';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';

import { LogoutButton } from '@/components/auth/logout-button';

import { ChangeEmailForm } from './change-email-form';
import { ChangePasswordForm } from './change-password-form';
import { DangerZone } from './danger-zone';
import { ExportButton } from './export-button';

/** Owner-private + reflects live auth state (current/pending email). */
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  // 1) AUTH GATE — verified identity only (never getSession). No session → /login
  //    (the /dashboard middleware guard also covers this route; defense-in-depth).
  const claims = await getVerifiedClaims();
  if (!claims) redirect('/login');

  // WR-05 / D-17: a verified claim MUST carry a subject — a missing `sub` is a hard
  // auth failure, never coerced to '' (which would make the own-row read a 0-row no-op).
  const sub = (claims as { sub?: string }).sub;
  if (!sub) redirect('/login');

  // The CURRENT email is the verified claim email (the source of truth — never the
  // stale-by-design profiles.email; D-18). Hard-fail to login if absent.
  const currentEmail = (claims as { email?: string }).email;
  if (!currentEmail) redirect('/login');

  const supabase = await createClient();

  // 2) The owner's OWN username (the Danger Zone exact-username confirm prop, D-12).
  //    Read under RLS by the verified `sub` (the owner's own row). A missing row
  //    (should not happen post-bootstrap) degrades safely to /login.
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', sub)
    .maybeSingle();
  const username = (profileRow as { username?: string } | null)?.username ?? '';
  if (!username) redirect('/login');

  // 3) The PENDING email (D-07 / Flag 2) — `user.new_email` from the User object
  //    (the JWT claims omit it). Non-null while a double-confirm change is in flight.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pendingEmail = user?.new_email ?? null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
        Account settings
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Manage your sign-in credentials, export your content, and — if you must —
        delete your account.
      </p>

      <div className="mt-8 flex flex-col gap-8">
        {/* 1) Email (ACCT-02) */}
        <section
          aria-labelledby="settings-email"
          className="rounded-lg border border-border bg-surface p-5 sm:p-6"
        >
          <h2
            id="settings-email"
            className="mb-4 text-lg font-semibold text-foreground"
          >
            Email
          </h2>
          <ChangeEmailForm currentEmail={currentEmail} pendingEmail={pendingEmail} />
        </section>

        {/* 2) Password (ACCT-01) */}
        <section
          aria-labelledby="settings-password"
          className="rounded-lg border border-border bg-surface p-5 sm:p-6"
        >
          <h2
            id="settings-password"
            className="mb-4 text-lg font-semibold text-foreground"
          >
            Password
          </h2>
          <ChangePasswordForm />
        </section>

        {/* 3) Export (ACCT-04) */}
        <section
          aria-labelledby="settings-export"
          className="rounded-lg border border-border bg-surface p-5 sm:p-6"
        >
          <h2
            id="settings-export"
            className="mb-4 text-lg font-semibold text-foreground"
          >
            Export your content
          </h2>
          <ExportButton />
        </section>

        {/* Sign out — end the current session (signOut + redirect to /login). Sits
            before the Danger Zone so the destructive delete stays visually last. */}
        <section
          aria-labelledby="settings-signout"
          className="rounded-lg border border-border bg-surface p-5 sm:p-6"
        >
          <h2
            id="settings-signout"
            className="mb-1 text-lg font-semibold text-foreground"
          >
            Sign out
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Sign out of Portsmith on this device. You can sign back in anytime.
          </p>
          <LogoutButton variant="settings" />
        </section>

        {/* 4) Danger Zone (ACCT-03) — isolated, LAST. The island owns its own
            destructive-token bordered card (D-14); no chrome accent fill here. */}
        <DangerZone username={username} />
      </div>
    </main>
  );
}
