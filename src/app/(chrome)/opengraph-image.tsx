/**
 * `opengraph-image.tsx` — the platform OG / share card (BRAND-04 / D-11 / D-12), Next 16
 * metadata-file convention. Renders a 1200×630 brand card via `next/og`'s `ImageResponse`
 * (Satori + resvg, bundled in next@16.2.6 — ZERO new packages) and INHERITS to every
 * chrome route through Next metadata inheritance, superseding `public/og-default.png` for
 * `/` (the explicit refs are removed from page.tsx so this file-convention card wins).
 *
 * Lives under `(chrome)/` only — there is no app-root layout, so this does NOT leak onto
 * the public `(portfolio)` tree (BRAND-05); those routes keep their own og-default.png.
 *
 * ── SHAPE: metadata-file convention (NOT the portfolio route's GET handler) ──────────
 * This is the `opengraph-image.tsx` file convention: a default `Image()` export plus the
 * `alt`/`size`/`contentType` segment exports that Next reads to auto-inject `<meta
 * og:image>`. (The portfolio card is a non-convention `route.tsx` GET handler for a
 * different reason — it needs `buildPublicMetadata` to own tag precedence. Here, inheritance
 * IS the goal.) The font-load + degrade-open BODY mirrors that portfolio route exactly.
 *
 * ── SECURITY (T-32-04 / T-32-05) ────────────────────────────────────────────────────
 * The card does ZERO remote fetches and reads ONLY the bundled local Inter font via
 * `readFile(process.cwd()/public/...)` — no remote `<img src>`, no avatar fetch → no
 * SSRF / remote-decode surface by construction. The single I/O point (the font read) is
 * wrapped in try/catch → `fonts = undefined` degrade-open: a transient font failure yields
 * a valid (default-font) card, never a cached 500 (the card is build/ISR-rendered).
 *
 * ── CONTENT (D-12) ──────────────────────────────────────────────────────────────────
 * Evergreen `#1B3A2E` canvas (60), a STACKED lockup — the circular stamp ABOVE the
 * off-white `#FBFAF8` "Portsmith" wordmark (30), and the verbatim landing tagline; a
 * single thin copper `#C9683A` accent line keeps copper the scarce 10%. All hex are baked
 * light @theme values (a generated raster is a fixed single-variant asset; Satori can't
 * read CSS vars) — the D-06 no-hex rule governs the @theme/component layer, not this asset.
 */
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Satori rasterization + node:fs font reads require the Node runtime, never edge.
export const runtime = 'nodejs';

/** Metadata-file segment exports — Next injects og:image/alt/type from these. */
export const alt = 'Portsmith — a polished portfolio in about 15 minutes';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Baked LIGHT @theme values (single-variant asset; Satori can't consume CSS vars).
const EVERGREEN = '#1B3A2E'; // --color-brand — canvas (dominant 60)
const COPPER = '#C9683A'; // --color-accent — the "P" + the thin accent rule (scarce 10)
const BRAND_FOREGROUND = '#FBFAF8'; // --color-brand-foreground — wordmark ink (secondary 30)
const MUTED_FOREGROUND = '#C9D4CC'; // a quieter evergreen-tinted ink for the tagline

// The existing landing tagline — reused VERBATIM from (chrome)/page.tsx's TITLE (D-12).
const TAGLINE = 'a polished portfolio in about 15 minutes';

export default async function Image() {
  // The card's single I/O failure point — degrade-open so a transient/locked-font failure
  // yields a valid (default-font) card rather than a cached 500 (mirrors the portfolio route).
  let fonts:
    | { name: string; data: Buffer; weight: 400 | 600; style: 'normal' }[]
    | undefined;
  try {
    const [interSemiBold, interRegular] = await Promise.all([
      readFile(join(process.cwd(), 'public/Inter-SemiBold.ttf')),
      readFile(join(process.cwd(), 'public/Inter-Regular.ttf')),
    ]);
    fonts = [
      { name: 'Inter', data: interSemiBold, weight: 600, style: 'normal' },
      { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
    ];
  } catch {
    fonts = undefined; // Satori falls back to its default font — degraded but valid.
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: EVERGREEN,
          fontFamily: 'Inter',
        }}
      >
        {/* STACKED lockup (D-12): the circular stamp ABOVE the wordmark. The seal ring is
            off-white so it registers on the evergreen canvas; the "P" is the scarce copper
            accent (open counter — matches <Logo>). */}
        <svg
          width={150}
          height={150}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
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
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 9.5a1.25 1.25 0 0 1 1.25-1.25h4.25a4.75 4.75 0 0 1 0 9.5H14.5v5.25a1.25 1.25 0 0 1-2.5 0V9.5Zm2.5 5.75h3a2.25 2.25 0 0 0 0-4.5h-3v4.5Z"
            fill={COPPER}
          />
        </svg>

        {/* The "Portsmith" wordmark — Inter SemiBold, off-white brand-foreground. */}
        <div
          style={{
            display: 'flex',
            marginTop: 40,
            fontSize: 96,
            fontWeight: 600,
            letterSpacing: -2,
            color: BRAND_FOREGROUND,
          }}
        >
          Portsmith
        </div>

        {/* A single thin copper accent rule — copper stays the scarce 10% (D-12). */}
        <div
          style={{
            display: 'flex',
            width: 120,
            height: 4,
            borderRadius: 9999,
            backgroundColor: COPPER,
            marginTop: 40,
            marginBottom: 40,
          }}
        />

        {/* The verbatim landing tagline (reused, not re-authored). */}
        <div
          style={{
            display: 'flex',
            fontSize: 38,
            fontWeight: 400,
            letterSpacing: -0.5,
            color: MUTED_FOREGROUND,
          }}
        >
          {TAGLINE}
        </div>
      </div>
    ),
    {
      ...size,
      ...(fonts ? { fonts } : {}),
    },
  );
}
