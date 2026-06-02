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
 * This guard restricts an `<Image src>` to http(s) on the SUPABASE STORAGE ORIGIN
 * ONLY — rejecting `data:`, `javascript:`, `blob:`, `file:`, protocol-relative
 * `//host`, ANY foreign http(s) host, and any other scheme. It is the render-layer
 * complement to the write-time URL gate: the caller renders the `<Image>` ONLY when
 * `isHttpImageSrc(src)` is true, otherwise it omits the image (the surrounding
 * "render-only-if-present" guards already handle the absent case).
 *
 * HOST-LOCK (D-08, Phase 5): the host allowlist is now ENFORCED — Supabase Storage
 * (`NEXT_PUBLIC_SUPABASE_URL`) is the canonical and ONLY allowed image origin. This
 * closes the arbitrary-http(s)-host hole: every rendered image must be an uploaded
 * Storage object (the Phase-5 upload pipeline), so an attacker-influenced foreign
 * URL in DB content can never become an `<Image src>` loaded by a visitor. This is
 * the SAME origin check `urlToStoragePath` uses (`@/lib/media/storage-path`) — the
 * render-lock and the delete-path parse agree on "is this a Storage URL".
 *
 * CONSEQUENCE: existing pasted external image URLs (including seed placeholders)
 * stop rendering until re-uploaded to Storage — a documented post-deploy human step
 * (RESEARCH Runtime State Inventory), not a data migration.
 */

/** Schemes an image `src` may use. http/https only — no `data:`/`blob:`/etc. */
const SAFE_IMAGE_SCHEMES = new Set(['http:', 'https:']);

/**
 * True iff `src` is a non-empty absolute http(s) URL on the Supabase Storage origin
 * (D-08 host-lock) and therefore safe to pass to `<Image src>`. Returns false for
 * nullish/empty, unparseable, protocol-relative, any non-http(s) scheme, OR any
 * foreign (non-Storage) origin.
 */
export function isHttpImageSrc(src: string | null | undefined): src is string {
  if (typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (trimmed.length === 0) return false;
  // Reject protocol-relative `//host` (URL would resolve to an arbitrary origin).
  if (trimmed.startsWith('//')) return false;
  try {
    const u = new URL(trimmed);
    if (!SAFE_IMAGE_SCHEMES.has(u.protocol)) return false;
    // D-08 host-lock: Storage is the ONLY allowed image origin. Same origin check
    // `urlToStoragePath` uses — they MUST agree on "is this a Storage URL".
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    return u.origin === base.origin;
  } catch {
    return false;
  }
}
