/**
 * SHARE-03 / D-06 / D-05 — the share-image precedence URL builder.
 *
 * The D-06 precedence ladder, extracted as a pure, env-driven helper so the public
 * `/[username]`, `/blog`, and `/services` metadata call sites (D-05) all derive the share-card
 * URL from ONE place and the precedence stays unit-testable:
 *
 *   1. explicit `settings.og_image_url`  — a user who deliberately set a custom image wins.
 *   2. the dynamic per-portfolio card    — `siteUrl('/<username>/opengraph-image')`.
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
import { siteUrl } from '@/lib/url';

/**
 * The absolute share-image URL for a portfolio, honoring the D-06 override → dynamic-card ladder.
 *
 * @param username    the portfolio owner's username (the dynamic card's route segment).
 * @param ogImageUrl  `settings.og_image_url` — the explicit per-portfolio override, or `null`.
 */
export function shareImageUrl(username: string, ogImageUrl: string | null): string {
  return ogImageUrl ?? siteUrl(`/${username}/opengraph-image`);
}
