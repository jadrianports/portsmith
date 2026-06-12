// ONB-03 / ONB-05 — the placeholder-aware resume predicate (D-03).
//
// Wave-0 TDD RED scaffold (18-02, Task 2). INTENTIONALLY failing first: imports the
// not-yet-built pure `deriveOnboardingStep` so the import fails to resolve until the
// GREEN step ships it. RED is the contract.
//
// Behavior under test (pure derivation over the already-loaded owner read — NO DB,
// NO Supabase client, NO RPC; mirrors completeness.test.ts: node env, no DOM):
//   - Seeded-only state  → resume = 'hero'    (the first not-done step; Template
//                          is always done once a portfolio exists).
//   - Edited hero, rest seeded → resume advances past Hero to 'about'.
//   - All steps edited but published=false → resume = 'publish' (terminal step,
//                          the last not-done step).
//   - published=true     → resume = 'publish' (the step-6 done predicate is
//                          published===true; the whole chain reads done → Publish).
//   - Avatar is a SOFT NUDGE, not a Hero resume gate (Open-Q2): a hero with an
//     edited heading + display_name but NO avatar still advances past Hero.
//
// Fixtures are built FROM `ONBOARDING_SEED` so the seeded-vs-edited comparison is
// byte-exact (the single-source-of-truth contract — never hardcode the seed twice).
import { describe, expect, it } from 'vitest';

import { ONBOARDING_SEED } from '@/lib/cms/onboarding-seed';
import {
  deriveOnboardingStep,
  type OnboardingStepInput,
} from '@/lib/cms/onboarding-step';

/**
 * A freshly-bootstrapped, untouched portfolio (migration 006/008 seed). Every
 * seeded field holds its EXACT seed value, contact.email_public is absent (never
 * seeded), display_name is the username (set at signup — always non-empty),
 * avatar is unset, and published is false.
 */
function seededOnly(): OnboardingStepInput {
  return {
    displayName: 'janedoe', // signup sets display_name to the username (non-empty).
    avatarUrl: null, // never seeded.
    published: false,
    sections: [
      {
        type: 'hero',
        content: {
          heading: `Hi, I'm ${ONBOARDING_SEED.HERO_NAME_TOKEN}`,
          subheading: 'I build things for the web',
        },
      },
      {
        type: 'about',
        content: {
          bio: ONBOARDING_SEED.ABOUT_BIO,
          skills: ['JavaScript', 'React', 'Node.js', 'Your Skill'],
        },
      },
      {
        type: 'projects',
        content: {
          heading: 'Projects',
          items: [
            { id: 'placeholder-1', title: ONBOARDING_SEED.PROJECT_TITLES[0] },
            { id: 'placeholder-2', title: ONBOARDING_SEED.PROJECT_TITLES[1] },
          ],
        },
      },
      {
        type: 'contact',
        content: { heading: 'Get in Touch', subheading: 'Send me a message.' },
      },
    ],
  };
}

describe('ONB-03 — deriveOnboardingStep placeholder-aware resume predicate', () => {
  it('seeded-only portfolio resolves to Hero (the placeholder false-positive trap is avoided)', () => {
    // Template is always done (portfolio exists); Hero is the FIRST not-done step
    // because the heading still holds the [Your Name] token. A naive "non-empty"
    // check would false-positive Hero/About/Projects to done — it must NOT.
    expect(deriveOnboardingStep(seededOnly())).toBe('hero');
  });

  it('an edited hero advances the resume step past Hero to About', () => {
    const input = seededOnly();
    const hero = input.sections.find((s) => s.type === 'hero')!;
    // User edited the heading (no longer holds the [Your Name] token) — Hero done.
    (hero.content as Record<string, unknown>).heading = "Hi, I'm Jane Doe";
    // display_name remains non-empty; avatar still unset (soft nudge, not a gate).
    expect(deriveOnboardingStep(input)).toBe('about');
  });

  it('Hero is done WITHOUT an avatar (avatar is a soft nudge, not a resume gate)', () => {
    const input = seededOnly();
    const hero = input.sections.find((s) => s.type === 'hero')!;
    (hero.content as Record<string, unknown>).heading = "Hi, I'm Jane Doe";
    input.avatarUrl = null; // explicitly no avatar.
    // Resume advances PAST Hero — a skipped photo must not yo-yo the user back.
    expect(deriveOnboardingStep(input)).not.toBe('hero');
    expect(deriveOnboardingStep(input)).toBe('about');
  });

  it('all steps edited but unpublished resolves to the terminal Publish step', () => {
    const input = seededOnly();
    const hero = input.sections.find((s) => s.type === 'hero')!;
    const about = input.sections.find((s) => s.type === 'about')!;
    const projects = input.sections.find((s) => s.type === 'projects')!;
    const contact = input.sections.find((s) => s.type === 'contact')!;
    (hero.content as Record<string, unknown>).heading = "Hi, I'm Jane Doe";
    (about.content as Record<string, unknown>).bio = 'My own real bio about my work.';
    (projects.content as Record<string, unknown>).items = [
      { id: 'real-1', title: 'A Real Shipped Project' },
    ];
    (contact.content as Record<string, unknown>).email_public = 'jane@example.com';
    input.published = false;
    expect(deriveOnboardingStep(input)).toBe('publish');
  });

  it('published=true short-circuits to Publish (terminal done)', () => {
    const input = seededOnly();
    input.published = true; // even with otherwise-seeded content, published is terminal.
    expect(deriveOnboardingStep(input)).toBe('publish');
  });

  it('About is the resume target once Hero is edited but the bio is still the seed', () => {
    const input = seededOnly();
    const hero = input.sections.find((s) => s.type === 'hero')!;
    (hero.content as Record<string, unknown>).heading = "Hi, I'm Jane Doe";
    // bio still === ONBOARDING_SEED.ABOUT_BIO → About not done.
    expect(deriveOnboardingStep(input)).toBe('about');
  });

  it('Projects is the resume target once Hero + About are edited but the project titles are still the two seeds', () => {
    const input = seededOnly();
    const hero = input.sections.find((s) => s.type === 'hero')!;
    const about = input.sections.find((s) => s.type === 'about')!;
    (hero.content as Record<string, unknown>).heading = "Hi, I'm Jane Doe";
    (about.content as Record<string, unknown>).bio = 'My own real bio.';
    // Both project titles are still the seed titles → Projects not done.
    expect(deriveOnboardingStep(input)).toBe('projects');
  });

  it('Contact is the resume target once Hero + About + Projects are edited but email_public is empty', () => {
    const input = seededOnly();
    const hero = input.sections.find((s) => s.type === 'hero')!;
    const about = input.sections.find((s) => s.type === 'about')!;
    const projects = input.sections.find((s) => s.type === 'projects')!;
    (hero.content as Record<string, unknown>).heading = "Hi, I'm Jane Doe";
    (about.content as Record<string, unknown>).bio = 'My own real bio.';
    (projects.content as Record<string, unknown>).items = [
      { id: 'real-1', title: 'A Real Shipped Project' },
    ];
    // contact.email_public never set → Contact not done.
    expect(deriveOnboardingStep(input)).toBe('contact');
  });
});
