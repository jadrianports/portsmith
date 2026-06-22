import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { BotIdClient } from 'botid/client';
import { Providers } from './providers';
import { siteOrigin } from '@/lib/url';
import './globals.css';

/**
 * D-06 / D-07 / HARD-02 — BotID client signal, CHROME ROOT ONLY (auth-only scope).
 *
 * These are the five auth/service-role POST surfaces that back the server
 * `checkBotId()` gates wired in 16-04 (auth Server Actions) and 16-05 (service-role
 * routes). Auth forms invoke their Server Action as a client-dispatched POST to the
 * current page route, so the protected path is the page route (`/signup`/`/login`/
 * `/forgot-password`); the contact + report dialogs POST to their `/api/*` routes.
 *
 * LOCKED INVARIANT (D-07): mount `<BotIdClient>` here in the `(chrome)` root ONLY —
 * NEVER in `(portfolio)/layout.tsx` or any `components/templates/*` (it would add JS
 * to the lean public bundle and regress the D-22 First-Load-JS budget). Use the
 * `BotIdClient` component mount, NOT `initBotId()` (which runs globally incl. the
 * public routes). Excluded: `/api/page-view` (high-volume beacon — its UA denylist +
 * flood cap stay the gate) and `/update-password` (recovery-session-gated).
 */
const protectedRoutes = [
  { path: '/signup', method: 'POST' },
  { path: '/login', method: 'POST' },
  { path: '/forgot-password', method: 'POST' },
  { path: '/api/contact', method: 'POST' },
  { path: '/api/report', method: 'POST' },
];

/**
 * Platform-chrome UI font (02-UI-SPEC A-4 — founder-confirmed Inter). Variable
 * font, `display: swap`, latin subset. Exposed as the `--font-inter` CSS
 * variable, which `--font-sans` (globals.css `@theme`) consumes as the head of
 * its fallback stack so every chrome surface renders in Inter.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

/**
 * CR-01 (Phase 32) — `metadataBase` is REQUIRED for the file-convention OG card to
 * resolve to an absolute URL. Phase 32 (BRAND-04) removed the explicit `og-default.png`
 * image refs from `(chrome)/page.tsx` so the sibling `opengraph-image.tsx` card wins via
 * metadata inheritance — but Next resolves a file-convention `og:image` against
 * `metadataBase`, and with it UNSET the URL silently falls back to `http://localhost:3000`
 * in production. Drive it from `siteOrigin()` (env `NEXT_PUBLIC_SITE_URL`, the same source
 * as `siteUrl()`), never the request Host — so a domain switch stays an env + DNS change
 * and every chrome route ships correct absolute OG/Twitter image + canonical URLs.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: 'Portsmith',
  description:
    'Publish a polished, single-scroll portfolio by filling in structured content and choosing a curated template.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* D-06 / D-07 / HARD-02 — BotID signal script, chrome-root only (renders null). */}
        <BotIdClient protect={protectedRoutes} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
