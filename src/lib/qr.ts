import 'server-only';

/**
 * portfolioQrSvg (DIST-01 / D-06) — the SERVER-ONLY QR generator for an owner's
 * PUBLIC portfolio URL.
 *
 * THE INVARIANT (DIST-01 / D-06 / the draft-token secrecy line — proven by
 * tests/unit/qr.test.ts): the QR a user downloads onto a business card / slide deck
 * must encode the canonical PUBLIC url `siteUrl('/' + username)` — derived from
 * `NEXT_PUBLIC_SITE_URL` (src/lib/url.ts), NEVER from a request `Host`, and NEVER the
 * secret `/draft/<token>` link. A QR that embedded the draft token would leak a
 * revocable private preview into a printed artifact that outlives any revoke.
 *
 * BUNDLE INVARIANT (D-06): `import 'server-only'` is the FIRST LINE — the `qrcode`
 * library NEVER reaches the dashboard client bundle (proven separately by
 * `npm run check:bundle`). The Share panel (`'use client'`) receives the returned SVG
 * STRING as a prop (static, inlineable markup — the sanctioned static-SVG path); it
 * never imports `qrcode`.
 *
 * The returned value is a self-contained `<svg …>` document string with crisp vector
 * paths (`type: 'svg'`), a tight quiet zone (`margin: 1`), and `errorCorrectionLevel:
 * 'M'` (the standard ~15%-recovery balance for a printed/scanned code).
 */
import QRCode from 'qrcode';

import { siteUrl } from '@/lib/url';

/**
 * The PUBLIC URL the QR encodes for `username` — `siteUrl('/' + username)`,
 * host-independent (D-06). Exposed as a companion builder so the QR target is
 * inspectable WITHOUT decoding the SVG (the unit test asserts on this), and so the
 * encoded value provably never embeds a draft token or the request Host.
 */
export function portfolioQrTarget(username: string): string {
  // Delegate slash normalization to siteUrl (it adds a missing leading slash and
  // never doubles an existing one), so `portfolioQrTarget('jadrianports')` and
  // `portfolioQrTarget('/jadrianports')` both yield the canonical public URL.
  return siteUrl(username);
}

/**
 * Generate the portfolio QR as a self-contained SVG document string.
 *
 * Synchronous by design: `qrcode`'s `toString` invokes its callback IMMEDIATELY for
 * the SVG renderer (no async I/O — it is pure CPU), so we capture the result in a
 * synchronous callback. This keeps the helper callable inline from an RSC render
 * boundary (no `await`) and matches the unit-test contract (`portfolioQrSvg(username)`
 * returns the SVG string directly).
 *
 * @param username the owner's username — the QR encodes `portfolioQrTarget(username)`.
 * @returns a `<svg …>` document string (the PUBLIC url only — never a token/Host).
 */
export function portfolioQrSvg(username: string): string {
  const url = portfolioQrTarget(username);
  let svg = '';
  let captured: Error | null = null;
  // The SVG renderer fires the callback synchronously (pure CPU, no I/O), so this
  // assignment completes before `toString` returns — no await needed.
  QRCode.toString(
    url,
    { type: 'svg', margin: 1, errorCorrectionLevel: 'M' },
    (err, str) => {
      if (err) {
        captured = err;
        return;
      }
      svg = str;
    },
  );
  if (captured) throw captured;
  return svg;
}
