/**
 * Unit coverage for every platform Zod schema (FND-04 / CMS-08).
 *
 * For each schema: a valid-input parse, an explicit rejection per documented
 * constraint, and — where images are involved — the alt-text refine in BOTH the
 * failing (image without alt) and passing (both / neither) directions.
 *
 * `validateSectionContent` is covered for a valid type, an invalid-content case,
 * and an unregistered type.
 *
 * All imports go through the barrel (`src/lib/validations/index.ts`) to prove the
 * single import surface (key_link in 01-03-PLAN.md).
 */
import { describe, expect, it } from 'vitest';

import {
  // sections
  sectionContentSchemas,
  validateSectionContent,
  projectItemSchema,
  testimonialItemSchema,
  experienceItemSchema,
  heroContentSchema,
  aboutContentSchema,
  projectsContentSchema,
  testimonialsContentSchema,
  experienceContentSchema,
  contactContentSchema,
  blogPreviewContentSchema,
  skillsContentSchema,
  // 5 marketer-vertical content schemas (11-04 Step C1)
  educationContentSchema,
  metricsContentSchema,
  servicesContentSchema,
  moodboardContentSchema,
  certificationsContentSchema,
  // profile / username
  profileSchema,
  usernameSchema,
  RESERVED_USERNAMES,
  // settings
  settingsSchema,
  // contact
  contactFormSchema,
  // blog
  blogSchema,
  // auth (signup / login / reset / update-password — server-boundary gate)
  signupSchema,
  loginSchema,
  resetRequestSchema,
  updatePasswordSchema,
} from '@/lib/validations';

// ===========================================================================
// Fixtures
// ===========================================================================

const validProjectItem = {
  id: 'V1StGXR8_Z5jdHi6B-myT',
  slug: 'my-project',
  title: 'My Project',
  description: 'A thing I built.',
  tech_stack: ['ts', 'next'],
};

const validTestimonialItem = {
  id: 'abc123',
  name: 'Jane Reviewer',
  quote: 'Excellent work.',
  stars: 5,
};

const validExperienceItem = {
  id: 'exp1',
  company: 'Acme',
  role: 'Engineer',
  start_date: '2020-01',
  end_date: 'present',
  description: 'Built things.',
};

// ===========================================================================
// Section item schemas
// ===========================================================================

describe('section item schemas', () => {
  it('projectItemSchema accepts a valid item', () => {
    expect(projectItemSchema.safeParse(validProjectItem).success).toBe(true);
  });

  it('projectItemSchema rejects a title > 100 chars', () => {
    const bad = { ...validProjectItem, title: 'x'.repeat(101) };
    expect(projectItemSchema.safeParse(bad).success).toBe(false);
  });

  it('projectItemSchema rejects a description > 1000 chars', () => {
    const bad = { ...validProjectItem, description: 'x'.repeat(1001) };
    expect(projectItemSchema.safeParse(bad).success).toBe(false);
  });

  it('projectItemSchema rejects tech_stack with > 10 items', () => {
    const bad = { ...validProjectItem, tech_stack: Array(11).fill('x') };
    expect(projectItemSchema.safeParse(bad).success).toBe(false);
  });

  it('projectItemSchema rejects a non-URL live_url', () => {
    const bad = { ...validProjectItem, live_url: 'not a url' };
    expect(projectItemSchema.safeParse(bad).success).toBe(false);
  });

  it('projectItemSchema accepts empty string and a valid URL for live_url', () => {
    expect(projectItemSchema.safeParse({ ...validProjectItem, live_url: '' }).success).toBe(true);
    expect(
      projectItemSchema.safeParse({ ...validProjectItem, live_url: 'https://x.com' }).success,
    ).toBe(true);
  });

  // --- alt-text refine: project item ---
  it('projectItemSchema FAILS when image is present but image_alt is empty (alt refine)', () => {
    const bad = { ...validProjectItem, image: 'https://x.com/a.png', image_alt: '' };
    const res = projectItemSchema.safeParse(bad);
    expect(res.success).toBe(false);
    expect(res.success === false && res.error.issues.some((i) => i.path.includes('image_alt'))).toBe(
      true,
    );
  });

  it('projectItemSchema FAILS when image is present but image_alt is missing (alt refine)', () => {
    const bad = { ...validProjectItem, image: 'https://x.com/a.png' };
    expect(projectItemSchema.safeParse(bad).success).toBe(false);
  });

  it('projectItemSchema PASSES when both image and image_alt are present (alt refine)', () => {
    const ok = { ...validProjectItem, image: 'https://x.com/a.png', image_alt: 'a screenshot' };
    expect(projectItemSchema.safeParse(ok).success).toBe(true);
  });

  it('projectItemSchema PASSES when neither image nor image_alt is present (alt refine)', () => {
    expect(projectItemSchema.safeParse(validProjectItem).success).toBe(true);
  });

  it('testimonialItemSchema accepts a valid item', () => {
    expect(testimonialItemSchema.safeParse(validTestimonialItem).success).toBe(true);
  });

  it('testimonialItemSchema rejects stars outside 1-5', () => {
    expect(testimonialItemSchema.safeParse({ ...validTestimonialItem, stars: 0 }).success).toBe(
      false,
    );
    expect(testimonialItemSchema.safeParse({ ...validTestimonialItem, stars: 6 }).success).toBe(
      false,
    );
  });

  it('testimonialItemSchema rejects non-integer stars', () => {
    expect(testimonialItemSchema.safeParse({ ...validTestimonialItem, stars: 4.5 }).success).toBe(
      false,
    );
  });

  // --- alt-text refine: testimonial item ---
  it('testimonialItemSchema FAILS when avatar is present but avatar_alt is empty (alt refine)', () => {
    const bad = { ...validTestimonialItem, avatar: 'https://x.com/a.png', avatar_alt: '' };
    const res = testimonialItemSchema.safeParse(bad);
    expect(res.success).toBe(false);
    expect(
      res.success === false && res.error.issues.some((i) => i.path.includes('avatar_alt')),
    ).toBe(true);
  });

  it('testimonialItemSchema PASSES with both avatar and avatar_alt (alt refine)', () => {
    const ok = { ...validTestimonialItem, avatar: 'https://x.com/a.png', avatar_alt: 'face' };
    expect(testimonialItemSchema.safeParse(ok).success).toBe(true);
  });

  it('testimonialItemSchema PASSES with neither avatar nor avatar_alt (alt refine)', () => {
    expect(testimonialItemSchema.safeParse(validTestimonialItem).success).toBe(true);
  });

  it('experienceItemSchema accepts a valid item', () => {
    expect(experienceItemSchema.safeParse(validExperienceItem).success).toBe(true);
  });

  it('experienceItemSchema accepts an empty end_date', () => {
    expect(
      experienceItemSchema.safeParse({ ...validExperienceItem, end_date: '' }).success,
    ).toBe(true);
  });

  it('experienceItemSchema rejects a non-YYYY-MM start_date', () => {
    expect(
      experienceItemSchema.safeParse({ ...validExperienceItem, start_date: '2020' }).success,
    ).toBe(false);
  });

  it('experienceItemSchema rejects a description > 1000 chars', () => {
    const bad = { ...validExperienceItem, description: 'x'.repeat(1001) };
    expect(experienceItemSchema.safeParse(bad).success).toBe(false);
  });
});

