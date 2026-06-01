/**
 * `isHttpImageSrc` — the render-time image-`src` scheme guard (WR-05, 03-REVIEW).
 *
 * The `minimal` template renders avatars / project images with `next/image` +
 * `unoptimized`. `unoptimized` deliberately bypasses Next's `images.remotePatterns`
 * host allowlist (the project's image pipeline is client-side WebP with no server
 * image processing — CLAUDE.md, Vercel free tier). The consequence is that ANY
 * string passing the URL gate becomes an image `src` loaded directly by the
 * visitor's browser. Combined with the (now-closed) CR-01 `z.url()` gap, a `data:`
 * or other arbitrary-scheme `src` could be rendered.
 *
 * This guard restricts an `<Image src>` to http(s) ONLY — rejecting `data:`,
 * `javascript:`, `blob:`, `file:`, protocol-relative `//host`, and any other
 * scheme. It is the render-layer complement to the write-time URL gate: the caller
 * renders the `<Image>` ONLY when `isHttpImageSrc(src)` is true, otherwise it omits
 * the image (the surrounding "render-only-if-present" guards already handle the
 * absent case).
 *
 * NOTE: this intentionally does NOT enforce a host allowlist (arbitrary http(s)
 * hosts remain allowed in P3, as documented in the section components). The
 * residual arbitrary-host concern is flagged for the Phase-4 multi-tenant surface,
 * where Supabase Storage is expected to become the canonical image origin.
 */

/** Schemes an image `src` may use. http/https only — no `data:`/`blob:`/etc. */
const SAFE_IMAGE_SCHEMES = new Set(['http:', 'https:']);

/**
 * True iff `src` is a non-empty absolute http(s) URL safe to pass to `<Image src>`.
 * Returns false for nullish/empty, unparseable, protocol-relative, or any
 * non-http(s) scheme.
 */
export function isHttpImageSrc(src: string | null | undefined): src is string {
  if (typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (trimmed.length === 0) return false;
  // Reject protocol-relative `//host` (URL would resolve to an arbitrary origin).
  if (trimmed.startsWith('//')) return false;
  try {
    return SAFE_IMAGE_SCHEMES.has(new URL(trimmed).protocol);
  } catch {
    return false;
  }
}
