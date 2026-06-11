import { describe, expect, it } from 'vitest';
// The default export is `withBotId(nextConfig)` (16-06): withBotId wraps `headers()`
// so it SPREADS our static set first, then APPENDS a BotID proxy-path entry. We pull
// the static security set by its `source: '/(.*)'` selector (not by index), so the
// assertions stay robust against the BotID-appended entry.
import nextConfig from '../../../next.config';

/**
 * D-13 / D-14 / D-22 — cheap regression guard on the static SSG-safe security headers.
 *
 * The load-bearing invariants this locks:
 *  - CSP carries the structural directives (frame-ancestors/object-src/base-uri/
 *    form-action) AND keeps inline scripts working via `script-src-elem 'unsafe-inline'`
 *    + the Turnstile origin — and carries NO `script-src` nonce (a nonce would force
 *    per-request render and break `/[username]` SSG, D-14/D-22).
 *  - HSTS is the 1-year-no-preload value (OQ-4) — `preload` is a hard-to-undo commitment
 *    deferred to the portsmith.app launch.
 *  - nosniff / Referrer-Policy / Permissions-Policy are present.
 */
describe('next.config.ts — static SSG-safe security headers (D-13/D-14)', () => {
  async function staticHeaderSet(): Promise<Record<string, string>> {
    expect(typeof nextConfig.headers).toBe('function');
    // headers() is required to be a function above; assert + invoke.
    const entries = await nextConfig.headers!();
    // The static defense-in-depth set is the entry matching every route.
    const everyRoute = entries.find((e) => e.source === '/(.*)');
    expect(everyRoute, "expected a headers entry on source '/(.*)'").toBeDefined();
    const map: Record<string, string> = {};
    for (const h of everyRoute!.headers) map[h.key] = h.value;
    return map;
  }

  it("emits a CSP with the structural directives and NO script-src nonce", async () => {
    const headers = await staticHeaderSet();
    const csp = headers['Content-Security-Policy'];
    expect(csp, 'Content-Security-Policy must be present').toBeTruthy();

    // Structural / clickjacking directives.
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");

    // Inline scripts keep working (FOUC / JSON-LD) + Turnstile allowed — via
    // script-src-elem 'unsafe-inline', NEVER a nonce (D-14 / D-22 SSG-safe).
    expect(csp).toContain('script-src-elem');
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).toContain('https://challenges.cloudflare.com');

    // The SSG-breaking token must be absent from the CSP value.
    expect(csp).not.toContain('nonce');
  });

  it('emits HSTS at the 1-year value WITHOUT preload (OQ-4)', async () => {
    const headers = await staticHeaderSet();
    const hsts = headers['Strict-Transport-Security'];
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).not.toContain('preload');
  });

  it('emits nosniff / Referrer-Policy / Permissions-Policy', async () => {
    const headers = await staticHeaderSet();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toContain('camera=()');
  });
});
