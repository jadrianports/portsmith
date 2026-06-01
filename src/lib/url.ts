/**
 * Absolute-URL helper (PUB-03 / CONTEXT D-22).
 *
 * Formalizes the inline `${process.env.NEXT_PUBLIC_SITE_URL}/...` pattern already
 * used in `src/lib/auth/signup-action.ts` and `src/lib/auth/reset-actions.ts` into
 * a single, pure, unit-testable helper. The public portfolio page's SEO canonical
 * (03-05), the footer's absolute links (03-05), JSON-LD, the sitemap, and any email
 * link all derive their origin from here — so switching `*.vercel.app` → a real
 * domain later is purely a `NEXT_PUBLIC_SITE_URL` env change (+ DNS + a 301), with
 * zero code edits (the relocatability constraint).
 *
 * SECURITY / CACHE INVARIANT (T-03-02): the origin is derived ONLY from the
 * configured `NEXT_PUBLIC_SITE_URL` env — NEVER from `headers()` / the request
 * `Host`. Reading the request host would (a) re-introduce request-time dynamism
 * that silently opts the public route out of ISR caching (TMPL-04), and (b) allow
 * host-header injection into canonical links. The canonical is the configured
 * origin, full stop. These functions are intentionally pure.
 */

/** Default origin for local development when NEXT_PUBLIC_SITE_URL is unset/blank. */
const FALLBACK = 'http://localhost:3000';

/**
 * The configured site origin, with any trailing slash(es) stripped.
 *
 * - Reads `NEXT_PUBLIC_SITE_URL` (trimmed); falls back to `http://localhost:3000`
 *   when unset or blank.
 * - Normalizes away trailing slashes so concatenation never yields a double slash:
 *   `'https://portsmith.app/'` → `'https://portsmith.app'`.
 */
export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || FALLBACK;
  return raw.replace(/\/+$/, '');
}

/**
 * An absolute URL for `path`, derived from {@link siteOrigin}.
 *
 * - `siteUrl('/jadrianports')` → `'<origin>/jadrianports'`
 * - `siteUrl('jadrianports')`  → `'<origin>/jadrianports'` (a missing leading slash
 *   is added)
 * - `siteUrl()`                → `'<origin>/'` (the origin's root)
 */
export function siteUrl(path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${siteOrigin()}${p}`;
}
