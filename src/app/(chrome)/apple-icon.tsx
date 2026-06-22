/**
 * `apple-icon.tsx` — the 180×180 apple-touch PNG (D-02/D-10), Next 16 metadata-file
 * convention. Identical shape to `icon.tsx` but at the iOS home-screen size, using the
 * SAME square-padded `squarePaddedMark` helper (geometry authored once). iOS masks the
 * touch icon to a rounded square, so the mask-safe padding in `_brand-mark.tsx` keeps the
 * circular seal from being clipped. Mark-only → no font read → no I/O. `runtime='nodejs'`
 * is mandatory for Satori (Pitfall 3). `(chrome)`-scoped only (BRAND-05).
 */
import { ImageResponse } from 'next/og';

import { squarePaddedMark } from './_brand-mark';

export const runtime = 'nodejs';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(squarePaddedMark(180), { ...size });
}
