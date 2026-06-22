/**
 * `icon.tsx` — the 32×32 PNG app-icon (D-02/D-10), Next 16 metadata-file convention.
 *
 * Renders the square-padded brand mark via `next/og`'s `ImageResponse` (Satori + resvg,
 * both bundled in next@16.2.6 — ZERO new packages). Mark-only (no text → no font read →
 * no I/O failure point at all). `runtime='nodejs'` is mandatory: Satori rasterization
 * needs the Node runtime, never edge (Pitfall 3). Lives under `(chrome)/` only so the
 * brand icon scopes to chrome routes and never leaks onto the public `(portfolio)` tree
 * (BRAND-05) — there is no app-root layout, so each route group owns its own icons.
 */
import { ImageResponse } from 'next/og';

import { squarePaddedMark } from './_brand-mark';

// Satori rasterization requires the Node runtime (edge has no fs / native rasterizer).
export const runtime = 'nodejs';

/** Metadata-file segment exports — Next injects the <link rel="icon"> from these. */
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(squarePaddedMark(32), { ...size });
}