// ===========================================================================
// Section content schemas (the 7 soft-enum branches)
// ===========================================================================

describe('section content schemas', () => {
  it('registry has all 15 known section types (8 base + 5 marketer-vertical + 2 creative, 35-01)', () => {
    expect(Object.keys(sectionContentSchemas).sort()).toEqual(
      [
        // 8 base types
        'about',
        'blog_preview',
        'contact',
        'experience',
        'hero',
        'projects',
        'skills',
        'testimonials',
        // 5 marketer-vertical types (11-04 Step C1) — additive, no Postgres migration (CMS-08)
        'certifications',
        'education',
        'metrics',
        'moodboard',
        'services',
        // 2 creative-vertical types (35-01, GAL-01/GAL-02) — additive, no Postgres migration (CMS-08)
        'case_study',
        'gallery',
      ].sort(),
    );
  });

  it('hero accepts valid content and rejects a heading > 100 chars', () => {
    expect(heroContentSchema.safeParse({ heading: 'Hi' }).success).toBe(true);
    expect(heroContentSchema.safeParse({ heading: 'x'.repeat(101) }).success).toBe(false);
  });

  // --- WR-01: hero carries an OPTIONAL, http(s)-validated resume_url ---
  it('hero accepts an optional http(s) resume_url, empty, or omitted; rejects a bad scheme (WR-01 + CR-01)', () => {
    // Omitted ⇒ valid (optional/additive — the button hides).
    expect(heroContentSchema.safeParse({ heading: 'Hi' }).success).toBe(true);
    // Empty string ⇒ valid (button hides).
    expect(heroContentSchema.safeParse({ heading: 'Hi', resume_url: '' }).success).toBe(true);
    // A valid https URL ⇒ valid (the seed surfaces profile.resume_url here; D-14 button renders).
    expect(
      heroContentSchema.safeParse({ heading: 'Hi', resume_url: 'https://x.com/cv.pdf' }).success,
    ).toBe(true);
    // A dangerous scheme ⇒ rejected by the CR-01 gate (resume_url feeds an href).
    expect(
      heroContentSchema.safeParse({ heading: 'Hi', resume_url: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });

  // --- CR-01: the shared URL gate must REJECT dangerous schemes on every URL field ---
  it('CR-01: URL fields REJECT javascript:/data:/vbscript: and ACCEPT https (stored-XSS gate)', () => {
    const DANGEROUS = [
      'javascript:alert(1)',
      'JavaScript:alert(1)', // case-insensitive scheme
      'data:text/html;base64,PHNjcmlwdD4=',
      'vbscript:msgbox(1)',
      'ftp://example.com/x', // non-http(s) scheme also rejected
    ];
    for (const bad of DANGEROUS) {
      // cta_url (hero), live_url (project item), and a settings social all share the
      // SAME gate — assert the rejection on each representative sink.
      expect(
        heroContentSchema.safeParse({ heading: 'Hi', cta_url: bad }).success,
        `hero.cta_url should reject ${bad}`,
      ).toBe(false);
      expect(
        projectItemSchema.safeParse({ ...validProjectItem, live_url: bad }).success,
        `project.live_url should reject ${bad}`,
      ).toBe(false);
      // P25: the fixed social `*_url` fields were dropped from settingsSchema; its
      // og_image_url (same urlOrEmptyOptional gate) is the representative URL sink now.
      expect(
        settingsSchema.safeParse({ og_image_url: bad }).success,
        `settings.og_image_url should reject ${bad}`,
      ).toBe(false);
    }
    // ACCEPT: valid https (and http, and uppercase scheme) still pass — the gate
    // must not break legitimate URLs.
    expect(heroContentSchema.safeParse({ heading: 'Hi', cta_url: 'https://x.com' }).success).toBe(
      true,
    );
    expect(
      projectItemSchema.safeParse({ ...validProjectItem, live_url: 'http://x.com/p' }).success,
    ).toBe(true);
    expect(settingsSchema.safeParse({ og_image_url: 'HTTPS://x.com' }).success).toBe(true);
    // Empty string remains valid (the URL-or-empty contract is preserved).
    expect(settingsSchema.safeParse({ og_image_url: '' }).success).toBe(true);
  });

  // --- WR-04: profile resume_url / avatar_url are http(s)-gated ---
  it('WR-04: profileSchema REJECTS dangerous-scheme resume_url/avatar_url, ACCEPTS https/empty', () => {
    const base = { username: 'jane-doe', display_name: 'Jane Doe' };
    expect(profileSchema.safeParse({ ...base, resume_url: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(profileSchema.safeParse({ ...base, avatar_url: 'data:text/html,x' }).success).toBe(false);
    expect(
      profileSchema.safeParse({ ...base, resume_url: 'https://x.com/cv.pdf' }).success,
    ).toBe(true);
    expect(profileSchema.safeParse({ ...base, avatar_url: '' }).success).toBe(true);
    expect(profileSchema.safeParse(base).success).toBe(true); // both omitted ⇒ valid
  });

  it('about rejects bio > 2000 and skills > 30', () => {
    expect(aboutContentSchema.safeParse({ bio: 'ok', skills: [] }).success).toBe(true);
    expect(
      aboutContentSchema.safeParse({ bio: 'x'.repeat(2001), skills: [] }).success,
    ).toBe(false);
    expect(
      aboutContentSchema.safeParse({ bio: 'ok', skills: Array(31).fill('s') }).success,
    ).toBe(false);
  });

  // --- alt-text refine: about section ---
  it('about FAILS when avatar present but avatar_alt empty (alt refine)', () => {
    const res = aboutContentSchema.safeParse({
      bio: 'ok',
      skills: [],
      avatar: 'https://x.com/a.png',
      avatar_alt: '',
    });
    expect(res.success).toBe(false);
    expect(
      res.success === false && res.error.issues.some((i) => i.path.includes('avatar_alt')),
    ).toBe(true);
  });

  it('about PASSES with both avatar and avatar_alt, and with neither (alt refine)', () => {
    expect(
      aboutContentSchema.safeParse({
        bio: 'ok',
        skills: [],
        avatar: 'https://x.com/a.png',
        avatar_alt: 'me',
      }).success,
    ).toBe(true);
    expect(aboutContentSchema.safeParse({ bio: 'ok', skills: [] }).success).toBe(true);
  });

  it('projects rejects items > 20 and a bad item', () => {
    expect(
      projectsContentSchema.safeParse({ heading: 'Work', items: [validProjectItem] }).success,
    ).toBe(true);
    expect(
      projectsContentSchema.safeParse({ heading: 'Work', items: Array(21).fill(validProjectItem) })
        .success,
    ).toBe(false);
  });

  it('testimonials rejects items > 20', () => {
    expect(
      testimonialsContentSchema.safeParse({ heading: 'Praise', items: [validTestimonialItem] })
        .success,
    ).toBe(true);
    expect(
      testimonialsContentSchema.safeParse({
        heading: 'Praise',
        items: Array(21).fill(validTestimonialItem),
      }).success,
    ).toBe(false);
  });

  it('experience rejects items > 20 and a description > 1000 in a nested item', () => {
    expect(
      experienceContentSchema.safeParse({ heading: 'Career', items: [validExperienceItem] })
        .success,
    ).toBe(true);
    const badItem = { ...validExperienceItem, description: 'x'.repeat(1001) };
    expect(
      experienceContentSchema.safeParse({ heading: 'Career', items: [badItem] }).success,
    ).toBe(false);
  });

  it('contact accepts heading + optional subheading', () => {
    expect(contactContentSchema.safeParse({ heading: 'Reach me' }).success).toBe(true);
    expect(contactContentSchema.safeParse({ heading: 'x'.repeat(101) }).success).toBe(false);
  });

  it('contact accepts an optional email_public (valid email, empty, or omitted); rejects a bad email (Option A, 03-08)', () => {
    // Omitted ⇒ valid (the field is optional/additive — CMS-08 "new field, no migration").
    expect(contactContentSchema.safeParse({ heading: 'Reach me' }).success).toBe(true);
    // Empty string ⇒ valid (renders no mailto).
    expect(
      contactContentSchema.safeParse({ heading: 'Reach me', email_public: '' }).success,
    ).toBe(true);
    // A valid email ⇒ valid (the seed copies settings.email_public here for the mailto).
    expect(
      contactContentSchema.safeParse({ heading: 'Reach me', email_public: 'hello@example.com' })
        .success,
    ).toBe(true);
    // A malformed email ⇒ rejected by the Zod gate.
    expect(
      contactContentSchema.safeParse({ heading: 'Reach me', email_public: 'not-an-email' }).success,
    ).toBe(false);
  });

  it('blog_preview requires an integer post_count', () => {
    expect(blogPreviewContentSchema.safeParse({ heading: 'Blog', post_count: 3 }).success).toBe(
      true,
    );
    expect(blogPreviewContentSchema.safeParse({ heading: 'Blog', post_count: 3.5 }).success).toBe(
      false,
    );
  });
});

// ===========================================================================
// skills content schema (the NEW soft-enum branch — first CMS-08 exercise, D-08)
// ===========================================================================

describe('skills content schema', () => {
  const validSkills = {
    heading: 'Skills',
    groups: [
      {
        label: 'Tech Stack',
        items: [
          { name: 'TypeScript', icon: 'typescript', tier: 'core' },
          { name: 'React' }, // bare { name } — icon/tier optional (profession-agnostic, D-27)
        ],
      },
    ],
  };

  it('accepts valid grouped content (with and without optional icon/tier)', () => {
    expect(skillsContentSchema.safeParse(validSkills).success).toBe(true);
  });

  it('accepts an empty groups array (heading-only is valid)', () => {
    expect(skillsContentSchema.safeParse({ heading: 'Skills', groups: [] }).success).toBe(true);
  });

  it('rejects an unknown tier (only core/proficient/learning — D-09)', () => {
    const bad = {
      heading: 'Skills',
      groups: [{ label: 'Tech Stack', items: [{ name: 'React', tier: 'expert' }] }],
    };
    expect(skillsContentSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an empty skill name', () => {
    const bad = {
      heading: 'Skills',
      groups: [{ label: 'Tech Stack', items: [{ name: '' }] }],
    };
    expect(skillsContentSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a heading > 100 chars', () => {
    expect(
      skillsContentSchema.safeParse({ heading: 'x'.repeat(101), groups: [] }).success,
    ).toBe(false);
  });

  it('rejects more than 6 groups', () => {
    const oneGroup = { label: 'G', items: [{ name: 'X' }] };
    expect(
      skillsContentSchema.safeParse({ heading: 'Skills', groups: Array(7).fill(oneGroup) }).success,
    ).toBe(false);
  });

  // D-09 (Phase 13) — the optional numeric `level` field that powers edgerunner's
  // signature animated bars. `level` is an OPTIONAL 0–100 integer; minimal/editorial
  // keep rendering tier pills and IGNORE it (the Phase-3 "tier" decision and the
  // Phase-13 "level" decision are scoped, not contradictory — see sections.ts comment).
  describe('skills.level (D-09 — optional 0–100 int for rich-template bars)', () => {
    const withLevel = (level: unknown) =>
      validateSectionContent('skills', {
        heading: 'Skills',
        groups: [{ label: 'Tech Stack', items: [{ name: 'TS', level }] }],
      });

    it('accepts a valid in-range level (98) — level is a valid 0–100 int', () => {
      expect(() => withLevel(98)).not.toThrow();
    });

    it('accepts the boundary levels 0 and 100', () => {
      expect(() => withLevel(0)).not.toThrow();
      expect(() => withLevel(100)).not.toThrow();
    });

    it('rejects a level over 100 (101)', () => {
      expect(() => withLevel(101)).toThrow();
    });

    it('rejects a non-integer level (1.5)', () => {
      expect(() => withLevel(1.5)).toThrow();
    });

    it('a skill item with NO level still validates (level is optional — backwards compatible)', () => {
      expect(() =>
        validateSectionContent('skills', {
          heading: 'Skills',
          groups: [{ label: 'Tech Stack', items: [{ name: 'TS' }] }],
        }),
      ).not.toThrow();
    });
  });
});

// ===========================================================================
// Marketer-vertical content schemas (the 5 NEW soft-enum branches — 11-04 Step C1)
//   Each: a valid parse + an invalid-polarity rejection per documented constraint
//   (over-long heading, too many items, the URL stored-XSS gate, the image alt-text
//   refine, the palette hex constraint). Mirrors the skills-content block above.
// ===========================================================================

describe('education content schema (11-04 Step C1)', () => {
  const validEducation = {
    heading: 'Education',
    items: [
      {
        id: 'edu1',
        degree: 'B.S. Computer Science',
        school: 'Berkeley',
        year: '2010 - 2014',
        achievements: ['Distinction'],
      },
      { id: 'edu2', degree: 'MBA', school: 'NYU Stern' }, // year/achievements optional
    ],
  };

  it('accepts valid content (with and without optional year/achievements)', () => {
    expect(educationContentSchema.safeParse(validEducation).success).toBe(true);
  });

  it('accepts an empty items array (heading-only is valid)', () => {
    expect(educationContentSchema.safeParse({ heading: 'Education', items: [] }).success).toBe(true);
  });

  it('rejects an item missing a required degree', () => {
    const bad = { heading: 'Education', items: [{ id: 'e', school: 'X' }] };
    expect(educationContentSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects more than 20 items', () => {
    const one = { id: 'e', degree: 'D', school: 'S' };
    expect(
      educationContentSchema.safeParse({ heading: 'Education', items: Array(21).fill(one) }).success,
    ).toBe(false);
  });

  it('rejects a heading > 100 chars', () => {
    expect(
      educationContentSchema.safeParse({ heading: 'x'.repeat(101), items: [] }).success,
    ).toBe(false);
  });
});

describe('metrics content schema (11-04 Step C1)', () => {
  const validMetrics = {
    heading: 'By the numbers',
    subheading: 'Outcomes',
    items: [
      { id: 'm1', value: '5+', label: 'Years', icon: 'calendar' },
      { id: 'm2', value: '10M+', label: 'Reach' }, // icon optional
    ],
  };

  it('accepts valid content (subheading + icon optional)', () => {
    expect(metricsContentSchema.safeParse(validMetrics).success).toBe(true);
    expect(metricsContentSchema.safeParse({ heading: 'Stats', items: [] }).success).toBe(true);
  });

  it('rejects an item missing a required value or label', () => {
    expect(
      metricsContentSchema.safeParse({ heading: 'S', items: [{ id: 'm', label: 'L' }] }).success,
    ).toBe(false);
    expect(
      metricsContentSchema.safeParse({ heading: 'S', items: [{ id: 'm', value: '5' }] }).success,
    ).toBe(false);
  });

  it('rejects more than 12 items', () => {
    const one = { id: 'm', value: '1', label: 'L' };
    expect(
      metricsContentSchema.safeParse({ heading: 'S', items: Array(13).fill(one) }).success,
    ).toBe(false);
  });
});

describe('services content schema (11-04 Step C1)', () => {
  const validServices = {
    heading: 'Services',
    subheading: 'What I offer',
    items: [
      {
        id: 's1',
        title: 'Performance audits',
        description: 'Find slow paths',
        icon: 'gauge',
        deliverables: ['Report', 'Fix list'],
      },
      { id: 's2', title: 'Reviews' }, // description/icon/deliverables optional
    ],
  };

  it('accepts valid content (optional description/icon/deliverables)', () => {
    expect(servicesContentSchema.safeParse(validServices).success).toBe(true);
    expect(servicesContentSchema.safeParse({ heading: 'Services', items: [] }).success).toBe(true);
  });

  it('rejects an item missing a required title', () => {
    const bad = { heading: 'Services', items: [{ id: 's', description: 'X' }] };
    expect(servicesContentSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects more than 10 deliverables in an item', () => {
    const bad = {
      heading: 'Services',
      items: [{ id: 's', title: 'T', deliverables: Array(11).fill('d') }],
    };
    expect(servicesContentSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects more than 20 items', () => {
    const one = { id: 's', title: 'T' };
    expect(
      servicesContentSchema.safeParse({ heading: 'S', items: Array(21).fill(one) }).success,
    ).toBe(false);
  });
});

describe('moodboard content schema (11-04 Step C1)', () => {
  const validMoodboard = {
    heading: 'Brand aesthetic',
    subheading: 'Visual style',
    items: [
      { id: 'i1', image: 'https://x.com/a.webp', image_alt: 'A grid', caption: 'Grids' },
      { id: 'i2' }, // image/alt/caption all optional
    ],
    palette: [{ color: '#FFB6C1', name: 'Rose Pink' }, { color: '#0a0a0a' }],
  };

  it('accepts valid content (optional palette, optional per-item image)', () => {
    expect(moodboardContentSchema.safeParse(validMoodboard).success).toBe(true);
    expect(moodboardContentSchema.safeParse({ heading: 'M', items: [] }).success).toBe(true);
  });

  // --- alt-text refine: moodboard image ---
  it('FAILS when an image is present but image_alt is empty (alt refine)', () => {
    const res = moodboardContentSchema.safeParse({
      heading: 'M',
      items: [{ id: 'i', image: 'https://x.com/a.webp', image_alt: '' }],
    });
    expect(res.success).toBe(false);
    expect(
      res.success === false && res.error.issues.some((i) => i.path.includes('image_alt')),
    ).toBe(true);
  });

  it('PASSES when neither image nor alt is present (alt refine)', () => {
    expect(
      moodboardContentSchema.safeParse({ heading: 'M', items: [{ id: 'i' }] }).success,
    ).toBe(true);
  });

  // --- CR-01: the image URL is the shared stored-XSS gate ---
  it('rejects a dangerous-scheme image URL (CR-01)', () => {
    const bad = {
      heading: 'M',
      items: [{ id: 'i', image: 'javascript:alert(1)', image_alt: 'x' }],
    };
    expect(moodboardContentSchema.safeParse(bad).success).toBe(false);
  });

  // --- the palette color is a constrained hex (not a CSS-injection sink) ---
  it('rejects a non-hex palette color', () => {
    const bad = { heading: 'M', items: [], palette: [{ color: 'red' }] };
    expect(moodboardContentSchema.safeParse(bad).success).toBe(false);
    const bad2 = { heading: 'M', items: [], palette: [{ color: '#ZZZZZZ' }] };
    expect(moodboardContentSchema.safeParse(bad2).success).toBe(false);
  });
});

describe('certifications content schema (11-04 Step C1)', () => {
  const validCerts = {
    heading: 'Certifications',
    items: [
      {
        id: 'c1',
        title: 'AWS SAA',
        issuer: 'AWS',
        year: '2023',
        description: 'Architecture',
        url: 'https://example.com/cert',
      },
      { id: 'c2', title: 'CKA' }, // issuer/year/description/url optional
    ],
  };

  it('accepts valid content (optional issuer/year/description/url)', () => {
    expect(certificationsContentSchema.safeParse(validCerts).success).toBe(true);
    expect(
      certificationsContentSchema.safeParse({ heading: 'Certs', items: [] }).success,
    ).toBe(true);
  });

  it('rejects an item missing a required title', () => {
    const bad = { heading: 'Certs', items: [{ id: 'c', issuer: 'X' }] };
    expect(certificationsContentSchema.safeParse(bad).success).toBe(false);
  });

  // --- CR-01: the cert url is the shared stored-XSS gate ---
  it('rejects a dangerous-scheme cert url, accepts https/empty (CR-01)', () => {
    expect(
      certificationsContentSchema.safeParse({
        heading: 'Certs',
        items: [{ id: 'c', title: 'T', url: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false);
    expect(
      certificationsContentSchema.safeParse({
        heading: 'Certs',
        items: [{ id: 'c', title: 'T', url: '' }],
      }).success,
    ).toBe(true);
  });

  it('rejects more than 20 items', () => {
    const one = { id: 'c', title: 'T' };
    expect(
      certificationsContentSchema.safeParse({ heading: 'C', items: Array(21).fill(one) }).success,
    ).toBe(false);
  });
});

// ===========================================================================
// validateSectionContent (the gate)
// ===========================================================================

describe('validateSectionContent gate', () => {
  it('parses valid content for a known type', () => {
    expect(validateSectionContent('hero', { heading: 'Hi' })).toEqual({ heading: 'Hi' });
  });

  it('throws for a known type with invalid content', () => {
    expect(() => validateSectionContent('hero', { heading: 'x'.repeat(101) })).toThrow();
  });

  it('throws for an unregistered section type', () => {
    expect(() => validateSectionContent('unknown_type', {})).toThrow();
  });

  it('parses valid content for the new "skills" type (CMS-08, no migration)', () => {
    expect(validateSectionContent('skills', { heading: 'Skills', groups: [] })).toEqual({
      heading: 'Skills',
      groups: [],
    });
  });

  it('throws for the "skills" type with invalid content', () => {
    expect(() =>
      validateSectionContent('skills', {
        heading: 'Skills',
        groups: [{ label: 'G', items: [{ name: 'X', tier: 'expert' }] }],
      }),
    ).toThrow();
  });

  it('parses valid content for a new "services" type (11-04 Step C1, no migration)', () => {
    expect(
      validateSectionContent('services', { heading: 'Services', items: [] }),
    ).toEqual({ heading: 'Services', items: [] });
  });

  it('throws for a new "certifications" type with a dangerous-scheme url', () => {
    expect(() =>
      validateSectionContent('certifications', {
        heading: 'Certs',
        items: [{ id: 'c', title: 'T', url: 'javascript:alert(1)' }],
      }),
    ).toThrow();
  });
});

// ===========================================================================
// username schema (shared guard)
// ===========================================================================

describe('usernameSchema', () => {
  it('accepts a valid lowercase username', () => {
    expect(usernameSchema.safeParse('jane-doe').success).toBe(true);
  });

  it('rejects a username that is too short', () => {
    expect(usernameSchema.safeParse('ab').success).toBe(false);
  });

  it('rejects a username that is too long (> 30)', () => {
    expect(usernameSchema.safeParse('a'.repeat(31)).success).toBe(false);
  });

  it('rejects uppercase / bad characters', () => {
    expect(usernameSchema.safeParse('Jane').success).toBe(false);
    expect(usernameSchema.safeParse('A_b').success).toBe(false);
  });

  it('rejects a username that does not start with a letter', () => {
    expect(usernameSchema.safeParse('1abc').success).toBe(false);
    expect(usernameSchema.safeParse('-abc').success).toBe(false);
  });

  it('rejects a reserved username', () => {
    expect(usernameSchema.safeParse('admin').success).toBe(false);
    expect(RESERVED_USERNAMES.has('admin')).toBe(true);
  });
});

// ===========================================================================
// profile schema
// ===========================================================================

describe('profileSchema', () => {
  const validProfile = { username: 'jane-doe', display_name: 'Jane Doe', headline: 'Engineer' };

  it('accepts a valid profile', () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(true);
  });

  it('accepts a profile with no headline (optional)', () => {
    expect(profileSchema.safeParse({ username: 'jane-doe', display_name: 'Jane' }).success).toBe(
      true,
    );
  });

  it('rejects an empty display_name', () => {
    expect(profileSchema.safeParse({ ...validProfile, display_name: '' }).success).toBe(false);
  });

  it('rejects a display_name > 100 chars', () => {
    expect(
      profileSchema.safeParse({ ...validProfile, display_name: 'x'.repeat(101) }).success,
    ).toBe(false);
  });

  it('rejects a headline > 500 chars', () => {
    expect(profileSchema.safeParse({ ...validProfile, headline: 'x'.repeat(501) }).success).toBe(
      false,
    );
  });

  it('rejects a reserved username via the shared guard', () => {
    expect(profileSchema.safeParse({ ...validProfile, username: 'admin' }).success).toBe(false);
  });
});

// ===========================================================================
// settings schema
// ===========================================================================

describe('settingsSchema', () => {
  it('accepts theme_mode "dark" and rejects "blue"', () => {
    expect(settingsSchema.safeParse({ theme_mode: 'dark' }).success).toBe(true);
    expect(settingsSchema.safeParse({ theme_mode: 'blue' }).success).toBe(false);
  });

  // P25 (SET-05): the fixed `*_url` social subset was DROPPED from settingsSchema
  // (migration 025); the active social write shape is contactSocialsSettingsSchema.
  // The schema's urlOrEmptyOptional gate is still exercised by the remaining URL
  // fields (og_image_url/favicon_url).
  it('accepts an empty string and a valid URL for a URL field, rejects a bad URL', () => {
    expect(settingsSchema.safeParse({ og_image_url: '' }).success).toBe(true);
    expect(settingsSchema.safeParse({ og_image_url: 'https://cdn.example/og.png' }).success).toBe(
      true,
    );
    expect(settingsSchema.safeParse({ og_image_url: 'ftp::bad' }).success).toBe(false);
  });

  it('rejects an over-long meta_description', () => {
    expect(settingsSchema.safeParse({ meta_description: 'x'.repeat(501) }).success).toBe(false);
  });

  it('accepts email_public as empty or a valid email, rejects a bad email', () => {
    expect(settingsSchema.safeParse({ email_public: '' }).success).toBe(true);
    expect(settingsSchema.safeParse({ email_public: 'me@example.com' }).success).toBe(true);
    expect(settingsSchema.safeParse({ email_public: 'not-an-email' }).success).toBe(false);
  });
});

// ===========================================================================
// contact form schema
// ===========================================================================

describe('contactFormSchema', () => {
  const validContact = {
    portfolio_id: '550e8400-e29b-41d4-a716-446655440000',
    sender_name: 'Jane',
    sender_email: 'jane@example.com',
    subject: 'Hello',
    body: 'I would like to work with you.',
    turnstile_token: 'tok_abc123',
  };

  it('accepts a valid submission', () => {
    expect(contactFormSchema.safeParse(validContact).success).toBe(true);
  });

  it('rejects an invalid sender_email', () => {
    expect(contactFormSchema.safeParse({ ...validContact, sender_email: 'notanemail' }).success).toBe(
      false,
    );
  });

  it('rejects an empty body', () => {
    expect(contactFormSchema.safeParse({ ...validContact, body: '' }).success).toBe(false);
  });

  it('rejects a body > 5000 chars', () => {
    expect(contactFormSchema.safeParse({ ...validContact, body: 'x'.repeat(5001) }).success).toBe(
      false,
    );
  });

  it('rejects a missing / empty turnstile_token', () => {
    expect(contactFormSchema.safeParse({ ...validContact, turnstile_token: '' }).success).toBe(
      false,
    );
    const { turnstile_token: _omit, ...noToken } = validContact;
    expect(contactFormSchema.safeParse(noToken).success).toBe(false);
  });

  it('rejects an invalid portfolio_id (not a uuid)', () => {
    expect(contactFormSchema.safeParse({ ...validContact, portfolio_id: 'nope' }).success).toBe(
      false,
    );
  });
});

// ===========================================================================
// blog schema
// ===========================================================================

describe('blogSchema', () => {
  const validBlog = {
    title: 'My First Post',
    slug: 'my-first-post',
    body: { type: 'doc', content: [{ type: 'paragraph' }] },
    tags: ['intro', 'news'],
  };

  it('accepts a valid post', () => {
    expect(blogSchema.safeParse(validBlog).success).toBe(true);
  });

  it('rejects a slug with spaces / uppercase', () => {
    expect(blogSchema.safeParse({ ...validBlog, slug: 'Bad Slug' }).success).toBe(false);
  });

  it('rejects a body that is not a type:"doc" document', () => {
    expect(blogSchema.safeParse({ ...validBlog, body: {} }).success).toBe(false);
    expect(blogSchema.safeParse({ ...validBlog, body: { type: 'paragraph' } }).success).toBe(false);
  });

  it('rejects a title > 200 chars', () => {
    expect(blogSchema.safeParse({ ...validBlog, title: 'x'.repeat(201) }).success).toBe(false);
  });

  it('rejects more than 10 tags', () => {
    expect(blogSchema.safeParse({ ...validBlog, tags: Array(11).fill('t') }).success).toBe(false);
  });
});

// ===========================================================================
// auth schemas (signup / login / reset / update-password — server gate)
//   Covers AUTH-01..04: reject bad email/password/username, require ToS.
//   Client-side parse is UX; the server action re-parses these (the real gate).
// ===========================================================================

describe('signupSchema', () => {
  const validSignup = {
    email: 'jane@example.com',
    password: 'hunter2hunter2',
    username: 'jane-doe',
    turnstile_token: 'tok_abc123',
    tos_accepted: true as const,
  };

  it('accepts a fully valid signup payload', () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
  });

  it('normalizes email to trimmed lowercase (IN-04 canonical identity)', () => {
    const res = signupSchema.safeParse({ ...validSignup, email: '  Jane.DOE@Example.COM  ' });
    expect(res.success).toBe(true);
    expect(res.success && res.data.email).toBe('jane.doe@example.com');
  });

  it('rejects an invalid email', () => {
    expect(signupSchema.safeParse({ ...validSignup, email: 'notanemail' }).success).toBe(false);
  });

  it('rejects an email longer than 320 chars', () => {
    const longEmail = `${'a'.repeat(312)}@x.com`; // 318 chars + ... push over 320
    expect(signupSchema.safeParse({ ...validSignup, email: `${longEmail}m`.repeat(2) }).success).toBe(
      false,
    );
  });

  it('rejects a password shorter than 8 chars', () => {
    expect(signupSchema.safeParse({ ...validSignup, password: 'short' }).success).toBe(false);
  });

  it('rejects a password longer than 72 bytes (bcrypt cap)', () => {
    expect(signupSchema.safeParse({ ...validSignup, password: 'a'.repeat(73) }).success).toBe(false);
  });

  it('rejects an empty turnstile_token', () => {
    expect(signupSchema.safeParse({ ...validSignup, turnstile_token: '' }).success).toBe(false);
  });

  it('rejects tos_accepted:false (z.literal(true) — D-09)', () => {
    expect(signupSchema.safeParse({ ...validSignup, tos_accepted: false }).success).toBe(false);
  });

  it('rejects a reserved/invalid username via the shared usernameSchema', () => {
    expect(signupSchema.safeParse({ ...validSignup, username: 'admin' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, username: 'Bad_Name' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  const validLogin = { email: 'jane@example.com', password: 'anything' };

  it('accepts a valid email + non-empty password', () => {
    expect(loginSchema.safeParse(validLogin).success).toBe(true);
  });

  it('normalizes email to trimmed lowercase (IN-04 — same canonical form as signup)', () => {
    const res = loginSchema.safeParse({ ...validLogin, email: '  JANE@Example.com ' });
    expect(res.success).toBe(true);
    expect(res.success && res.data.email).toBe('jane@example.com');
  });

  it('rejects a bad email', () => {
    expect(loginSchema.safeParse({ ...validLogin, email: 'nope' }).success).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ ...validLogin, password: '' }).success).toBe(false);
  });
});

describe('resetRequestSchema', () => {
  it('accepts a valid email', () => {
    expect(resetRequestSchema.safeParse({ email: 'jane@example.com' }).success).toBe(true);
  });

  it('normalizes email to trimmed lowercase (IN-04)', () => {
    const res = resetRequestSchema.safeParse({ email: '  Jane@Example.COM ' });
    expect(res.success).toBe(true);
    expect(res.success && res.data.email).toBe('jane@example.com');
  });

  it('rejects a bad email', () => {
    expect(resetRequestSchema.safeParse({ email: 'notanemail' }).success).toBe(false);
  });
});

describe('updatePasswordSchema', () => {
  it('accepts a password of 8–72 chars', () => {
    expect(updatePasswordSchema.safeParse({ password: 'hunter2hunter2' }).success).toBe(true);
  });

  it('rejects a password shorter than 8 chars', () => {
    expect(updatePasswordSchema.safeParse({ password: 'short' }).success).toBe(false);
  });

  it('rejects a password longer than 72 bytes', () => {
    expect(updatePasswordSchema.safeParse({ password: 'a'.repeat(73) }).success).toBe(false);
  });
});
