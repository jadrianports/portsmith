/**
 * SHOWCASE_USERNAMES — the operator-curated landing carousel list (D-04 / SHOW-02).
 *
 * A small, deploy-as-code static literal of the curated showcase portfolios the landing proof
 * carousel renders — exactly the "operator-curated, deploy-as-code" pattern the landing proof
 * grid used today (founder + the aurora marketer demo). Each entry carries the committed static
 * page-screenshot the card renders plus the display metadata `ShowcaseCard` needs
 * (name / caption / alt).
 *
 * WHY A STATIC LITERAL (load-bearing): the landing `/` is `force-static`. This array is a plain
 * code constant — NO DB read, NO client fetch, NO public endpoint — so the landing stays
 * trivially `force-static` (D-04). Each card's preview is a committed static
 * `/public/landing/showcase-*.webp` page screenshot (LAND-03 / D-12), browser-loaded as an
 * `<img>`, never server-fetched here. The full opt-in pool (SHOW-03) feeds the separate
 * `/explore` ISR route, NOT this curated landing list (D-05).
 *
 * This is the landing's CURATED highlights, deliberately separate from the `/explore` live pool.
 */

/** One curated landing slide: the published username + its screenshot + the card's display metadata. */
export interface ShowcaseEntry {
  /** The published portfolio username — drives the siteUrl() live-link href + the printed address-bar host. */
  username: string;
  /**
   * The committed static `/public/landing/showcase-*.webp` page screenshot this card renders
   * (LAND-03 / D-12). Manually-refreshed, deploy-as-code — NO DB read, `force-static`-safe.
   * Mirrors the committed-asset gate in `tests/unit/landing/landing-assets.test.ts`.
   */
  image: string;
  /** Display name for the new-tab aria-label. */
  name: string;
  /** Body caption naming the profession contrast. */
  caption: string;
  /** Mandatory descriptive alt naming the profession + the live page. */
  alt: string;
}

/**
 * The curated landing carousel list (D-04). A static literal — operator-edited, deploy-as-code.
 * Renders whatever live candidates exist; the carousel is never empty by construction.
 */
export const SHOWCASE_USERNAMES: readonly ShowcaseEntry[] = [
  {
    username: 'jadrianports',
    image: '/landing/showcase-dev.webp',
    name: 'the developer',
    caption: "A developer's portfolio",
    alt: "Live preview of a developer's published Portsmith portfolio.",
  },
  {
    username: 'aurora-demo',
    image: '/landing/showcase-aurora.webp',
    name: 'the marketer',
    caption: "A marketer's portfolio",
    alt: "Live preview of a marketer's published Portsmith portfolio on the aurora template.",
  },
] as const;
