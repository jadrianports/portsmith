/**
 * Reading-time derivation (D-06 derived field).
 *
 * Computed from the Markdown source — words ÷ 200 wpm, floored at 1 minute,
 * formatted `'N min'`. Pure (no I/O); safe to call in any render context.
 */

/** Words-per-minute baseline (RESEARCH Code Examples / D-06). */
const WPM = 200;

/**
 * Estimate reading time from a Markdown body string.
 * @returns A human-readable label, e.g. `'1 min'`, `'4 min'`.
 */
export function readingTimeFromMarkdown(md: string): string {
  const words = md.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / WPM));
  return `${minutes} min`;
}
