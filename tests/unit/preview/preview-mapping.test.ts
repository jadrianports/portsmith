/**
 * EDIT-02 / D-06 — the pure section-type/region → `activeSectionId` resolver guard
 * (Phase 27, Wave 0).
 *
 * Proves `resolvePreviewTarget` routes the three Pattern-4 buckets correctly while staying
 * zero-knowledge of editor state (it never invents a UUID — it delegates real-type
 * resolution to the injected `resolveRowId`, exactly the editor's `resolveSectionId`):
 *
 *   1. the footer/contact region tag (`CONTACT_PANEL_ID`) → the Contact & Socials sentinel
 *      WITHOUT consulting `resolveRowId` (the footer is not a `data-section-type` section);
 *   2. a real section type → the row UUID the editor's resolver returns (no UUID crosses
 *      the bridge boundary; the editor owns the map);
 *   3. a type with no loaded section row → `null` (the editor no-ops the click — matches
 *      the completeness-checklist null-no-op).
 *
 * Plus the D-05/A4 carve-out: `blog_preview` flows through the REAL-type branch (its own
 * row UUID), NOT the `__blog__` rail sentinel.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  resolvePreviewTarget,
  CONTACT_PANEL_ID,
  BLOG_PANEL_ID,
} from '@/lib/preview/resolve-section-id';

/** A fake editor resolver: a fixed type→UUID map, returning null for anything absent. */
function makeResolver(map: Record<string, string>) {
  return vi.fn((type: string): string | null => map[type] ?? null);
}

describe('EDIT-02 / D-06 — resolvePreviewTarget', () => {
  it('routes the footer/contact region tag straight to the Contact & Socials sentinel', () => {
    const resolveRowId = makeResolver({});
    expect(resolvePreviewTarget(CONTACT_PANEL_ID, resolveRowId)).toBe(CONTACT_PANEL_ID);
    // The region tag short-circuits — the editor's row resolver is NEVER consulted for it
    // (the footer carries no `data-section-type`, so there is no row to resolve).
    expect(resolveRowId).not.toHaveBeenCalled();
  });

  it('delegates a real section type to the injected resolver and returns its row UUID', () => {
    const HERO_UUID = '11111111-1111-4111-8111-111111111111';
    const resolveRowId = makeResolver({ hero: HERO_UUID });
    expect(resolvePreviewTarget('hero', resolveRowId)).toBe(HERO_UUID);
    expect(resolveRowId).toHaveBeenCalledWith('hero');
  });

  it('returns null (no-op) when the clicked type has no loaded section row', () => {
    const resolveRowId = makeResolver({}); // nothing loaded
    expect(resolvePreviewTarget('projects', resolveRowId)).toBeNull();
    expect(resolveRowId).toHaveBeenCalledWith('projects');
  });

  it('routes a blog_preview SECTION click to its row UUID, NOT the __blog__ rail sentinel (A4)', () => {
    const BLOG_PREVIEW_UUID = '22222222-2222-4222-8222-222222222222';
    const resolveRowId = makeResolver({ blog_preview: BLOG_PREVIEW_UUID });
    const target = resolvePreviewTarget('blog_preview', resolveRowId);
    expect(target).toBe(BLOG_PREVIEW_UUID);
    expect(target).not.toBe(BLOG_PANEL_ID);
  });

  it('resolves every real section type through the row-resolver branch (no hidden mapping)', () => {
    const REAL_TYPES = [
      'hero',
      'about',
      'projects',
      'experience',
      'skills',
      'testimonials',
      'education',
      'metrics',
      'services',
      'moodboard',
      'certifications',
      'contact',
    ];
    const map: Record<string, string> = {};
    REAL_TYPES.forEach((t, i) => {
      map[t] = `00000000-0000-4000-8000-0000000000${(i + 10).toString().padStart(2, '0')}`;
    });
    const resolveRowId = makeResolver(map);
    for (const t of REAL_TYPES) {
      expect(resolvePreviewTarget(t, resolveRowId)).toBe(map[t]);
    }
  });
});
