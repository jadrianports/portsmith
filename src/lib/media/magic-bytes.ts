/**
 * Magic-byte content sniffing — the authoritative MEDIA-01 gate primitive.
 *
 * Supabase Storage trusts the DECLARED content-type / extension and does NO byte
 * inspection (RESEARCH Finding A), so the bucket MIME allowlist alone cannot satisfy
 * "sniff the actual content, not the declared MIME". The upload route reads the
 * bytes itself and runs `sniffMime` to detect the REAL type, then checks it against
 * the slot's allowlist below.
 *
 * SVG/GIF/JPEG/PNG are DELIBERATELY excluded from `ALLOWED_IMAGE_MIME` — the client
 * pipeline produces ONLY `image/webp` (D-04/D-05), and SVG is an XSS vector
 * (migration 003 excludes it from every bucket allowlist too). So a renamed
 * `.jpg`/`.gif`/`.svg`, or a crafted file with a `.webp` extension, is rejected here
 * even though Storage would accept the declared type.
 *
 * Mirrors the "export the allowlist + a thin pure wrapper" style of `sections.ts`
 * (`httpUrlOrEmptyOptional` / `altTextOk`). Separated into its own module so the
 * pure allowlist/sniff is unit-testable in the vitest `node` project.
 *
 * `file-type` is ESM-only (the repo is `"type": "module"`, so the named import works
 * in the app, the route, and Vitest). `fileTypeFromBuffer` resolves to
 * `{ ext, mime } | undefined` — we normalize the no-match `undefined` to `null`.
 * [CITED: github.com/sindresorhus/file-type]
 */
import { fileTypeFromBuffer } from 'file-type';

/** The ONLY image mime an upload may resolve to (D-04/D-05). SVG/GIF/JPEG/PNG rejected. */
export const ALLOWED_IMAGE_MIME = new Set<string>(['image/webp']);

/** The ONLY résumé mime an upload may resolve to (D-11). */
export const ALLOWED_PDF_MIME = new Set<string>(['application/pdf']);

/**
 * Sniff the ACTUAL content type from the leading bytes (NOT the declared MIME).
 * Returns the detected mime, or `null` when `file-type` cannot identify the buffer.
 */
export async function sniffMime(bytes: Uint8Array): Promise<string | null> {
  const t = await fileTypeFromBuffer(bytes);
  return t?.mime ?? null;
}
