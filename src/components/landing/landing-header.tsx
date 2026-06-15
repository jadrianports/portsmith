/**
 * LandingHeader — the static-generic landing nav (D-04 / D-07 / D-09).
 *
 * STATIC-GENERIC (D-07): ALWAYS shows the wordmark + "Login" + "Get started — free",
 * and performs NO session read — so `/` stays statically rendered (a session-adaptive
 * "Go to dashboard" header was rejected; it would flip `/` off SSG). A logged-in
 * visitor who clicks "Login" is routed to their dashboard by the normal authed flow
 * downstream. No `'use client'`, no `getVerifiedClaims`, no DB read.
 *
 * Layout: a `<header>` + `<nav>` — the wordmark on the left, the two auth affordances
 * on the right. `xl`/32px desktop horizontal padding easing to `md`/16px on mobile;
 * `min-h-11` controls (the wordmark Link + CtaLink both clear the touch target).
 * Every color is a chrome `@theme` token.
 */
import Link from 'next/link';

import { Link as TextLink } from '@/components/ui/link';

import { CtaLink } from './cta-link';

export function LandingHeader() {
  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="rounded-sm text-lg font-semibold text-brand outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Portsmith
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <TextLink href="/login">Login</TextLink>
          <CtaLink href="/signup">Get started — free</CtaLink>
        </div>
      </nav>
    </header>
  );
}
