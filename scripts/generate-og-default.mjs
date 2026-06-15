/**
 * Generates `public/og-default.png` — the BRAND Open Graph share-card fallback (LAUNCH-09 / D-16).
 *
 * This is the OG image for CHROME pages without a dynamic per-portfolio card: the landing page
 * (`src/app/(chrome)/page.tsx` → `siteUrl('/og-default.png')`) and the blog/services metadata
 * fallbacks. It represents the BRAND, never a user — portfolio pages use the dynamic
 * `/<username>/opengraph-image` card instead.
 *
 * REWRITTEN (Phase 23) from a text-less hand-encoded PNG onto the in-repo `next/og` (Satori +
 * resvg) path — the same renderer `src/lib/og/share-card.tsx` uses — so it can render the
 * "Portsmith" wordmark + the verbatim locked landing headline in Inter. The standalone-script
 * `ImageResponse` → `await res.arrayBuffer()` path is verified (RESEARCH A2); `next/og` is bundled
 * in next 16.2.6 (ZERO new packages).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ SATORI CSS SUBSET — LOAD-BEARING (mirrors share-card.tsx):                      │
 * │ - Every element with 2+ children sets `display:'flex'` (Satori has no block).   │
 * │ - Inline `style` ONLY (no classNames).                                          │
 * │ - Resolved hex ONLY — NO `oklch()` (Satori cannot parse it).                    │
 * │ - The card is built as plain React-element-shaped objects ({type,props}) so this│
 * │   stays a JSX-free `.mjs` script with no compile step.                          │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * DETERMINISTIC: pure inputs only (fixed text/hex + bundled Inter .ttf bytes) — no timestamp,
 * no random — so a no-op re-run produces byte-identical output and `git diff` stays empty.
 *
 * Run: `node scripts/generate-og-default.mjs` → writes `public/og-default.png`. The output path
 * is overridable via the `OG_DEFAULT_OUT` env var (used by the determinism unit test).
 */
// eslint-disable-next-line import/no-unresolved -- `next` has no exports map for ./og; the
// explicit .js suffix is required under Node's ESM resolver (verified: bare `next/og` ERR_MODULE_NOT_FOUND).
import { ImageResponse } from 'next/og.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

// Brand palette (chrome @theme tokens, resolved hex — src/app/(chrome)/globals.css).
const EVERGREEN = '#1B3A2E'; // --color-brand (background)
const COPPER = '#C9683A'; // --color-accent (the accent rule)
const BRAND_FOREGROUND = '#FBFAF8'; // --color-brand-foreground (wordmark + headline ink)
const MUTED_FOREGROUND = '#C9D4CC'; // a quieter evergreen-tinted ink for the URL line

// The verbatim locked landing headline (incl. the em-dash) — src/components/landing/hero.tsx.
const HEADLINE = 'A polished portfolio in about 15 minutes — without designing anything.';

const OUT_PATH = process.env.OG_DEFAULT_OUT
  ? process.env.OG_DEFAULT_OUT
  : join(process.cwd(), 'public', 'og-default.png');

/** Tiny React-element constructor — keeps this a JSX-free `.mjs` (no compile step). */
function el(type, style, children) {
  return { type, props: { style, ...(children !== undefined ? { children } : {}) } };
}

async function main() {
  // Read the SAME bundled Inter static weights the dynamic ShareCard route loads.
  const [interSemiBold, interRegular] = await Promise.all([
    readFile(join(process.cwd(), 'public', 'Inter-SemiBold.ttf')),
    readFile(join(process.cwd(), 'public', 'Inter-Regular.ttf')),
  ]);

  const card = el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      width: '100%',
      height: '100%',
      backgroundColor: EVERGREEN,
      padding: 96,
      fontFamily: 'Inter',
      color: BRAND_FOREGROUND,
    },
    [
      // Top: the "Portsmith" wordmark (Inter SemiBold) — the brand, front and center.
      el(
        'div',
        {
          display: 'flex',
          fontSize: 44,
          fontWeight: 600,
          letterSpacing: -0.5,
          color: BRAND_FOREGROUND,
        },
        'Portsmith',
      ),
      // Middle: a Copper accent rule above the locked headline (Inter Regular).
      el(
        'div',
        { display: 'flex', flexDirection: 'column' },
        [
          // The share-card accent-bar idiom: width:96, height:5, borderRadius:9999.
          el('div', {
            display: 'flex',
            width: 96,
            height: 5,
            borderRadius: 9999,
            backgroundColor: COPPER,
            marginBottom: 36,
          }),
          el(
            'div',
            {
              display: 'flex',
              fontSize: 60,
              fontWeight: 400,
              lineHeight: 1.15,
              letterSpacing: -1,
              maxWidth: 920,
              color: BRAND_FOREGROUND,
            },
            HEADLINE,
          ),
        ],
      ),
      // Bottom: a quiet brand URL line (env-agnostic — the public brand domain).
      el(
        'div',
        {
          display: 'flex',
          fontSize: 30,
          fontWeight: 400,
          color: MUTED_FOREGROUND,
        },
        'portsmith.vercel.app',
      ),
    ],
  );

  const res = new ImageResponse(card, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: [
      { name: 'Inter', data: interSemiBold, weight: 600, style: 'normal' },
      { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
    ],
  });

  const bytes = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, bytes);
  console.log(`wrote ${OUT_PATH} — ${CARD_WIDTH}x${CARD_HEIGHT}, ${bytes.length} bytes`);
}

main().catch((err) => {
  console.error(`[generate-og-default] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
