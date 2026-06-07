/**
 * Shared helpers for the `edgerunner-v2` template sections.
 * Mirrors edgerunner/sections/shared.ts pattern.
 */
import type { CSSProperties } from 'react';

/** A string field is "present" when it is a non-empty trimmed string. */
export function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** The standard section vertical rhythm wrapper style (shelled + paddingBlock). */
export const sectionShellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '32px',
  paddingBlock: 'clamp(80px, 14vh, 160px)',
};
