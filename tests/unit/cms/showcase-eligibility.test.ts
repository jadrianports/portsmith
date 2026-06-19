/**
 * SHOW-03 — the gallery eligibility filter: `isPublishReady()` keeps a thin /
 * placeholder opted-in page OUT of the Explore list (Wave-0 Nyquist anchor,
 * Plan 31-01).
 *
 * D-08 (correct-by-construction drop-out): showcase eligibility is computed at
 * gallery RENDER time, never snapshotted. The view filters opt-in + published +
 * non-locked (SQL); `/explore` then reconstructs each candidate's
 * `CompletenessInput` from the public views and runs `isPublishReady()` in JS to
 * drop pages that are technically published but still thin/placeholder. THIS test
 * pins that JS predicate over the reconstructed shape.
 *
 * Unlike the RED integration/view tests in this plan, this is a PURE unit test
 * (no DB, no migration) and `isPublishReady` ALREADY exists
 * (`src/lib/cms/completeness.ts`, shipped Phase 06 / SAFE-04). It therefore passes
 * NOW — the earliest-GREEN Nyquist anchor for SHOW-03, validating the exact
 * predicate the `/explore` route (Plan 31-05) will call.
 *
 * Predicate (R-4, reused verbatim): ready ⇔ hero.heading does NOT contain
 * `[your name]` (case-insensitive) AND displayName set AND about.bio non-empty
 * AND ≥1 project item AND avatarUrl set. Public email is NOT required (D-11).
 */
import { describe, expect, it } from 'vitest';

import { isPublishReady, type CompletenessInput } from '@/lib/cms/completeness';

/**
 * A complete, publish-ready candidate — the shape `/explore` reconstructs from
 * `public_showcase_profiles` (displayName/avatarUrl) + `public_sections`
 * (hero/about/projects content) for an opted-in published profile.
 */
const ready: CompletenessInput = {
  displayName: 'Ada Lovelace',
  avatarUrl: 'https://cdn.example/avatar.webp',
  sections: [
    { type: 'hero', content: { heading: "Hi, I'm Ada Lovelace" } },
    { type: 'about', content: { bio: 'I build analytical engines.' } },
    {
      type: 'projects',
      content: { items: [{ id: '1', title: 'Engine', description: 'A machine.' }] },
    },
  ],
};

/** A thin/placeholder candidate: still the bootstrap hero token, no bio, no project. */
const thin: CompletenessInput = {
  displayName: 'ada', // signup sets display_name = username — never the gate (Pitfall 6)
  avatarUrl: null,
  sections: [
    { type: 'hero', content: { heading: "Hi, I'm [Your Name]" } },
    { type: 'about', content: { bio: '' } },
    { type: 'projects', content: { items: [] } },
  ],
};

describe('SHOW-03 — isPublishReady is the /explore gallery eligibility filter (D-08)', () => {
  it('a complete opted-in page PASSES the filter (stays in the gallery)', () => {
    expect(isPublishReady(ready)).toBe(true);
  });

  it('a thin/placeholder opted-in page is FILTERED OUT (returns false)', () => {
    expect(isPublishReady(thin)).toBe(false);
  });

  it('a page with only the placeholder hero token left is filtered OUT', () => {
    // Everything else complete, but hero.heading still carries `[your name]`.
    const placeholderHero: CompletenessInput = {
      ...ready,
      sections: [
        { type: 'hero', content: { heading: 'welcome to [your name]’s page' } },
        { type: 'about', content: { bio: 'A real bio.' } },
        { type: 'projects', content: { items: [{ id: '1', title: 'A' }] } },
      ],
    };
    expect(isPublishReady(placeholderHero)).toBe(false);
  });

  it('a page missing an avatar is filtered OUT even if everything else is filled', () => {
    expect(isPublishReady({ ...ready, avatarUrl: null })).toBe(false);
  });

  it('a page with no project items is filtered OUT', () => {
    const noProjects: CompletenessInput = {
      ...ready,
      sections: [
        { type: 'hero', content: { heading: "Hi, I'm Ada Lovelace" } },
        { type: 'about', content: { bio: 'I build analytical engines.' } },
        { type: 'projects', content: { items: [] } },
      ],
    };
    expect(isPublishReady(noProjects)).toBe(false);
  });

  it('does NOT require a public contact email (D-11) — ready page has no contact section', () => {
    // `ready` carries no contact section / email_public at all, yet is eligible.
    expect(isPublishReady(ready)).toBe(true);
  });
});
