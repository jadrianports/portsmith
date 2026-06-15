/**
 * Plan 23-01 / D-15 — the per-template demo fixtures each render FULLY.
 *
 * The Lighthouse-CI run (LAUNCH-02) and the production public smoke (LAUNCH-08) need a
 * published, fully-rendering portfolio PER live template. A portfolio renders fully
 * (and is indexable) only when it passes `isPublishReady` (the SAFE-04 gate —
 * `src/lib/cms/completeness.ts`): a real hero name, a non-empty about bio, ≥1 project,
 * and a non-empty avatar. If a demo fixture FAILED that gate the page would be
 * thin/noindex and the LHCI + smoke fixtures would be meaningless — so this test is the
 * guard that keeps the two new dev-flavored demos (minimal + editorial) publish-ready.
 *
 * It tests ONLY the committed fixtures + the PURE `isPublishReady` predicate. It does
 * NOT import the seed scripts (`seed-minimal-demo.ts` / `seed-editorial-demo.ts`) —
 * those run a service-role client against a live DB; importing them here would attempt
 * I/O. The seed and the CMS write the SAME shape this fixture is typed against
 * (SHARED-C), so validating the fixture validates what gets seeded.
 *
 * The negative-guard case proves the test is actually exercising the name gate (not
 * trivially passing): re-inserting the literal `[Your Name]` token into hero.heading
 * must flip `isPublishReady` to false.
 */
import { describe, expect, it } from 'vitest';

import { isPublishReady, type CompletenessInput } from '@/lib/cms/completeness';

import { MINIMAL_DEMO } from '../../../scripts/seed/minimal-content.example';
import { EDITORIAL_DEMO } from '../../../scripts/seed/editorial-content.example';

/**
 * Map a demo fixture into the `CompletenessInput` shape `isPublishReady` reads —
 * exactly the columns the seed writes (the profile `display_name`/`avatar_url` plus
 * each section's `{ type, content }`). This is the same transform the editor's loaded
 * rows produce, so passing here means the seeded, published page passes the live gate.
 */
function toCompletenessInput(fixture: {
  profile: { display_name: string; avatar_url: string };
  sections: Record<string, unknown>;
}): CompletenessInput {
  return {
    displayName: fixture.profile.display_name,
    avatarUrl: fixture.profile.avatar_url,
    sections: Object.entries(fixture.sections).map(([type, content]) => ({
      type,
      content,
    })),
  };
}

describe('D-15 — per-template demo fixtures pass isPublishReady (render fully)', () => {
  it('the minimal demo (Devon Park) is publish-ready', () => {
    expect(isPublishReady(toCompletenessInput(MINIMAL_DEMO))).toBe(true);
  });

  it('the editorial demo (Lena Voss) is publish-ready', () => {
    expect(isPublishReady(toCompletenessInput(EDITORIAL_DEMO))).toBe(true);
  });

  it('NEGATIVE GUARD — re-inserting "[Your Name]" into hero.heading makes it NOT ready', () => {
    const input = toCompletenessInput(MINIMAL_DEMO);
    // Mutate a copy of the hero section's content so the real fixture is untouched.
    const mutated: CompletenessInput = {
      ...input,
      sections: input.sections.map((s) =>
        s.type === 'hero'
          ? { type: 'hero', content: { ...(s.content as object), heading: "Hi, I'm [Your Name]" } }
          : s,
      ),
    };
    expect(isPublishReady(mutated)).toBe(false);
  });
});
