/**
 * `safeHref` — the render-time URL scheme guard (CR-01, 03-REVIEW).
 *
 * DEFENSE-IN-DEPTH LAYER 2. The Zod gate (`httpUrlOrEmptyOptional` in
 * `@/lib/validations/sections`) already constrains stored URLs to http/https at
 * WRITE time. But the section render contract is explicitly FROZEN (03-04) and the
 * `minimal` template — plus every future template that inherits these renderers —
 * drops content URLs straight into `href`/`src` attributes. A single missed gate,
 * a future field added without the scheme restriction, or content written by a
 * not-yet-built path would re-open the stored-XSS hole. `safeHref` is the belt to
 * the gate's suspenders: it is called by EVERY template link renderer so a
 * dangerous-scheme URL is dropped at the point of rendering regardless of how it
 * reached the component.
 *
 * WHY `rel`/`target` is NOT enough: a `javascript:`/`data:`/`vbscript:` href
 * executes in the CURRENT document the moment the link is clicked — `target="_blank"`
 * and `rel="noopener noreferrer"` do not neutralize it. The scheme MUST be checked.
 *
 * ALLOWED FORMS (returns the URL unchanged):
 *   - absolute http: / https: URLs (the normal case — external links, images)
 *   - in-page anchors: `#contact`, `#projects` (the hero CTA defaults to `#contact`)
 *   - root-relative paths: `/x`, `/foo/bar` (internal navigation; never a scheme)
 *   - `mailto:` ONLY when `{ allowMailto: true }` is passed (the contact section's
 *     legitimate email link — never enabled for arbitrary content links)
 *
 * Everything else (`javascript:`, `data:`, `vbscript:`, `file:`, protocol-relative
 * `//evil.com`, unparseable junk, empty/nullish) returns `undefined` — the caller
 * then omits the link entirely (it never renders a dead or dangerous `href`).
 *
 * This is contract-safe: it operates only on the template's internal markup and
 * does NOT change the frozen `{ section }` / `PortfolioData` data contract.
 */

/** The schemes a content link may use without `allowMailto`. */
const SAFE_SCHEMES = new Set(['http:', 'https:']);

export interface SafeHrefOptions {
  /**
   * Allow the `mailto:` scheme. Enabled ONLY for the contact section's public-email
   * link (the email itself is separately validated by `z.email()`). Never enable
   * this for arbitrary content/profile URLs.
   */
  allowMailto?: boolean;
}

/**
 * Return `raw` if it is a safe href, otherwise `undefined` (caller omits the link).
 *
 * - http(s) absolute URLs → returned as-is.
 * - in-page anchors (`#...`) and root-relative paths (`/...`) → returned as-is.
 *   (A root-relative path is NOT a protocol-relative `//host` URL — the latter is
 *   rejected because the `URL` parse below would resolve it to an arbitrary host.)
 * - `mailto:` → returned only when `allowMailto` is set.
 * - anything else (dangerous scheme, protocol-relative, unparseable, empty) →
 *   `undefined`.
 */
export function safeHref(
  raw: string | null | undefined,
  options: SafeHrefOptions = {},
): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;

  // In-page anchor (`#contact`) — never carries a scheme; always safe.
  if (trimmed.startsWith('#')) return raw;

  // Root-relative path (`/x`) — safe, but EXCLUDE protocol-relative `//host`, which
  // points at an arbitrary external origin.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return raw;

  // Absolute URL — parse and check the scheme against the allowlist.
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined; // unparseable → not a safe href
  }

  if (SAFE_SCHEMES.has(parsed.protocol)) return raw;
  if (options.allowMailto && parsed.protocol === 'mailto:') return raw;

  return undefined;
}
