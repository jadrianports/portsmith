// ONB-01 — turned GREEN by 04-04 (data-derived completeness checklist).
//
// Wave-0 RED scaffold (04-01). INTENTIONALLY failing: imports the not-yet-built
// pure `deriveCompleteness` helper so the import fails to resolve until 04-04
// ships it. RED is the contract (Nyquist sampling, 04-VALIDATION.md). Do NOT
// implement the helper here — 04-04 turns this GREEN.
//
// Behavior under test (pure derivation over already-fetched rows, NO new table):
//   For a fixture with name + about set but NO project / contact email / avatar,
//   deriveCompleteness returns the correct done/todo booleans (mixed state).
//   It is ADVISORY only — it never blocks publishing (D-P4-08).
import { describe, expect, it } from 'vitest';

import { deriveCompleteness } from '@/lib/cms/completeness';

const boolsById = (data: Parameters<typeof deriveCompleteness>[0]) =>
  Object.fromEntries(
    deriveCompleteness(data).map((i: { id: string; done: boolean }) => [i.id, i.done]),
  );

// Mixed-state fixture: name + about present; project / contact / avatar absent.
const mixed = {
  displayName: 'Jane Doe',
  avatarUrl: null,
  sections: [
    { type: 'about', content: { bio: 'A short bio about me.', skills: [] } },
    { type: 'projects', content: { heading: 'Work', items: [] } },
    { type: 'contact', content: { heading: 'Contact', email_public: '' } },
  ],
};

// All-done fixture: every predicate satisfied.
const allDone = {
  displayName: 'Jane Doe',
  avatarUrl: 'https://example.com/me.webp',
  sections: [
    { type: 'about', content: { bio: 'A short bio about me.', skills: [] } },
    {
      type: 'projects',
      content: { heading: 'Work', items: [{ id: 'p1', slug: 'a', title: 'A' }] },
    },
    { type: 'contact', content: { heading: 'Contact', email_public: 'me@example.com' } },
  ],
};

// None-done fixture: empty/whitespace name + empty rows + no avatar.
const noneDone = {
  displayName: '   ',
  avatarUrl: '',
  sections: [
    { type: 'about', content: { bio: '   ', skills: [] } },
    { type: 'projects', content: { heading: 'Work', items: [] } },
    { type: 'contact', content: { heading: 'Contact', email_public: '' } },
  ],
};

describe('ONB-01 — deriveCompleteness done/todo derivation (advisory)', () => {
  it('mixed: name + about done; project / contact / avatar todo', () => {
    const byId = boolsById(mixed);
    expect(byId.name).toBe(true);
    expect(byId.about).toBe(true);
    expect(byId.project).toBe(false);
    expect(byId.contact).toBe(false);
    expect(byId.avatar).toBe(false);
  });

  it('all-done: every item done', () => {
    const byId = boolsById(allDone);
    expect(Object.values(byId).every(Boolean)).toBe(true);
  });

  it('none-done: every item todo (whitespace-only values do not count)', () => {
    const byId = boolsById(noneDone);
    expect(Object.values(byId).some(Boolean)).toBe(false);
  });

  it('returns an advisory list only — no blocking/disable signal', () => {
    const items = deriveCompleteness(mixed);
    // Each item is exactly { id, label, done, sectionType? } — no "blocked"
    // / "disabled" flag exists for the caller to gate Publish on (D-P4-08).
    for (const item of items) {
      expect(item).not.toHaveProperty('blocked');
      expect(item).not.toHaveProperty('disabled');
      expect(typeof item.done).toBe('boolean');
    }
  });
});

/**
 * 13.1-01 (Wave 0, Nyquist) — D-17 TEMPLATE-AWARE delta (RED until Plan 13.1-03
 * extends `deriveCompleteness` to accept the active template's supported types).
 *
 * D-17: the checklist becomes template-aware — it only evaluates sections the active
 * template RENDERS, so a user on `minimal` is never told they're "incomplete" for an
 * empty section the template can't show. The new arg is the set of supported section
 * types; section-typed checklist items for an UNSUPPORTED type are dropped.
 *
 * Backward-compatible contract: the supported-types arg is OPTIONAL — every PRE-
 * EXISTING single-arg call above stays valid + green (when omitted, the full advisory
 * list is returned, exactly today's behavior). These NEW cases pass the second arg and
 * assert the template-aware filtering; they are RED on today's tree (the arg is ignored
 * / does not exist) and GREEN once Plan 13.1-03 wires it.
 *
 * NOTE: this NEVER touches `isPublishReady` — that is the SEPARATE SAFE-04 gate (its
 * contract is unchanged; D-17 is the advisory list only).
 */
describe('D-17 — deriveCompleteness is template-aware (only evaluates rendered types)', () => {
  it('omits a section-typed item whose type the active template does NOT support', () => {
    // The active template supports about + projects but NOT contact (e.g. a template
    // that renders no contact section). The `contact` advisory item must be DROPPED —
    // the user is never nagged to fill a section their template can't show.
    const supported = ['about', 'projects'];
    const items = deriveCompleteness(mixed, supported);
    const ids = items.map((i) => i.id);

    // RED until Plan 13.1-03: today `contact` is ALWAYS emitted (the arg is ignored).
    expect(ids).not.toContain('contact');
    // Supported section-typed items + the profile-level items (name/avatar) remain.
    expect(ids).toContain('about');
    expect(ids).toContain('project');
    expect(ids).toContain('name');
    expect(ids).toContain('avatar');
  });

  it('keeps every section-typed item when its type IS in the supported set', () => {
    const supported = ['about', 'projects', 'contact'];
    const ids = deriveCompleteness(mixed, supported).map((i) => i.id);
    expect(ids).toContain('about');
    expect(ids).toContain('project');
    expect(ids).toContain('contact');
  });

  it('profile-level items (name, avatar) are template-INDEPENDENT — never dropped', () => {
    // name/avatar carry no sectionType (they are profile fields), so the support
    // filter never removes them regardless of the supported set.
    const ids = deriveCompleteness(mixed, []).map((i) => i.id);
    expect(ids).toContain('name');
    expect(ids).toContain('avatar');
  });
});
