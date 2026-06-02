/**
 * SAFE-04 — RED scaffold (Wave 0, Plan 06-01). GREENED BY 06-03-T1.
 *
 * Encodes the SAFE-04 noindex GATE PREDICATE (R-4) — the not-yet-existing
 * `isPublishReady(data)` exported from `@/lib/cms/completeness`. This is a SEPARATE
 * predicate from the advisory `deriveCompleteness` (D-P4-08): the advisory list
 * must NEVER block publish and includes "Add a contact email", which the gate does
 * NOT require (D-11 — the contact form exists so users need not expose an email).
 *
 * Pitfall 6 (load-bearing): the placeholder is the literal `[Your Name]` token in
 * `hero.heading`, NOT in `display_name` (signup sets display_name = username, so it
 * is always non-empty). A freshly-bootstrapped page must read as INCOMPLETE so a
 * placeholder page is never indexed.
 *
 * Gate predicate (R-4): ready ⇔
 *   - hero.heading does NOT contain `[Your Name]` (case-insensitive) AND display_name set;
 *   - about.bio non-empty;
 *   - ≥1 project item;
 *   - avatar_url set.
 *   Public email is NOT required (D-11).
 *
 * ── WHY RED (and tsc stays 0) ─────────────────────────────────────────────────
 * `@/lib/cms/completeness` EXISTS, but `isPublishReady` is not exported yet. We
 * import the module at RUNTIME through a variable specifier (the [05-01] idiom) and
 * read the export off the namespace, so there is no STATIC reference for `tsc` to
 * fail on (no TS2305 "no exported member"). At runtime `mod.isPublishReady` is
 * `undefined` until the slice adds it — the `typeof === 'function'` guard makes
 * every case genuinely RED now and GREEN once the export lands.
 */
import { describe, expect, it } from 'vitest';

const MOD = '@/lib/cms/completeness';

type GateInput = {
  displayName?: string | null;
  avatarUrl?: string | null;
  sections: { type: string; content: unknown }[];
};

async function loadIsPublishReady(): Promise<(data: GateInput) => boolean> {
  const mod = (await import(/* @vite-ignore */ MOD)) as {
    isPublishReady?: (data: GateInput) => boolean;
  };
  // RED until 06-03-T1 adds the export: undefined !== 'function'.
  expect(typeof mod.isPublishReady).toBe('function');
  return mod.isPublishReady as (data: GateInput) => boolean;
}

/** A freshly-bootstrapped page: the [Your Name] hero token, empty about/projects. */
const bootstrapped: GateInput = {
  displayName: 'ada', // signup sets display_name = username (Pitfall 6)
  avatarUrl: null,
  sections: [
    { type: 'hero', content: { heading: "Hi, I'm [Your Name]" } },
    { type: 'about', content: { bio: '' } },
    { type: 'projects', content: { items: [] } },
  ],
};

/** A fully-filled page: real name, about written, ≥1 project, avatar set. */
const complete: GateInput = {
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

describe('SAFE-04 — isPublishReady gate predicate (R-4)', () => {
  it('returns FALSE for a freshly-bootstrapped page (hero still has [Your Name])', async () => {
    const isPublishReady = await loadIsPublishReady();
    expect(isPublishReady(bootstrapped)).toBe(false);
  });

  it('returns TRUE for a fully-filled page (name changed + about + ≥1 project + avatar)', async () => {
    const isPublishReady = await loadIsPublishReady();
    expect(isPublishReady(complete)).toBe(true);
  });

  it('does NOT require a public contact email (D-11)', async () => {
    const isPublishReady = await loadIsPublishReady();
    // `complete` carries no contact section / email_public at all, yet is ready.
    expect(isPublishReady(complete)).toBe(true);
  });

  it('returns FALSE when the avatar is missing even if everything else is filled', async () => {
    const isPublishReady = await loadIsPublishReady();
    expect(isPublishReady({ ...complete, avatarUrl: null })).toBe(false);
  });
});
