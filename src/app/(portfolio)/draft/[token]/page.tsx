/**
 * `/draft/[token]` — the tokenized DRAFT-PREVIEW recipient route (DIST-02 / D-04).
 *
 * A specific cookieless recipient opens an opaque, revocable, 7-day-expiring link and
 * sees the owner's UNPUBLISHED draft rendered read-only — without the draft being
 * published and with NO path to edit. The TOKEN is the authorization (no session, no
 * owner cookie): the route does a token-gated SERVICE-ROLE read
 * (`getPortfolioByDraftToken`) that returns the draft ONLY for a valid, non-expired,
 * non-revoked token, projecting only public columns.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ INTRINSICALLY DYNAMIC, ISOLATED FROM /[username] SSG (D-04 / D-22):            │
 * │ The token requires a request-time DB lookup, so this route can NEVER be SSG —  │
 * │ there is NO `generateStaticParams` and it must NEVER prerender a concrete       │
 * │ `/draft/<token>` instance (a cached draft would survive a revoke — D-01). It is │
 * │ a SEPARATE `srcRoute` from `/[username]`, under the chrome-free, cookie-less    │
 * │ `(portfolio)` root group, so it cannot regress the `/[username]` SSG instance.  │
 * │ `route-table-ssg.test.ts` asserts it appears in `dynamicRoutes` and never in    │
 * │ the prerendered `routes` table.                                                 │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * READ-ONLY, NO EDIT, NO COOKIE (D-04 / T-33-10): unlike the owner draftMode branch on
 * `/[username]`, this route mounts NO `EditPreviewBridgeMount`, reads NO `cookies()`,
 * and calls NO `draftMode()` — the token is the authz, never a cookie, so a recipient
 * can never gain edit access. A distinct `<DraftPreviewBanner />` (no Exit/Publish/Edit
 * controls) marks the page as a private shared preview.
 *
 * NOINDEX (T-33-12): `generateMetadata` returns `robots: { index: false, follow: false }`
 * UNCONDITIONALLY — a private draft must never be indexable; no `siteUrl()` canonical is
 * emitted (the draft URL is a secret, not a canonical surface).
 *
 * Next 16 async params (CLAUDE.md): `params` is a Promise — `await` it in BOTH
 * `generateMetadata` and the body.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { DraftPreviewBanner } from '@/components/portfolio/draft-preview-banner';
import { TemplateRenderer } from '@/components/templates/template-renderer';
import { getPortfolioByDraftToken } from '@/lib/portfolio/get-portfolio-by-draft-token';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  await params; // Next 16: params is a Promise — await it (the token is unused here).
  // T-33-12: a private draft is NEVER indexable. Unconditional noindex; NO canonical.
  return {
    title: 'Private draft preview',
    robots: { index: false, follow: false },
  };
}

export default async function DraftPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params; // Next 16: params is a Promise — MUST await.

  // Token-gated SERVICE-ROLE read (the security crux). Invalid / expired / revoked /
  // missing → null → a single generic 404 that leaks nothing about WHY (T-33-11).
  const data = await getPortfolioByDraftToken(token);
  if (!data) notFound();

  return (
    <>
      {/* The distinct recipient banner — read-only, no Exit/Publish/Edit controls. */}
      <DraftPreviewBanner />
      <TemplateRenderer slug={data.templateSlug} data={data} />
      {/* NO EditPreviewBridgeMount — owner-only (a recipient must never gain edit). */}
      {/* NO cookies(), NO draftMode() — the token is the authz, not a cookie. */}
    </>
  );
}
