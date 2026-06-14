/**
 * SHARE-03 / D-06 / D-05 — the share-image precedence URL builder.
 *
 * The D-06 precedence ladder, extracted as a pure, env-driven helper so the public
 * `/[username]`, `/blog`, and `/services` metadata call sites (D-05) all derive the share-card
 * URL from ONE place and the precedence stays unit-testable:
 *
 *   1. explicit, NON-BLANK `settings.og_image_url`  — a user who deliberately set a custom image
 *      wins. An empty / whitespace-only value is "no override" and falls through (CR-01).
 *   2. the dynamic per-portfolio card    — `siteUrl('/<username>/opengraph-image')`.
 *
 * This module also owns `resolveDisplayName` (WR-04) — the ONE `display_name → username` fallback
 * the metadata builder, the OG card route, and the `/blog`/`/services` sub-routes all share, so the
 * card's rendered name can never drift from the `<title>`/`og:title` a crawler reads.
 *
 * The static `og-default.png` is intentionally NOT part of this ladder: per D-04 it is reserved
 * for NON-portfolio pages (its art direction is LAUNCH-09 / Phase 23). A PUBLISHED portfolio
 * always has a `display_name`, so the dynamic card always renders something good — the override
 * and the card are the only two rungs a portfolio page needs.
 *
 * The dynamic-card URL is ALWAYS env-driven via `siteUrl()` (`NEXT_PUBLIC_SITE_URL`), never the
 * request Host (PUB-03 / D-22) — so the `*.vercel.app` → real-domain move stays an env + DNS +
 * 301 change. The path segment `/<username>/opengraph-image` is the generator route Plan 02
 * creates (RESEARCH §3 option b: a non-metadata-file Route Handler, so `buildPublicMetadata`
 * owns tag emission and the D-06 override can actually win).
 */
import type { PortfolioData } from '@/components/templates/types';
import { siteUrl } from '@/lib/url';

/**
 * The absolute share-image URL for a portfolio, honoring the D-06 override → dynamic-card ladder.
 *
 * @param username    the portfolio owner's username (the dynamic card's route segment).
 * @param ogImageUrl  `settings.og_image_url` — the explicit per-portfolio override, or `null`.
 *
 * CR-01: coalesce on EMPTINESS, not just nullishness. `og_image_url` is validated by
 * `httpUrlOrEmptyOptional`, which permits the empty string (`.or(z.literal(''))`), and the public
 * view passes it through verbatim. A `??` ladder would emit `og:image: ['']` (a blank tag on every
 * crawler) for a saved-empty override. An empty / whitespace-only value means "no override," so it
 * must fall through to the dynamic card — not blank the tag. `?.trim()` also guards null/undefined.
 */
export function shareImageUrl(username: string, ogImageUrl: string | null): string {
  const override = ogImageUrl?.trim();
  return override ? override : siteUrl(`/${username}/opengraph-image`);
}

/**
 * WR-04 — the ONE display-name fallback, shared by the metadata builder (`buildPublicMetadata`),
 * the OG card route, and the `/blog`/`/services` sub-routes so the card's rendered name can never
 * drift from the `<title>`/`og:title` a crawler reads. A published page always has a `display_name`;
 * the `username` fallback (and the empty-string guard) is belt-and-suspenders for an in-progress
 * profile. PURE over the already-loaded `PortfolioData` — no new request-time read (D-22 preserved).
 *
 * @param data      the already-loaded `PortfolioData` (no new I/O — pure over the loaded row).
 * @param username  the route `username`, used as the fallback when `display_name` is null/blank.
 */
export function resolveDisplayName(data: PortfolioData, username: string): string {
  const name = data.profile.display_name?.trim();
  return name ? name : username;
}
