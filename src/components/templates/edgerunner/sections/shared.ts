/**
 * Shared inline-style helpers for the `edgerunner` template sections (PIPE-09). Pure
 * server-side style constants — NO client JS, NO chrome token, every value reads a
 * scoped `var(--token)` from `theme.css`. Kept in ONE module so every section's mono
 * kicker / section heading / hairline rule is byte-identical (DRY across the 7
 * sections + footer), the same idiom aurora uses.
 *
 * Re-colored to the edgerunner neon palette (the kicker is neon-cyan, the hairline is
 * the neon gradient) — but ONLY via `var(--token)` (no hardcoded hex; that all lives in
 * theme.css). The mono face is VT323 (the CRT terminal label).
 */
import type { CSSProperties } from 'react';

/** A string field is "present" when it is a non-empty trimmed string. */
export function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Mono kicker label — uppercase VT323 CRT tag (the section "department" label). */
export const kickerStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '18px',
  fontWeight: 400,
  lineHeight: 1.2,
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
  color: 'var(--neon-cyan)',
  margin: 0,
};

/** The section heading (Orbitron display, foreground — not the accent). */
export const headingStyle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
  lineHeight: 1.15,
  letterSpacing: '0.01em',
  color: 'var(--fg)',
  margin: 0,
};

/** The standard section vertical rhythm wrapper style (shelled + paddingBlock). */
export const sectionShellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '32px',
  paddingBlock: 'clamp(80px, 14vh, 160px)',
};

/** A neon decorative hairline rule under the kicker (the signature neon gradient). */
export const hairlineStyle: CSSProperties = {
  height: '2px',
  width: '56px',
  borderRadius: '2px',
  background: 'var(--neon-gradient)',
};

/**
 * Eyebrow label — the small `//`-prefixed SectionHeading meta-tag above a heading
 * (e.g. `// 03 / projects`). Mono VT323, uppercase, neon-cyan, smaller than the
 * section kicker. The section kicker (`kickerStyle`) is the prominent 18px CRT
 * department label; the eyebrow is the finer 13px sub-label used ABOVE a heading
 * in card/list contexts — the same role aurora's small kicker plays on its cards.
 */
export const eyebrowStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  fontWeight: 400,
  lineHeight: 1.3,
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'var(--neon-cyan)',
  margin: 0,
};

/** Muted body copy — supporting text in meta/dates/descriptions (subdued, readable). */
export const mutedBodyStyle: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 400,
  fontSize: '16px',
  lineHeight: 1.55,
  color: 'var(--muted-fg)',
  margin: 0,
};

/**
 * Holo-panel card base — the reusable elevated card surface for project / metric /
 * experience cards. References scoped tokens only; no hardcoded hex.
 */
export const cardStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '24px',
};
