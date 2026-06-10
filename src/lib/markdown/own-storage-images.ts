/**
 * Own-storage image predicate + extractor (D-11 + post-delete cleanup, WR-03).
 *
 * The ONE shared own-storage predicate — imported by both `url-policy.ts`
 * (render-time `urlTransform` image drop) and the post-delete media cleanup
 * (recompute referenced images from the Markdown body, avoiding the WR-01
 * orphan-image leak). Keeping a single predicate means the render drop and the
 * delete recompute can never disagree about what "our storage" is.
 *
 * "Our storage" is DERIVED from `NEXT_PUBLIC_SUPABASE_URL` (never hardcoded) —
 * the public Supabase storage object path:
 *   {SUPABASE_URL}/storage/v1/object/public/{bucket}/...
 */

/** The public storage object path prefix (after the origin). */
const PUBLIC_OBJECT_PATH = '/storage/v1/object/public/';

/** The own Supabase origin, derived from env (no trailing slash). */
function ownStorageOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * True when `url` is an absolute URL pointing at OUR Supabase public storage
 * bucket path. Foreign origins, non-http(s) schemes, and the public-object
 * path missing are all rejected. This is the authoritative D-11 image gate.
 */
export function isOwnStorageImageUrl(url: string): boolean {
  const origin = ownStorageOrigin();
  if (!origin) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Relative / malformed URLs are never own-storage (we require an absolute
    // URL on our origin so an attacker cannot smuggle a foreign host).
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (parsed.origin !== origin) return false;
  return parsed.pathname.startsWith(PUBLIC_OBJECT_PATH);
}

/** Matches a Markdown image: `![alt](url)` — captures the URL (group 1). */
const MD_IMAGE_RE = /!\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)/g;

/**
 * Extract every OWN-STORAGE image URL referenced in a Markdown body.
 *
 * Returns a de-duplicated list of own-storage image URLs (foreign images are
 * filtered out — they cannot have been uploaded to our bucket). Consumed by the
 * post-delete media cleanup (13.2-04) to recompute the referenced set from the
 * body and free genuinely-dropped objects (WR-03 shape; avoids the WR-01 leak).
 */
export function ownStorageImageUrlsInMarkdown(md: string): string[] {
  const seen = new Set<string>();
  for (const match of md.matchAll(MD_IMAGE_RE)) {
    // Strip the optional angle-bracket wrapper (`![a](<url>)`).
    const url = match[1].replace(/^<|>$/g, '').trim();
    if (url && isOwnStorageImageUrl(url)) seen.add(url);
  }
  return [...seen];
}
