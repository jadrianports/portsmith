/**
 * Storage URL ↔ object-path helpers — the single audited place that maps a public
 * Supabase Storage URL to its `{bucket, path}` and builds the canonical object path
 * for an upload (Phase 5, Don't-Hand-Roll: centralize the parse).
 *
 * The public URL shape is stable:
 *   {NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
 * [CITED: supabase.com/docs/reference/javascript/storage-from-getpublicurl]
 *
 * `urlToStoragePath` is ORIGIN-LOCKED to `NEXT_PUBLIC_SUPABASE_URL` (D-08 / T-05-02):
 * a foreign-origin or unparseable URL returns `null`, so the delete helper never
 * targets a non-Storage path. This is the SAME origin check `safe-image.ts`'s
 * `isHttpImageSrc` uses — they MUST agree on "is this a Storage URL".
 *
 * `buildObjectPath` always puts the VERIFIED user-id sub as the FIRST segment
 * (Pitfall 5 + migration 003 `::uuid` cast + own-folder INSERT RLS) — never a
 * user-supplied filename.
 */
import { nanoid } from 'nanoid';

import type { UploadBucket } from './upload-config';

/** The fixed public-object path prefix in a Supabase Storage public URL. */
const PUBLIC_PREFIX = '/storage/v1/object/public/';

/**
 * Parse a public Storage URL into `{ bucket, path }`, or `null` if the URL is not a
 * well-formed public object URL on the configured Storage origin.
 *
 * Returns `null` for: a foreign origin (host-lock, D-08), a URL without the public
 * prefix, a prefix with no bucket/path separator, or anything that fails `new URL()`.
 */
export function urlToStoragePath(
  url: string,
): { bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (u.origin !== base.origin) return null; // host-lock: Storage origin only (D-08)
    const i = u.pathname.indexOf(PUBLIC_PREFIX);
    if (i === -1) return null;
    const rest = u.pathname.slice(i + PUBLIC_PREFIX.length); // "{bucket}/{path...}"
    const slash = rest.indexOf('/');
    if (slash === -1) return null;
    return {
      bucket: rest.slice(0, slash),
      path: decodeURIComponent(rest.slice(slash + 1)),
    };
  } catch {
    return null;
  }
}

/**
 * Build the canonical Storage object path for an upload:
 *   `{sub}/{context}/{nanoid()}.{ext}`
 *
 * The first segment is ALWAYS the verified user-id `sub` (Pitfall 5) — load-bearing
 * for both the own-folder INSERT RLS (`(storage.foldername(name))[1] = auth.uid()`)
 * and the usage trigger's `::uuid` cast. `nanoid()` avoids collisions and
 * path-traversal from any user-controlled filename.
 */
export function buildObjectPath(
  sub: string,
  context: string,
  ext: string,
): string {
  return `${sub}/${context}/${nanoid()}.${ext}`;
}

/** Re-export for callers that build a path and then write to its bucket. */
export type { UploadBucket };
