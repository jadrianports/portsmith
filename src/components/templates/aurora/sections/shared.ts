/**
 * Shared inline-style helpers for the `aurora` template sections (11-04 Wave-C). Pure
 * server-side style constants — NO client JS, NO chrome token, every value reads a
 * scoped `var(--token)` from `theme.css`. Kept in ONE module so every section's mono
 * kicker / section heading / hairline rule is byte-identical (DRY across the 12
 * sections + footer), the same idiom the editorial/minimal sections inline per-file.
 */
import type { CSSProperties } from 'react';

/** A string field is "present" when it is a non-empty trimmed string. */
export function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Mono kicker label — uppercase Space Mono (the section "department" tag). */
export const kickerStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  fontWeight: 700,
  lineHeight: 1.4,
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
  color: 'var(--accent)',
  margin: 0,
};

/** The section heading (Poppins display, plum ink — not the accent). */
export const headingStyle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
  lineHeight: 1.15,
  letterSpacing: '-0.01em',
  color: 'var(--fg)',
  margin: 0,
};

/** The standard section vertical rhythm wrapper style (shelled + paddingBlock). */
export const sectionShellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '32px',
  paddingBlock: 'clamp(64px, 12vh, 120px)',
};

/** A soft rose decorative hairline rule under the kicker (gradient, low-key). */
export const hairlineStyle: CSSProperties = {
  height: '2px',
  width: '56px',
  borderRadius: '2px',
  background: 'var(--aurora-gradient)',
};
