/**
 * The public portfolio page — `/[username]` (TMPL-03 / TMPL-04 / PUB-03; RESEARCH
 * Pattern 3). This is the walking skeleton's "lights up" moment: a visitor opens
 * the URL and sees the seeded founder portfolio rendered through the lazy `minimal`
 * template — the real synthwave Hero + Footer (03-05), with 03-06/07/08 filling the
 * remaining sections in later waves.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ ISR / STATIC — NOT DYNAMIC (SHARED-A / TMPL-04 / D-21 — LOAD-BEARING):          │
 * │ `export const revalidate = 3600` makes this route ISR with a 1-hour backstop   │
 * │ (on-demand `revalidatePath` on publish/save is Phase 4). `generateStaticParams`│
 * │ pre-renders the one known seeded username at build time. The route MUST stay   │
 * │ ISR/static: the read (`getPortfolioByUsername`, 03-02) is COOKIE-LESS by        │
 * │ construction, so NOTHING here introduces `cookies()` / `headers()` / `no-store`│
 * │ / a request-host read — any of those would silently flip the route to dynamic  │
 * │ (`ƒ`) and break the perf budget. The 03-09 gate enforces this; this slice       │
 * │ introduces the route, so it asserts the invariant at the source (verified in    │
 * │ the build output: the `/[username]` row is `●` ISR, never `ƒ`).                  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * NEXT 16 ASYNC APIS (CLAUDE.md / RESEARCH Pitfall 1): `params` is a Promise and
 * MUST be `await`ed — in BOTH `generateMetadata` and the page body. React `cache()`
 * around `getPortfolioByUsername` dedupes the two reads into one.
 *
 * D-24: a missing/unpublished username → `getPortfolioByUsername` returns `null`
 * (the `public_*` views already filter published/non-deleted/non-locked) → the page
 * calls `notFound()` (rendering `[username]/not-found.tsx`, which leaks no detail).
 *
 * PUB-03 canonical (T-03-15): `generateMetadata` sets `alternates.canonical` from
 * `siteUrl()` — derived from `NEXT_PUBLIC_SITE_URL`, NEVER the request host. Full
 * OG / Person JSON-LD is Phase 6; the MINIMAL metadata (title + description +
 * canonical) is authored now, not stubbed empty.
 */
import { cookies, draftMode } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { PreviewBanner } from '@/components/editor/preview-banner';
import { PREVIEW_TEMPLATE_COOKIE } from '@/lib/preview/cookie';
import { TemplateRenderer } from '@/components/templates/template-renderer';
import {
  resolveSpec,
  resolveTemplateMeta,
  templateSlugSchema,
} from '@/components/templates/registry';
import { filledVisibleSectionTypes } from '@/lib/templates/filled-sections';
import { getPortfolioByUsername } from '@/lib/portfolio/get-portfolio';
import { getPortfolioOwnerByUsername } from '@/lib/portfolio/get-portfolio-owner';
import { buildPublicMetadata } from '@/lib/seo/public-metadata';

/** D-21 ISR backstop — 1 hour. On-demand revalidatePath on publish is Phase 4. */
export const revalidate = 3600;

/**
 * Allow on-demand ISR for usernames not pre-rendered at build time (the default).
 * Only the one seeded username is prebuilt today; any other published username
 * still renders + caches on first request (non-published → notFound()).
 */
export const dynamicParams = true;

/**
 * Pre-render the one known seeded username at build time (03-03: the founder's
 * public slug is `jadrianports` — D-27 / RESEARCH OQ-1). This handle MUST match the
 * seed exactly. A hardcoded list is the correct P3 shape (one portfolio); a future
 * phase can query published profiles here once there are many.
 */
