/**
 * SHARE-01 / D-01 — the per-portfolio `slug→accent` map (the share-card tint source).
 *
 * Models `tests/unit/templates/registry-consistency.test.ts`: a `describe.each` per-slug
 * assertion + a key-set cross-check + the safe-degrade (unknown/null → default) idiom.
 *
 * The load-bearing guard is the KEY-SET PARITY: `Object.keys(SLUG_ACCENT)` must equal
 * `Object.keys(templateRegistry)` (the canonical accepted-slug surface). A new template
 * added to the registry without an accent entry goes RED here — it can never silently lose
 * its card tint (D-01: "every future template gets a good card for free").
 *
 * VALUES are sourced from each live template's scoped `theme.css` `--accent` token, resolved
 * to a STATIC hex (Satori cannot parse `oklch` — RESEARCH Pitfall 4):
 *   minimal `#ff2d95` · editorial `#c8381f` · aurora `#d6336c` · edgerunner-v2 `#ff2d95`.
 * (PATTERNS.md correction: minimal DOES have a scoped accent `#ff2d95`; RESEARCH's `#111827`
 * was wrong. edgerunner-v2's `var(--neon-pink)` = `oklch(0.72 0.30 350)` resolves to `#ff2d95`.)
 */
import { describe, expect, it } from 'vitest';

import { accentForSlug, SLUG_ACCENT, DEFAULT_ACCENT } from '@/lib/og/template-accent';
import { templateRegistry } from '@/components/templates/registry';

/** The resolved hex each live slug's card must tint with (from each template's theme.css). */
const EXPECTED: ReadonlyArray<readonly [slug: string, hex: string]> = [
  ['minimal', '#ff2d95'],
  ['editorial', '#c8381f'],
  ['aurora', '#d6336c'],
  ['edgerunner-v2', '#ff2d95'],
];

describe('SHARE-01 / D-01 — accentForSlug resolves the per-slug card tint', () => {
  describe.each(EXPECTED)('slug "%s"', (slug, hex) => {
    it(`accentForSlug("${slug}") === "${hex}" (the resolved theme.css --accent)`, () => {
      expect(accentForSlug(slug)).toBe(hex);
    });

    it(`SLUG_ACCENT["${slug}"] === "${hex}" (the static map value)`, () => {
      expect(SLUG_ACCENT[slug]).toBe(hex);
    });

    it(`is a resolved hex, NOT oklch (Satori cannot parse oklch — Pitfall 4)`, () => {
      expect(SLUG_ACCENT[slug]).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});

describe('SHARE-01 / D-01 — safe-degrade (mirrors slugForTemplateId): never undefined', () => {
  it('accentForSlug("does-not-exist") === DEFAULT_ACCENT', () => {
    expect(accentForSlug('does-not-exist')).toBe(DEFAULT_ACCENT);
  });

  it('accentForSlug(null) === DEFAULT_ACCENT', () => {
    expect(accentForSlug(null)).toBe(DEFAULT_ACCENT);
  });

  it('accentForSlug(undefined) === DEFAULT_ACCENT', () => {
    expect(accentForSlug(undefined)).toBe(DEFAULT_ACCENT);
  });

  it('accentForSlug("") === DEFAULT_ACCENT (empty string is falsy → degrade)', () => {
    expect(accentForSlug('')).toBe(DEFAULT_ACCENT);
  });

  it('DEFAULT_ACCENT is itself a resolved hex (never oklch/undefined)', () => {
    expect(DEFAULT_ACCENT).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('SHARE-01 / D-01 — key-set parity: the accent map cannot drift from the registry', () => {
  it('Object.keys(SLUG_ACCENT) (sorted) deep-equals Object.keys(templateRegistry) (sorted)', () => {
    const accentKeys = Object.keys(SLUG_ACCENT).sort();
    const registryKeys = Object.keys(templateRegistry).sort();
    expect(
      accentKeys,
      'SLUG_ACCENT must have EXACTLY one entry per registered template — a new template ' +
        'without an accent (or a stale accent for a removed template) goes RED here (D-01).',
    ).toEqual(registryKeys);
  });

  it('has at least one entry to cross-check', () => {
    expect(Object.keys(SLUG_ACCENT).length).toBeGreaterThan(0);
  });
});
