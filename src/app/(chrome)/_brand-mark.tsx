/**
 * `_brand-mark.tsx` — the ONE place the square-padded raster mark geometry is authored
 * (D-02/D-10). The leading underscore keeps this file OUT of Next routing (it is not a
 * route segment); it is a plain helper imported by `icon.tsx`, `apple-icon.tsx`, and the
 * `app-icon/[size]/route.tsx` route so the seal + copper-"P" geometry is never triplicated.
 *
 * ── WHY BAKED HEX (not @theme vars) ───────────────────────────────────────────────
 * A generated PNG raster is a SINGLE FIXED-VARIANT asset — there is no CSS cascade at
 * paint time, and `next/og` (Satori) cannot consume CSS custom properties. So unlike the
 * RSC `<Logo>` (which uses `var(--color-brand)`/`var(--color-accent)` for an automatic
 * light/dark swap), the rasters bake the LIGHT token values directly:
 *   - evergreen seal   = `--color-brand`            light `#1B3A2E`
 *   - copper "P"       = `--color-accent`           light `#C9683A`
 * This is a sanctioned place for hex literals — the D-06 "no hex" rule governs the
 * @theme/component layer, not a single-variant generated asset (UI-SPEC Asset Pipeline).
 *
 * ── SQUARE-PADDED, MASK-SAFE (D-02) ───────────────────────────────────────────────
 * iOS/Android mask app icons to a rounded square and clip anything near the edge. The
 * circular seal therefore sits inside a SQUARE evergreen tile with optical padding all
 * round, so the ring is never clipped by the platform mask. Geometry matches `<Logo>`
 * (the same 32×32 viewBox seal + open-counter "P", 16px-legible — D-04).
 */
import type { ReactElement } from 'react';

/** Baked LIGHT token values — a raster is single-variant; Satori can't read CSS vars. */
const EVERGREEN = '#1B3A2E'; // --color-brand (light) — the tile canvas
const COPPER = '#C9683A'; // --color-accent (light) — the "P" (the scarce 10% accent)
const BRAND_FOREGROUND = '#FBFAF8'; // --color-brand-foreground (light) — seal ring on evergreen

/**
 * The Portsmith mark, square-padded for app-icon masking, sized to `px`×`px`.
 *
 * An evergreen rounded-square tile (so the rounded-square platform mask never clips the
 * circular seal) holds the mark SVG at ~78% scale (optical margin). The SVG reproduces
 * `<Logo>` exactly: a 2px rounded evergreen seal ring + the copper "P" with an OPEN bowl
 * counter (the 16px legibility gate, D-04) on the same `viewBox="0 0 32 32"`.
 *
 * Consumed by icon.tsx (32px), apple-icon.tsx (180px), and app-icon/[size] (192/512px).
 */
export function squarePaddedMark(px: number): ReactElement {
  // The seal SVG occupies ~78% of the tile; the remaining ~22% is the mask-safe padding.
  const markSize = Math.round(px * 0.78);
  // A proportional corner radius so the tile reads as the standard rounded square.
  const radius = Math.round(px * 0.22);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: px,
        height: px,
        backgroundColor: EVERGREEN,
        borderRadius: radius,
      }}
    >
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Seal ring — rendered in off-white --color-brand-foreground so the circular seal
            registers against the same-evergreen tile (an on-canvas evergreen ring would
            vanish). This keeps the 60/30/10 on the icon: evergreen tile dominant (60),
            off-white ring secondary (30), copper "P" the scarce accent (10) — D-12. The
            standalone icon.svg favicon keeps the on-canvas evergreen ring (no tile there). */}
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="none"
          stroke={BRAND_FOREGROUND}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* The "P" — copper accent fill, open-counter (D-04/D-07), matches <Logo> exactly. */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 9.5a1.25 1.25 0 0 1 1.25-1.25h4.25a4.75 4.75 0 0 1 0 9.5H14.5v5.25a1.25 1.25 0 0 1-2.5 0V9.5Zm2.5 5.75h3a2.25 2.25 0 0 0 0-4.5h-3v4.5Z"
          fill={COPPER}
        />
      </svg>
    </div>
  );
}