export async function generateStaticParams(): Promise<{ username: string }[]> {
  return [{ username: 'jadrianports' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params; // Next 16: params is a Promise — MUST await.

  // ┌───────────────────────────────────────────────────────────────────────────┐
  // │ DRAFT-MODE PREVIEW METADATA (mirrors the page body's draftMode() branch):    │
  // │ read `draftMode()` EXACTLY as the page does (`const { isEnabled } = await     │
  // │ draftMode()`), so this does NOT introduce a new always-on dynamic read — Next │
  // │ only takes this branch for the cookie-bearing OWNER request; every anonymous  │
  // │ visitor skips it and keeps the cookie-less public read below, so `/[username]`│
  // │ stays `● (SSG)` / ISR (the load-bearing 04-07 / D-22 invariant). In preview   │
  // │ the page BODY renders the owner's UNPUBLISHED portfolio, so the public read   │
  // │ (null for unpublished) would mislabel the tab "Not found"; instead we title   │
  // │ it as a preview and FORCE `noindex` (a preview must never be indexable).      │
  // └───────────────────────────────────────────────────────────────────────────┘
  const { isEnabled } = await draftMode(); // Next 16: draftMode() is async — MUST await.
  if (isEnabled) {
    const ownerData = await getPortfolioOwnerByUsername(username);
    const previewName = ownerData?.profile.display_name ?? username;
    return {
      title: `Preview — ${previewName}`,
      robots: { index: false, follow: false }, // preview is never indexable.
    };
  }

  // PUBLIC PATH — UNCHANGED, cookie-LESS, ISR-cacheable (lines below this comment).
  const data = await getPortfolioByUsername(username); // cache() dedupes with the body.
  if (!data) {
    // Missing/unpublished: a non-indexable, detail-free title (the page 404s).
    return { title: 'Not found', robots: { index: false, follow: false } };
  }

  // SEO-01 / SAFE-04 / D-10: per-portfolio title/description, the siteUrl canonical,
  // the noindex-until-complete robots gate, and the static OG default are all built
  // by the pure `buildPublicMetadata` helper. It reads ONLY the already-loaded
  // `data` + env-driven `siteUrl()` — it introduces no request-time dynamic read,
  // so this branch stays cookie-less + ISR-cacheable (the load-bearing D-22
  // invariant). The gate keeps an incomplete page noindex BUT reachable (a title is
  // still returned; the page is never notFound()-ed for incompleteness).
  return buildPublicMetadata(data, username);
}

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params; // Next 16: params is a Promise — MUST await.

  // ┌───────────────────────────────────────────────────────────────────────────┐
  // │ DRAFT-MODE OWNER PREVIEW BRANCH (TMPL-05 / D-P4-09 / RESEARCH Pattern 2):    │
  // │ This is the SINGLE sanctioned dynamic path on this ISR route. `draftMode()`  │
  // │ is async in Next 16 — `await` it, then read `.isEnabled`. Reading it is      │
  // │ itself a request-time signal, but Next only takes the dynamic branch for a   │
  // │ request that CARRIES the `__prerender_bypass` cookie (i.e. the owner who     │
  // │ clicked Preview). A request WITHOUT the cookie — every anonymous visitor —   │
  // │ skips this branch and still serves the cached ISR static HTML below          │
  // │ (Pitfall 2; the route stays `●` ISR in the build output). The owner read     │
  // │ (`getPortfolioOwnerByUsername`) is the cookie/RLS, base-table module reached │
  // │ ONLY here — the public path never imports a cookie-reading client (SHARED-F).│
  // └───────────────────────────────────────────────────────────────────────────┘
  const { isEnabled } = await draftMode(); // Next 16: draftMode() is async — MUST await.
  if (isEnabled) {
    // CR-01: the PREVIEW must match the PUBLIC page — hidden stays hidden. We call
    // the owner read WITHOUT `includeHidden`, so it returns visible-only sections
    // (the editor, by contrast, passes `{ includeHidden: true }` to see + re-show
    // hidden sections). This keeps preview ≡ public.
    const ownerData = await getPortfolioOwnerByUsername(username);
    if (!ownerData) notFound(); // no verified owner / not the caller's own slug.

    // ┌─────────────────────────────────────────────────────────────────────────┐
    // │ CANDIDATE-TEMPLATE PREVIEW (07-05 / D-P7-08 / T-07-14):                   │
    // │ The enable route may have set a vetted `preview-template` cookie (the     │
    // │ template the owner is previewing — NOT yet persisted). RE-VALIDATE it     │
    // │ here via `templateSlugSchema` (defense-in-depth — never trust a cookie    │
    // │ value into a render path); a missing/unknown value falls back to the      │
    // │ owner's PERSISTED slug. This cookie read is fine: it lives ONLY inside    │
    // │ this draft branch, which is ALREADY the single sanctioned dynamic path    │
    // │ (gated by __prerender_bypass) — the PUBLIC branch below stays cookie-less │
    // │ so `/[username]` stays ● SSG for anonymous visitors (T-07-15).            │
    // └─────────────────────────────────────────────────────────────────────────┘
    const cookieStore = await cookies();
    const candidateParse = templateSlugSchema.safeParse(
      cookieStore.get(PREVIEW_TEMPLATE_COOKIE)?.value,
    );
    const candidateSlug = candidateParse.success ? candidateParse.data : null;
    // The slug actually RENDERED in the preview: the vetted candidate when present,
    // else the owner's persisted slug (the lossless fallback).
    const renderedSlug = candidateSlug ?? ownerData.templateSlug;

    // Confirm-bar / mismatch context for the reused PreviewBanner (07-05). The
    // mismatch warning compares the owner's FILLED + VISIBLE section types against
    // the CANDIDATE template's spec (warn-but-allow, D-P7-11) — it returns [] in v1
    // (both templates cover all 7 produced types) but is wired for future templates.
    const filledTypes = filledVisibleSectionTypes(ownerData.sections);
    const candidateMeta = candidateSlug ? resolveTemplateMeta(candidateSlug) : null;
    const candidateSpec = candidateSlug ? resolveSpec(candidateSlug) : null;

    return (
      <>
        <PreviewBanner
          username={username}
          published={ownerData.published}
          // 07-05 switch-flow confirm bar (rendered only when previewing a CANDIDATE
          // template — i.e. a vetted `?template=` cookie is present). When absent,
          // PreviewBanner falls back to its plain Phase-4 "Exit preview" shape. All
          // props are plain serializable data (RSC → client boundary): the candidate
          // slug/name, the current slug/name, the owner's filled-visible section
          // types, and the candidate's spec (a plain `{ sections, ... }` object). The
          // MismatchWarning inside the banner runs `unsupportedFilledSections` from
          // these (warn-but-allow, D-P7-11).
          candidateSlug={candidateSlug ?? undefined}
          candidateName={candidateMeta?.name}
          currentSlug={ownerData.templateSlug}
          currentName={resolveTemplateMeta(ownerData.templateSlug).name}
          filledVisibleTypes={candidateSpec ? filledTypes : undefined}
          candidateSpec={candidateSpec ?? undefined}
        />
        {/* Phase 7 (07-05): render the VETTED candidate slug when previewing a
            prospective template, else the owner's PERSISTED slug — the candidate
            rides this existing __prerender_bypass dynamic branch only. */}
        <TemplateRenderer slug={renderedSlug} data={ownerData} />
      </>
    );
  }

  // PUBLIC PATH — UNCHANGED, cookie-LESS, ISR-cacheable (lines below this comment).
  const data = await getPortfolioByUsername(username);
  if (!data) notFound(); // D-24 — missing/unpublished.

  // Phase 7: render the slug resolved from `public_portfolios.template_id` via the
  // STATIC map in `get-portfolio.ts` (`data.templateSlug`) — NO request-time
  // `templates` read, so this branch stays cookie-less ISR (Pitfall 2/6). The
  // engine resolves slug → lazy chunk → error boundary → the scoped
  // .tmpl-<slug> Server-Component root.
  return <TemplateRenderer slug={data.templateSlug} data={data} />;
}
