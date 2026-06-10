/**
 * Read-time source attribution — referrer host / UTM → a friendly bucket label
 * (ANLY-02 / D-10 / D-18).
 *
 * The beacon stores the RAW referrer host + RAW `utm_source`/`utm_medium` verbatim
 * (D-18 — bucket at READ time, not write time, so a new bucket can be added later
 * with NO migration). Both the owner card (Plan 04) and the operator Insights
 * surface call `toSourceBucket(...)` when aggregating to produce labels like
 * "LinkedIn 40 · Google 12 · Indeed 8 · Direct 30" (CONTEXT.md § Specific Ideas).
 *
 * Resolution order (D-10 — UTM WINS when present):
 *   1. a non-empty `utm_source` → a friendly-cased label derived from it
 *   2. else the `referrerHost` mapped via the host-substring table below
 *   3. else "Direct / unknown" (the explicit fallback bucket — app/social traffic
 *      strips the referrer; UTM tags close that gap when the owner tags their links)
 *
 * BUNDLE-SPLIT GUARD (Pitfall 3 — load-bearing): PURE, imports NOTHING from
 * `@/lib/validations` / `@/components/templates/registry`. No secrets → no
 * `import 'server-only'`. Logic-only: one exported const map + one function.
 */

/** The explicit fallback bucket (D-10). */
export const DIRECT_BUCKET = 'Direct / unknown';

/**
 * Host-substring → friendly-label map (D-10). Matched case-insensitively: the host
 * is lowercased and the FIRST entry whose substring is contained wins. Kept as a
 * single exported const so buckets can be extended at READ time without a migration
 * (D-18). Order matters — list more-specific substrings before broader ones.
 */
export const HOST_BUCKET_MAP: ReadonlyArray<readonly [substring: string, label: string]> =
  Object.freeze([
    ['linkedin', 'LinkedIn'],
    ['google', 'Google'],
    ['indeed', 'Indeed'],
    // Twitter/X — the legacy domain, the short link domain, and the rebrand.
    ['t.co', 'Twitter/X'],
    ['twitter', 'Twitter/X'],
    ['x.com', 'Twitter/X'],
    // Facebook — full domain + the `fb.` short forms.
    ['facebook', 'Facebook'],
    ['fb.', 'Facebook'],
    ['reddit', 'Reddit'],
  ] as const);

/**
 * Friendly-case a raw `utm_source` value. UTM sources are free-form and lowercase by
 * convention (`linkedin`, `newsletter`, `google`); a known token maps to its branded
 * label, otherwise the raw value is Title-Cased so it still reads cleanly in the card.
 */
function friendlyUtmSource(utmSource: string): string {
  const lower = utmSource.toLowerCase();
  for (const [substring, label] of HOST_BUCKET_MAP) {
    if (lower.includes(substring)) return label;
  }
  // Title-case an unknown free-form source (e.g. "newsletter" → "Newsletter").
  return utmSource.charAt(0).toUpperCase() + utmSource.slice(1);
}

/**
 * Map a referrer host + UTM pair to a friendly source-bucket label.
 *
 * UTM wins when a non-empty `utmSource` is present (D-10); otherwise the referrer
 * host is mapped via {@link HOST_BUCKET_MAP}; a null/unknown host falls back to
 * {@link DIRECT_BUCKET}. `utmMedium` is accepted for call-site symmetry with the
 * stored columns and future medium-aware bucketing, but the current mapping keys
 * on `utmSource` first (the source is what the friendly label names).
 */
export function toSourceBucket(
  referrerHost: string | null,
  utmSource: string | null,
  utmMedium: string | null,
): string {
  void utmMedium; // reserved for future medium-aware bucketing (D-10/D-18).

  // 1) UTM wins when present (D-10).
  const trimmedUtm = utmSource?.trim();
  if (trimmedUtm) return friendlyUtmSource(trimmedUtm);

  // 2) Map the referrer host via the substring table.
  const host = referrerHost?.trim().toLowerCase();
  if (host) {
    for (const [substring, label] of HOST_BUCKET_MAP) {
      if (host.includes(substring)) return label;
    }
  }

  // 3) Explicit fallback bucket.
  return DIRECT_BUCKET;
}
