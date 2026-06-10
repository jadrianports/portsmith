/**
 * `buildPublicMetadata` — the gate-applied PUBLIC metadata builder (SEO-01 /
 * SAFE-04 / D-08/10/11; RESEARCH "SAFE-04 robots gate in generateMetadata").
 *
 * The public branch of `[username]/page.tsx`'s `generateMetadata` DELEGATES to this
 * pure helper so the noindex gate is unit-testable in isolation (06-01's
 * noindex-gate.test.ts drives `isPublishReady` via a mock and asserts the robots
 * wiring here). Extracting it keeps the metadata logic out of the page body and,
 * critically, introduces NO new request-time read — this helper takes the already-
 * loaded `PortfolioData` and the `username`, and reads ONLY env-driven `siteUrl()`.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ SAFE-04 NOINDEX GATE (D-11 / T-06-07): when `isPublishReady` FAILS (placeholder │
 * │ or thin page), the returned Metadata carries `robots:{index:false, follow:true}`│
 * │ — the page is withheld from indexes but stays REACHABLE (a title is always      │
 * │ returned; the page is never `notFound()`-ed for incompleteness). When the gate  │
 * │ PASSES, `robots` is OMITTED so the page is default-indexable. follow:true keeps  │
 * │ outbound links crawlable even while the page itself is noindex.                 │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * PUB-03 (T-06-06): the canonical, the openGraph `url`, and the static OG default
 * are ALL built from `siteUrl()` — env-driven, never the request host — so the
 * route stays ISR-cacheable (D-22) and host-header injection cannot poison them.
 *
 * D-10: the share/OG image is a single static neutral default for every portfolio
 * (`/og-default.png`), with an optional per-portfolio `og_image_url` override when
 * one is set on the settings row (the editable preview image is otherwise deferred).
 */
import type { Metadata } from 'next';

import type { PortfolioData } from '@/components/templates/types';
import { isPublishReady } from '@/lib/cms/completeness';
import { siteUrl } from '@/lib/url';

/**
 * Adapt the already-loaded `PortfolioData` into the SAFE-04 gate input shape
 * (`CompletenessInput`): the gate reaches `hero.heading` via `sections`, plus the
 * profile's `display_name`/`avatar_url`. PURE — no I/O.
 */
function toGateInput(data: PortfolioData) {
  return {
    displayName: data.profile.display_name,
    avatarUrl: data.profile.avatar_url,
    sections: data.sections.map((s) => ({
      type: s.type ?? '',
      content: s.content,
    })),
  };
}

/**
 * D-18 — the SAFE-04 noindex gate fragment for the EXCLUSIVE-lane sub-routes
 * (`/[username]/blog`, `/[username]/blog/[slug]`, `/[username]/services`). The
 * sub-routes INHERIT the parent portfolio's `isPublishReady` gate rather than
 * opening a posts-as-indexable side-door (threat T-13.2-13): when the portfolio
 * is not publish-ready, every sub-route is withheld from indexes but stays
 * reachable + followed (`{ index:false, follow:true }`), mirroring `:73` exactly.
 * When ready, an EMPTY object is returned so the caller's `...spread` omits
 * `robots` and the page is default-indexable. PURE — takes the already-loaded
 * `PortfolioData`, no new request-time read (D-22 preserved).
 */
export function subRouteRobots(data: PortfolioData): Pick<Metadata, 'robots'> {
  return isPublishReady(toGateInput(data)) ? {} : { robots: { index: false, follow: true } };
}

/**
 * Build the PUBLIC-page Metadata for a published portfolio: per-portfolio
 * title/description, the siteUrl canonical, the SAFE-04 robots gate, and the
 * static OG default. PURE over `data` + env (`siteUrl`); no request access.
 */
export function buildPublicMetadata(data: PortfolioData, username: string): Metadata {
  const displayName = data.profile.display_name ?? username;
  const title = data.settings.page_title ?? `${displayName} — Portfolio`;
  const description =
    data.settings.meta_description ?? data.profile.headline ?? undefined;
  const canonical = siteUrl(`/${username}`);

  // SAFE-04: noindex-but-reachable until the page is reasonably complete (D-11).
  const complete = isPublishReady(toGateInput(data));

  return {
    title,
    description,
    // PUB-03: canonical from NEXT_PUBLIC_SITE_URL via siteUrl(), never the request
    // host (keeps the route ISR-cacheable + blocks host-header injection).
    alternates: { canonical },
    // Withheld from indexes while incomplete; still followed + reachable (D-11).
    ...(complete ? {} : { robots: { index: false, follow: true } }),
    // D-10: static neutral OG default for every portfolio (optional per-portfolio
    // override when og_image_url is set). All URLs env-driven via siteUrl (PUB-03).
    openGraph: {
      title,
      description,
      url: canonical,
      images: [data.settings.og_image_url ?? siteUrl('/og-default.png')],
    },
  };
}
