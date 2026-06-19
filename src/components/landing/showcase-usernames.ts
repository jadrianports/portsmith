/**
 * SHOWCASE_USERNAMES — the operator-curated landing carousel list (D-04 / SHOW-02).
 *
 * A small, deploy-as-code static literal of the usernames whose LIVE og-image previews the
 * landing proof carousel renders — exactly the "operator-curated, deploy-as-code" pattern the
 * landing proof grid used today (founder + the aurora marketer demo). Each entry carries the
 * display metadata `ShowcaseCard` needs (name / caption / alt).
 *
 * WHY A STATIC LITERAL (load-bearing): the landing `/` is `force-static`. This array is a plain
 * code constant — NO DB read, NO client fetch, NO public endpoint — so the landing stays
 * trivially `force-static` (D-04). The "live" preview is the per-username `opengraph-image`
 * route, browser-fetched as an `<img>` (D-01), never server-fetched here. The full opt-in pool
 * (SHOW-03) feeds the separate `/explore` ISR route, NOT this curated landing list (D-05).
 *
 * This is the landing's CURATED highlights, deliberately separate from the `/explore` live pool.
 */

/** One curated landing slide: the published username + the card's display metadata. */
export interface ShowcaseEntry {
  /** The published portfolio username — drives the live og-image src + the siteUrl() href. */
  username: string;
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
    name: 'the developer',
    caption: "A developer's portfolio",
    alt: "Live preview of a developer's published Portsmith portfolio.",
  },
  {
    username: 'aurora-demo',
    name: 'the marketer',
    caption: "A marketer's portfolio",
    alt: "Live preview of a marketer's published Portsmith portfolio on the aurora template.",
  },
] as const;
