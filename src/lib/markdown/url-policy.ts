/**
 * Render-time URL policy (D-11) for react-markdown's `urlTransform`.
 *
 * `urlTransform(url, key, node)` runs on EVERY URL in the parsed Markdown. We
 * branch strictly on `key` (Pitfall 4):
 *   - `'href'` (links): allow ONLY `https:` (the render-time tightening of the
 *     Zod `protocol: /^https?$/` write gate — D-11 renders https-only). Any
 *     other scheme (`javascript:`, `data:`, `http:`, `mailto:`, …) is DROPPED
 *     by returning an empty string (react-markdown then omits the attribute).
 *   - `'src'` on an `<img>`: allow ONLY our own Supabase storage public bucket
 *     (shared predicate). Foreign images — tracking pixels, hotlinks,
 *     mixed-content — are DROPPED by returning an empty string.
 *
 * Returning `''`/`undefined` removes the attribute (drops the link/image). This
 * is the authoritative layer-2 drop; the Zod write gate is layer 1.
 */
import type { Element } from 'hast';

import { isOwnStorageImageUrl } from './own-storage-images';

/** A dropped URL — react-markdown omits the attribute when the value is empty. */
const DROP = '';

/**
 * react-markdown `urlTransform`. Branch on `key`/`node.tagName`:
 *   href → https-only; img src → own-storage-only; everything else → dropped.
 */
export function transformUrl(url: string, key: string, node: Readonly<Element>): string {
  // Image sources: own Supabase storage bucket only (D-11).
  if (key === 'src' && node.tagName === 'img') {
    return isOwnStorageImageUrl(url) ? url : DROP;
  }

  // Link hrefs: https-only (render-time tightening of the Zod allowlist, D-11).
  if (key === 'href') {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' ? url : DROP;
    } catch {
      // Relative / malformed hrefs are dropped (no smuggling via parse failure).
      return DROP;
    }
  }

  // Any other URL-bearing attribute is dropped — the feature renders only the
  // GFM link + own-storage-image surface; nothing else should carry a URL.
  return DROP;
}
