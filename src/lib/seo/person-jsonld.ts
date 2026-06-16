/**
 * `buildPersonLd` — the pure, template-agnostic schema.org `Person` JSON-LD
 * builder (SEO-01 / D-08; RESEARCH "Code Examples" -> Person JSON-LD).
 *
 * One data-driven SEO engine reading the already-assembled `PortfolioData`: it is
 * a PURE function (no I/O, no DB, no request access) so any template can render its
 * output as a server-side `<script type="application/ld+json">`. Templates 2-3
 * (Phase 7) inherit correct structured data for free by calling this same builder.
 *
 * LOAD-BEARING (PUB-03 / T-06-06): the `url` is ALWAYS `siteUrl('/'+username)` --
 * derived from `NEXT_PUBLIC_SITE_URL`, NEVER the request host. A request-host read
 * here would (a) let host-header injection poison the JSON-LD `url` and (b)
 * re-introduce request-time dynamism on the ISR public route (D-22). siteUrl() is
 * the single host-safe origin source (verified url.ts).
 *
 * OPTIONAL FIELDS ARE OMITTED (not emitted empty): `image` only when the profile
 * has an `avatar_url`; `jobTitle` only when it has a `headline`. `sameAs` is the
 * filtered, non-null set of the configured social links (an empty array when none).
 *
 * SECURITY (T-06-09 / CR-01): the values returned here include user-controlled,
 * free-text fields (`name` <- `display_name`, `jobTitle` <- `headline`) that carry
 * NO character allowlist. `JSON.stringify` alone is NOT safe for the `<script>`
 * injection context -- it does NOT escape `<`, `>`, `&`, or `/`, so a value
 * containing `</script>` would terminate the script element early and inject HTML
 * (stored XSS). Templates therefore MUST serialize via `jsonLdToScriptHtml` /
 * `personLdScriptHtml` below, which escape the breakout characters. Do NOT call raw
 * `JSON.stringify` into a `dangerouslySetInnerHTML` `<script>` body.
 */
import type { PortfolioData } from '@/components/templates/types';
import { siteUrl } from '@/lib/url';
import { safeHref } from '@/lib/safe-url';

/** The schema.org `Person` shape this builder emits (optional fields omitted). */
export interface PersonLd {
  '@context': 'https://schema.org';
  '@type': 'Person';
  name: string;
  url: string;
  image?: string;
  jobTitle?: string;
  sameAs?: string[];
}

/**
 * Build the `Person` JSON-LD object for a portfolio. PURE -- no I/O. `name` falls
 * back to `username` when `display_name` is absent; `url` is always the env-driven
 * `siteUrl('/'+username)` (never the request host -- PUB-03).
 */
export function buildPersonLd(data: PortfolioData, username: string): PersonLd {
  const { profile, settings } = data;

  // The configured social links, in display order (settings.socials), with each url
  // through safeHref (CR-01: http(s)-only, drops javascript:/data:/unparseable) and
  // null/blank entries dropped. Same gate as the rendered template links (T-25-09).
  const socials = Array.isArray(settings.socials) ? settings.socials : [];
  const sameAs = socials
    .map((s) => safeHref((s as { url?: unknown } | null)?.url as string | null | undefined))
    .filter((u): u is string => typeof u === 'string');

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.display_name ?? username,
    url: siteUrl(`/${username}`),
    ...(profile.avatar_url ? { image: profile.avatar_url } : {}),
    ...(profile.headline ? { jobTitle: profile.headline } : {}),
    sameAs,
  };
}

// U+2028 / U+2029 are JS line terminators, so a RAW code point inside a regex
// LITERAL (/.../) is an "unterminated regular expression" syntax error. Build the
// patterns from \u-escaped strings via the RegExp constructor instead -- the source
// stays pure ASCII while the pattern still matches the real separators.
const LINE_SEP = new RegExp('\\u2028', 'g');
const PARA_SEP = new RegExp('\\u2029', 'g');

/**
 * CR-01 (stored-XSS close): serialize an arbitrary JSON-LD object into a string
 * that is SAFE to drop into a `<script type="application/ld+json">` body via
 * `dangerouslySetInnerHTML`.
 *
 * `JSON.stringify` escapes `"` and control chars but NOT the HTML/JS breakout
 * characters, so a user-controlled value containing `</script>` (or `<!--`, or the
 * U+2028/U+2029 line/paragraph separators that are valid in JSON strings but break
 * inline scripts) could escape the element. We post-process the serialized string:
 *   - `<`      -> `<`  (prevents `</script>` / `<!--` breakout -- load-bearing)
 *   - `>`      -> `>`  (defense-in-depth; closes `-->` and `]]>` edge cases)
 *   - `&`      -> `&`  (defense-in-depth against entity-context confusion)
 *   - U+2028   -> ` `, U+2029 -> ` ` (valid in JSON, invalid raw in script)
 *
 * Every replacement is a JSON-string-legal `\uXXXX` escape, so the output STILL
 * parses back to the identical object via `JSON.parse`. This is the single
 * host-safe serializer; Phase-7 templates inherit it instead of re-introducing raw
 * `JSON.stringify`.
 */
export function jsonLdToScriptHtml(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEP, '\\u2028')
    .replace(PARA_SEP, '\\u2029');
}

/**
 * Build the Person JSON-LD for a portfolio AND serialize it safely for a
 * `<script>` body in one call -- the path templates should use. Equivalent to
 * `jsonLdToScriptHtml(buildPersonLd(data, username))`.
 */
export function personLdScriptHtml(data: PortfolioData, username: string): string {
  return jsonLdToScriptHtml(buildPersonLd(data, username));
}
