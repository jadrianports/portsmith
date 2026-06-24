/**
 * 37-02 (Wave 2, Nyquist) — TCAT-02: the empty-category SKIP is the load-bearing branch
 * the phase goal hinges on (it is how `video` stays hidden until its template ships). A
 * mis-written skip (an empty `<h3>` emitted) or a drift to full-catalog iteration (a
 * `video` group appearing) cannot be caught by `tsc`/grep — only by sampling the derivation
 * directly. So this node-env unit test asserts `groupAllowedByCategory` over a fixture with
 * ≥1 dev, ≥1 creative, and ZERO video items.
 *
 * Pure (no I/O, no DOM) — mirrors `tests/unit/editor/rail-grouping.test.ts`: plain
 * describe/it, the pure fn, inline fixtures-as-arrays, no vi.mock, no Supabase, no
 * testing-library. The `unit` project's `node` env (vitest.config.ts) is the sanctioned
 * home for a pure-helper assertion like this.
 */
import { describe, expect, it } from 'vitest';

import { groupAllowedByCategory } from '@/components/templates/template-meta';

/** The picker's inline allowed shape (also a subset of the server `AllowedTemplate`). */
type Allowed = { slug: string; restricted: boolean; category: string };

const keys = (groups: { key: string }[]): string[] => groups.map((g) => g.key);

describe('groupAllowedByCategory (TCAT-02 — curated re-bucket + empty-category skip)', () => {
  // ≥1 dev, ≥1 creative, ZERO video — exactly the live mix (minimal/edgerunner-v2 = dev,
  // atelier = creative; no video template ships yet, so `video` must stay hidden).
  const fixture: Allowed[] = [
    { slug: 'minimal', restricted: false, category: 'dev' },
    { slug: 'edgerunner-v2', restricted: false, category: 'dev' },
    { slug: 'atelier', restricted: false, category: 'creative' },
  ];

  it('emits the populated dev + creative headers, each EXACTLY ONCE', () => {
    const groups = groupAllowedByCategory(fixture);
    const ks = keys(groups);
    expect(ks).toContain('dev');
    expect(ks).toContain('creative');
    expect(ks.filter((k) => k === 'dev')).toHaveLength(1);
    expect(ks.filter((k) => k === 'creative')).toHaveLength(1);
  });

  it('emits NO `video` group when zero allowed items carry that category (the skip → video stays hidden)', () => {
    const groups = groupAllowedByCategory(fixture);
    expect(keys(groups)).not.toContain('video');
  });

  it('emits NO group for ANY empty curated category (general/marketer also absent here)', () => {
    const groups = groupAllowedByCategory(fixture);
    const ks = keys(groups);
    expect(ks).not.toContain('general');
    expect(ks).not.toContain('marketer');
    // Only the two populated groups are present.
    expect(ks).toEqual(['dev', 'creative']);
  });

  it('lands each item under the group matching its OWN category (a creative item is NOT in the dev group)', () => {
    const groups = groupAllowedByCategory(fixture);
    const dev = groups.find((g) => g.key === 'dev');
    const creative = groups.find((g) => g.key === 'creative');
    expect(dev?.items.map((i) => i.slug)).toEqual(['minimal', 'edgerunner-v2']);
    expect(creative?.items.map((i) => i.slug)).toEqual(['atelier']);
    // The creative slug never leaks into the dev group.
    expect(dev?.items.map((i) => i.slug)).not.toContain('atelier');
  });

  it('preserves within-group input order (public-first-then-granted is the stable filter order)', () => {
    // Reverse the two dev items in the input — the group must preserve THAT order.
    const reordered: Allowed[] = [
      { slug: 'edgerunner-v2', restricted: false, category: 'dev' },
      { slug: 'atelier', restricted: false, category: 'creative' },
      { slug: 'minimal', restricted: true, category: 'dev' },
    ];
    const groups = groupAllowedByCategory(reordered);
    const dev = groups.find((g) => g.key === 'dev');
    expect(dev?.items.map((i) => i.slug)).toEqual(['edgerunner-v2', 'minimal']);
  });

  it('returns groups in the curated order (dev → creative → marketer → general → video)', () => {
    // A fixture spanning four categories proves the order follows `categoryGroups`,
    // not the input order.
    const spanning: Allowed[] = [
      { slug: 'aurora', restricted: false, category: 'marketer' },
      { slug: 'atelier', restricted: false, category: 'creative' },
      { slug: 'editorial', restricted: false, category: 'general' },
      { slug: 'minimal', restricted: false, category: 'dev' },
    ];
    expect(keys(groupAllowedByCategory(spanning))).toEqual([
      'dev',
      'creative',
      'marketer',
      'general',
    ]);
  });

  it('an empty input emits no groups at all', () => {
    expect(groupAllowedByCategory([])).toEqual([]);
  });

  // WR-02 (37-REVIEW): an allowed item whose category matches no curated key must NOT be
  // dropped — it is swept into `general`. Total items in === total items out.
  it('sweeps an unknown-category allowed item into `general` (no silent drop)', () => {
    const withUnknown: Allowed[] = [
      { slug: 'minimal', restricted: false, category: 'dev' },
      { slug: 'mystery', restricted: false, category: 'develper' }, // typo → orphan
    ];
    const groups = groupAllowedByCategory(withUnknown);
    const general = groups.find((g) => g.key === 'general');
    // The orphan lands in `general`...
    expect(general?.items.map((i) => i.slug)).toContain('mystery');
    // ...and is NOT dropped: total items across all groups === fixture length.
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(withUnknown.length);
  });

  it('appends an orphan AFTER `general`s native members (stable: natives first, then orphans)', () => {
    const mixed: Allowed[] = [
      { slug: 'editorial', restricted: false, category: 'general' }, // native general
      { slug: 'mystery', restricted: false, category: 'develper' }, // orphan
    ];
    const groups = groupAllowedByCategory(mixed);
    const general = groups.find((g) => g.key === 'general');
    expect(general?.items.map((i) => i.slug)).toEqual(['editorial', 'mystery']);
  });

  it('CREATES the `general` group when it has zero natives but ≥1 orphan, and still skips empty `video`', () => {
    const noNativeGeneral: Allowed[] = [
      { slug: 'minimal', restricted: false, category: 'dev' },
      { slug: 'mystery', restricted: false, category: 'develper' }, // orphan, no native general
    ];
    const groups = groupAllowedByCategory(noNativeGeneral);
    const ks = keys(groups);
    // `general` is created at its curated position purely to hold the orphan...
    expect(ks).toEqual(['dev', 'general']);
    expect(groups.find((g) => g.key === 'general')?.items.map((i) => i.slug)).toEqual([
      'mystery',
    ]);
    // ...and the empty-category skip still holds (no `video`).
    expect(ks).not.toContain('video');
  });
});
