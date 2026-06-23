/**
 * Shared inline-style helpers for the `atelier` template sections (36-02). Pure
 * server-side style constants — NO client JS, NO chrome token, every value reads a
 * scoped `var(--token)` from `theme.css`. Kept in ONE module so every section's kicker
 * label / section heading / hairline rule is byte-identical (DRY), the same idiom the
 * aurora/editorial/minimal sections inline per-file.
 *
 * FAITHFUL CLONE NOTE (D-04): the Lovable export's `text-kicker` is a SANS (not mono)
 * uppercase micro-label — `font-size: 0.6875rem`, `letter-spacing: 0.22em`, `font-weight:
 * 500`, painted in the acid-green accent. `kickerStyle` reproduces that EXACTLY (the
 * export's `--font-sans` body face → atelier's `--font-body`, since chrome Inter is
 * forbidden inside a template). The display heading is Bebas-Neue-flavored: huge,
 * UPPERCASE, ultra-tight leading. `present()` is copied verbatim from aurora.
 */
import type { CSSProperties } from 'react';

/** A string field is "present" when it is a non-empty trimmed string. */
export function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * The export's `text-kicker` — uppercase sans micro-label in the acid-green accent
 * (`0.6875rem` / `0.22em` tracking / weight 500). The section "department" tag
 * ("01 — About", "02 — Selected Work", …).
 */
export const kickerStyle: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '0.6875rem',
  fontWeight: 500,
  lineHeight: 1.4,
  textTransform: 'uppercase',
  letterSpacing: '0.22em',
  color: 'var(--accent)',
  margin: 0,
};

/**
 * The section heading — the export's `font-display` (Bebas Neue): oversized, UPPERCASE,
 * ultra-tight leading, the sharp-cornered editorial voice. Painted in `--fg`.
 */
export const headingStyle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 400,
  fontSize: 'clamp(2.5rem, 7vw, 7rem)',
  lineHeight: 0.9,
  letterSpacing: '-0.01em',
  textTransform: 'uppercase',
  color: 'var(--fg)',
  margin: 0,
};

/**
 * The standard section vertical rhythm wrapper style. The export's sections are
 * `py-24 md:py-40` (96px → 160px) with a top hairline rule between sections — reproduced
 * via `sectionShellStyle` paddingBlock + the `.tmpl-atelier` section `border-top`.
 */
export const sectionShellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '40px',
  paddingBlock: 'clamp(96px, 14vh, 160px)',
};
