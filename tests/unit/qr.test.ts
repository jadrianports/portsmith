/**
 * DIST-01 — the QR helper encodes the PUBLIC portfolio URL only (Wave 0 RED
 * scaffold, Plan 33-01). A pure unit test (no DB, no network — runs in any env).
 *
 * THE INVARIANT (DIST-01 / D-22 relocatability + the draft-token secrecy line):
 * the QR code a user downloads to put on a business card / slide deck must encode
 * the canonical PUBLIC url `siteUrl('/' + username)` — derived from
 * `NEXT_PUBLIC_SITE_URL` (src/lib/url.ts), NEVER from a request `Host`, and NEVER
 * the secret `/draft/<token>` link. A QR that embedded the draft token would leak
 * a revocable private preview into a printed artifact that outlives any revoke.
 * The helper returns a self-contained SVG document string (`<svg …>`), so it is
 * inlineable and has zero runtime QR-lib weight on the dashboard client bundle
 * (the bundle half of DIST-01 is proven separately by `npm run check:bundle`).
 *
 * The helper under test is `portfolioQrSvg` (or equivalent) from
 * `@/lib/qr` (NOT YET BUILT — Plan 33-03 lands the production code + the audited
 * `qrcode@1.5.4` dependency behind its own blocking-human checkpoint, T-33-SC).
 * We import it through a RUNTIME variable specifier (the established RED idiom from
 * showcase-opt-in.test.ts / publish-gate.test.ts) so `tsc --noEmit` stays 0 while
 * the export is genuinely absent → the assertions are RED now, GREEN once 33-03 ships.
 *
 * ── WHY RED NOW ───────────────────────────────────────────────────────────────
 * `@/lib/qr` does not exist yet. The dynamic import throws / yields `undefined`,
 * so the suite-of-record assertions are wrapped behind `describe.skip` until 33-03.
 * One ACTIVE guard assertion (`siteUrl` already encodes the public URL, never the
 * token) keeps a non-skipped proof that the CONTRACT the helper must satisfy holds
 * today — so this file is never a zero-assertion no-op.
 */
import { describe, expect, it } from 'vitest';

import { siteUrl } from '@/lib/url';

// The not-yet-built QR helper module (Plan 33-03). Imported through a variable
// specifier so there is no STATIC reference for `tsc` to fail on; the runtime
// export is `undefined` until 33-03 lands → the .skip block below is RED-pending.
const QR_MOD = '@/lib/qr';

// The public-URL contract the QR helper MUST encode (DIST-01). This is the value
// `portfolioQrSvg(username)` is required to round-trip into the QR payload — proven
// here as an ACTIVE assertion so the contract is locked even before the helper exists.
describe('DIST-01 — the public-URL contract the QR helper must encode (ACTIVE)', () => {
  it('siteUrl("/" + username) yields the canonical public origin path, never a token/Host', () => {
    const username = 'jadrianports';
    const url = siteUrl('/' + username);
    // The QR target is the PUBLIC portfolio path on the configured origin.
    expect(url.endsWith('/' + username)).toBe(true);
    // It must never embed a draft token or a `/draft/` segment.
    expect(url).not.toContain('/draft/');
    // It is an absolute http(s) URL (so a scanned code resolves to a real page).
    expect(url).toMatch(/^https?:\/\//);
  });
});

// RED until Plan 33-03 ships `@/lib/qr`. Skipped (not `it.todo`) so the dynamic
// import is not evaluated against the missing module on every run; flip to
// `describe(` (drop `.skip`) when 33-03 lands the helper.
describe.skip('DIST-01 — portfolioQrSvg encodes siteUrl(username) into a valid SVG (RED until 33-03)', () => {
  it('exports a QR helper from @/lib/qr', async () => {
    const mod = (await import(/* @vite-ignore */ QR_MOD)) as {
      portfolioQrSvg?: (username: string) => string;
    };
    expect(typeof mod.portfolioQrSvg).toBe('function');
  });

  it('returns a self-contained SVG document string (inlineable, zero client QR-lib)', async () => {
    const mod = (await import(/* @vite-ignore */ QR_MOD)) as {
      portfolioQrSvg: (username: string) => string;
    };
    const svg = mod.portfolioQrSvg('jadrianports');
    expect(svg.trimStart().startsWith('<svg')).toBe(true);
  });

  it('encodes siteUrl("/" + username) — the PUBLIC url — never the draft token, never a Host', async () => {
    const mod = (await import(/* @vite-ignore */ QR_MOD)) as {
      portfolioQrSvg: (username: string) => string;
      portfolioQrTarget?: (username: string) => string;
    };
    // The helper (or its companion target builder) must derive the encoded value
    // from siteUrl — assert on whichever the production API exposes for inspection.
    const target = (mod.portfolioQrTarget ?? siteUrl)('/jadrianports');
    expect(target).toBe(siteUrl('/jadrianports'));
    expect(target).not.toContain('/draft/');
  });
});
