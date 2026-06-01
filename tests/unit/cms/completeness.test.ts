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

// @ts-expect-error — RED: 04-04 creates this pure helper; module does not exist yet.
import { deriveCompleteness } from '@/lib/cms/completeness';

// Mixed-state fixture: name + about present; project / contact / avatar absent.
const fixture = {
  displayName: 'Jane Doe',
  avatarUrl: null,
  sections: [
    { type: 'about', content: { bio: 'A short bio about me.', skills: [] } },
    { type: 'projects', content: { heading: 'Work', items: [] } },
    { type: 'contact', content: { heading: 'Contact', email_public: '' } },
  ],
};

describe('ONB-01 — deriveCompleteness done/todo for a mixed-state fixture', () => {
  it('returns a checklist with the expected done/todo booleans', () => {
    const items = deriveCompleteness(fixture);
    const byId = Object.fromEntries(
      items.map((i: { id: string; done: boolean }) => [i.id, i.done]),
    );

    // DONE: name + about are present.
    expect(byId.name).toBe(true);
    expect(byId.about).toBe(true);

    // TODO: no project items, no public contact email, no avatar.
    expect(byId.project).toBe(false);
    expect(byId.contact).toBe(false);
    expect(byId.avatar).toBe(false);
  });
});
