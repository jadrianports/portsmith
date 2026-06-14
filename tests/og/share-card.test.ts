/**
 * SHARE-01 / SHARE-04 / D-02 / D-03 / D-04 — the share-card's pure decision logic.
 *
 * The `<ShareCard>` JSX itself is Satori-targeted (fully inline-styled, no classNames) and
 * is not rendered in jsdom here — instead we unit-test the PURE pieces the component composes:
 *   - `initials(displayName, username)` — the null-safe monogram-initials derivation (the
 *     PRIMARY avatar treatment, D-04; never a WebP `<img>`).
 *   - `hasHeadline(headline)` — the D-04 "drop the line on null headline" decision.
 *
 * Test-file scaffolding (the `server-only` mock) is copied from
 * `tests/unit/seo/noindex-gate.test.ts:23` — required to import any module whose first line is
 * `import 'server-only'`. The card module is server-only by construction.
 *
 * A static-source guard also asserts the monogram-primary invariant at the FILE level: the card
 * source contains NO `<img` element and NO `oklch(`/`className=` (Satori inline-style-only,
 * resolved-hex-only — RESEARCH §6 / Pitfall 4), so D-04 (monogram, never a raster avatar) and
 * D-02 (third surface, no chrome/template CSS) cannot silently regress.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { initials, hasHeadline } from '@/lib/og/share-card';

describe('SHARE-04 — initials() null-safe monogram derivation (D-04 primary avatar)', () => {
  it("initials('Ada Lovelace', 'ada') === 'AL' (first letters of the first two tokens)", () => {
    expect(initials('Ada Lovelace', 'ada')).toBe('AL');
  });

  it("initials('Cher', 'cher') === 'C' (a single token → one initial)", () => {
    expect(initials('Cher', 'cher')).toBe('C');
  });

  it("initials(null, 'jadrianports') === 'J' (null display_name → first letter of username)", () => {
    expect(initials(null, 'jadrianports')).toBe('J');
  });

  it("initials('', 'jadrianports') === 'J' (empty display_name → first letter of username)", () => {
    expect(initials('', 'jadrianports')).toBe('J');
  });

  it("initials(undefined, 'jadrianports') === 'J' (undefined display_name → username)", () => {
    expect(initials(undefined, 'jadrianports')).toBe('J');
  });

  it("initials('  spaced  out  ', 'x') === 'SO' (extra whitespace collapses; first two tokens)", () => {
    expect(initials('  spaced  out  ', 'x')).toBe('SO');
  });

  it("initials('ada lovelace', 'ada') === 'AL' (always uppercased)", () => {
    expect(initials('ada lovelace', 'ada')).toBe('AL');
  });

  it("initials('Jean-Luc Picard', 'jlp') === 'JP' (only the first two whitespace tokens count)", () => {
    expect(initials('Jean-Luc Picard', 'jlp')).toBe('JP');
  });

  it("initials('Ada Bea Carl', 'abc') === 'AB' (caps at the first two tokens, not three)", () => {
    expect(initials('Ada Bea Carl', 'abc')).toBe('AB');
  });

  it('never returns an empty string for a non-empty username (belt-and-suspenders)', () => {
    expect(initials(null, 'x').length).toBeGreaterThan(0);
  });
});

describe('SHARE-04 / D-04 — hasHeadline() drops the headline line on null/blank', () => {
  it('hasHeadline("Senior Engineer") === true (a real headline renders)', () => {
    expect(hasHeadline('Senior Engineer')).toBe(true);
  });

  it('hasHeadline(null) === false (drop the line — no empty element)', () => {
    expect(hasHeadline(null)).toBe(false);
  });

  it('hasHeadline(undefined) === false (drop the line)', () => {
    expect(hasHeadline(undefined)).toBe(false);
  });

  it('hasHeadline("") === false (blank string drops the line)', () => {
    expect(hasHeadline('')).toBe(false);
  });

  it('hasHeadline("   ") === false (whitespace-only drops the line)', () => {
    expect(hasHeadline('   ')).toBe(false);
  });
});

describe('D-04 / D-02 — share-card source is monogram-primary + inline-style-only', () => {
  const SRC = readFileSync(
    join(process.cwd(), 'src/lib/og/share-card.tsx'),
    'utf8',
  );
  // Strip block/line comments so a `<img>`/`oklch` mention in prose does not trip the guard.
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('contains NO `<img` element (monogram-primary — never a WebP raster avatar, D-04)', () => {
    expect(CODE).not.toMatch(/<img\b/);
  });

  it('does NOT consume `avatar_url` (the monogram is the only avatar treatment, D-04)', () => {
    expect(CODE).not.toMatch(/avatar_url/);
  });

  it('contains NO `oklch(` (Satori cannot parse oklch — resolved hex only, Pitfall 4)', () => {
    expect(CODE).not.toMatch(/oklch\(/);
  });

  it('contains NO `className=` (Satori honors only inline `style={{}}` — D-02 third surface)', () => {
    expect(CODE).not.toMatch(/className=/);
  });

  it("first line is `import 'server-only';` (server-only by construction)", () => {
    expect(SRC.split('\n')[0].trim()).toBe("import 'server-only';");
  });
});
