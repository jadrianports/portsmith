import 'server-only';
/**
 * SHARE-01 / D-02 / D-03 / D-04 — the ONE art-directed dynamic share-card renderer.
 *
 * `<ShareCard>` is a 1200×630 JSX tree fed to `next/og`'s `ImageResponse` (Satori + resvg) by
 * the sibling `opengraph-image/route.tsx`. It is server-only by construction (Satori runs only
 * server-side) and takes PLAIN SERIALIZABLE PRIMITIVE props — the route resolves them from
 * `PortfolioData` + `accentForSlug()` + `siteOrigin()` before passing in, so this component does
 * ZERO I/O and reaches for NOTHING beyond its props (no DB, no env, no chrome/template token).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ SATORI CSS SUBSET — LOAD-BEARING (RESEARCH §6 / Pitfalls 4 & 5):                │
 * │ - Every element with 2+ children MUST set `display:'flex'` (Satori has no block│
 * │   layout) — set it on EVERY container here.                                     │
 * │ - Satori honors ONLY inline `style={{}}` — NO classNames (also keeps the card a │
 * │   THIRD surface off chrome/template CSS, D-02).                                  │
 * │ - NO `oklch()` — colors are resolved hex only (the accent prop is pre-resolved   │
 * │   by `accentForSlug`; Satori cannot parse oklch).                               │
 * │ - `<img>` decodes png/jpeg only — NEVER webp. The avatar slot is the accent     │
 * │   MONOGRAM (text on a styled div), NOT an `<img>` (D-04 monogram-primary), so   │
 * │   there is NO `<img>` anywhere in this tree and the WebP landmine is eliminated.│
 * │ - `backgroundImage:'linear-gradient(...)'` works → used for a RESTRAINED accent │
 * │   flourish (a soft corner wash + a thin accent bar), NOT a loud full-bleed.     │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * D-03 composition (person-first, restrained): the name (loudest, Inter SemiBold), the
 * headline/role (Inter Regular, muted — DROPPED entirely when null, D-04), the accent monogram
 * (the avatar slot), a quiet "Portsmith" wordmark in a corner (free brand exposure), the
 * `<host>/<username>` URL line so viewers know where the link leads, and a subtle accent flourish.
 *
 * D-01 / D-02: the per-portfolio `accent` is the ONLY thing the card pulls from the template world,
 * and it arrives PRE-RESOLVED as a hex via the route's `accentForSlug(data.templateSlug)` call —
 * this component never imports `accentForSlug`, `registry.ts`, or any theme token itself.
 */
import type { JSX } from 'react';

/** The card's fixed OG dimensions (1200×630 — the standard summary_large_image size). */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** The card's own dark canvas (a third-surface palette — NOT a chrome/template token, D-02). */
const CANVAS_BG = '#0b0b12';
const NAME_INK = '#f5f5f7';
const MUTED_INK = '#a1a1aa';
const FAINT_INK = '#71717a';

export interface ShareCardProps {
  /** `profile.display_name` with the route's `?? username` fallback already applied. */
  displayName: string;
  /** `profile.headline` — `null` DROPS the headline line (D-04). */
  headline: string | null | undefined;
  /** The portfolio's username (for the monogram fallback + the URL line). */
  username: string;
  /** The pre-resolved accent hex (`accentForSlug(templateSlug)` — D-01/D-02). NEVER oklch. */
  accent: string;
  /** The bare site host (e.g. `portsmith.vercel.app`) for the URL line — from `siteOrigin()`. */
  siteHost: string;
}

/**
 * The null-safe monogram initials (D-04 — the PRIMARY avatar treatment, never a WebP raster).
 *
 * The first letters of the first two whitespace-separated tokens of a non-empty `displayName`,
 * uppercased; falls back to the first letter of `username` when `displayName` is null/blank. A
 * published page always has a `display_name`, so the username fallback is belt-and-suspenders.
 */
export function initials(
  displayName: string | null | undefined,
  username: string,
): string {
  const tokens = (displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    return tokens
      .slice(0, 2)
      .map((t) => t[0])
      .join('')
      .toUpperCase();
  }
  return (username.trim()[0] ?? '').toUpperCase();
}

/**
 * The D-04 "drop the headline line" decision: render the headline line ONLY when there is a
 * non-blank headline. A null/blank headline omits the element entirely (no empty/broken node).
 */
export function hasHeadline(headline: string | null | undefined): boolean {
  return typeof headline === 'string' && headline.trim().length > 0;
}

/** The accent-tinted initials monogram — the card's avatar slot (D-04, text on a styled div). */
function Monogram({ accent, label }: { accent: string; label: string }): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 168,
        height: 168,
        borderRadius: 9999,
        backgroundColor: accent,
        color: '#ffffff',
        fontSize: 72,
        fontWeight: 600,
        letterSpacing: -2,
        // a restrained accent ring/glow — still resolved-rgba, never oklch
        boxShadow: `0 0 0 2px ${CANVAS_BG}, 0 0 0 6px ${accent}`,
      }}
    >
      {label}
    </div>
  );
}

/**
 * The 1200×630 share card. Fully inline-styled (Satori-only); every multi-child container sets
 * `display:'flex'`. Monogram-primary (no `<img>`); the headline line is dropped when null (D-04).
 */
export function ShareCard({
  displayName,
  headline,
  username,
  accent,
  siteHost,
}: ShareCardProps): JSX.Element {
  const monogram = initials(displayName, username);
  const showHeadline = hasHeadline(headline);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        backgroundColor: CANVAS_BG,
        // D-03 subtle accent flourish — a soft corner wash, NOT a loud full-bleed gradient.
        backgroundImage: `radial-gradient(900px 500px at 100% 0%, ${accent}22, ${CANVAS_BG} 60%)`,
        padding: 80,
        fontFamily: 'Inter',
        color: NAME_INK,
      }}
    >
      {/* Top row: a quiet Portsmith wordmark corner (free brand exposure, D-03). */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 14,
            height: 14,
            borderRadius: 9999,
            backgroundColor: accent,
            marginRight: 14,
          }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: 0.5,
            color: MUTED_INK,
          }}
        >
          Portsmith
        </div>
      </div>

      {/* Middle: the monogram avatar + the name + (conditional) headline — the person. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Monogram accent={accent} label={monogram} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginLeft: 48,
            maxWidth: 820,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 76,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              color: NAME_INK,
            }}
          >
            {displayName}
          </div>
          {showHeadline ? (
            <div
              style={{
                display: 'flex',
                marginTop: 20,
                fontSize: 38,
                fontWeight: 400,
                lineHeight: 1.2,
                color: MUTED_INK,
              }}
            >
              {headline}
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom row: a thin accent bar above the URL line (D-03 — where the link leads). */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 96,
            height: 5,
            borderRadius: 9999,
            backgroundColor: accent,
            marginBottom: 22,
          }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            fontWeight: 400,
            color: FAINT_INK,
          }}
        >
          {siteHost}/{username}
        </div>
      </div>
    </div>
  );
}
