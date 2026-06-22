/**
 * `GET /app-icon/192` + `/app-icon/512` — the installable PWA icon PNGs (D-10).
 *
 * A Route Handler (NOT the metadata-file convention — mirrors the portfolio
 * `opengraph-image/route.tsx` GET shape) that serves the two manifest-referenced
 * installable icons at stable URLs via `next/og`'s `ImageResponse`. This is the
 * Sharp-free way to ship the 192/512 maskable icons: the manifest's `icons` array points
 * at `/app-icon/192` + `/app-icon/512`, and `generateStaticParams` pre-renders BOTH at
 * build so they are static (no per-request rendering).
 *
 * SECURITY (T-32-03): the `[size]` param is the ONLY input and is allow-listed to exactly
 * `'192'` / `'512'` (404 otherwise) — it is never echoed, never used to read data; the icon
 * is fixed brand geometry only. Mark-only → no font read → zero remote fetch (T-32-04).
 * `runtime='nodejs'` is mandatory for Satori rasterization (Pitfall 3). `(chrome)`-scoped.
 */
import { ImageResponse } from 'next/og';

import { squarePaddedMark } from '../../_brand-mark';

// Satori rasterization requires the Node runtime, never edge.
export const runtime = 'nodejs';

/** The exact installable icon sizes the manifest references (the allow-list). */
const ALLOWED_SIZES = new Set(['192', '512']);

/** Pre-render both icons at build so /app-icon/192 + /app-icon/512 are fully static. */
export function generateStaticParams(): { size: string }[] {
  return [{ size: '192' }, { size: '512' }];
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> },
): Promise<Response> {
  const { size } = await params; // Next 16: params is a Promise — MUST await.

  // Allow-list guard — anything other than 192/512 is a 404 (no other size is rendered).
  if (!ALLOWED_SIZES.has(size)) {
    return new Response(null, { status: 404 });
  }

  const px = Number(size);
  return new ImageResponse(squarePaddedMark(px), { width: px, height: px });
}
