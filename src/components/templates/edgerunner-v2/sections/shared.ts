/**
 * Shared helpers for the `edgerunner-v2` template sections.
 * Mirrors edgerunner/sections/shared.ts.
 */

/** A string field is "present" when it is a non-empty trimmed string. */
export function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}
