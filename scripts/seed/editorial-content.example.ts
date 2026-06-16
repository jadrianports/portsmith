/**
 * scripts/seed/editorial-content.example.ts — the COMMITTED editorial-template
 * demo-content template (Plan 23-01, Task 1; D-15). This is the discoverable
 * contract for the `editorial` demo seed's content shape; the REAL (tweakable)
 * content lives in the GITIGNORED sibling `scripts/seed/editorial-content.ts` (copy
 * this file → `editorial-content.ts`, then tweak the copy if desired).
 *
 * WHY a demo fixture (D-15 — the production verification fixtures + landing
 * examples): the Lighthouse-CI run (LAUNCH-02) and the production public smoke
 * (LAUNCH-08) each need a published, FULLY-RENDERING portfolio per live template. The
 * four live templates are minimal / editorial / edgerunner-v2 / aurora; this fixture
 * is the `editorial` ("Newsprint") one. `EDITORIAL_DEMO` is annotated against the
 * Zod-inferred `*Content` types from `@/lib/validations`, so the seed and the CMS
 * write IDENTICAL shapes (SHARED-C) and a shape mismatch fails `tsc`.
 *
 * DEV-FLAVORED PERSONA (D-15 — "distinct fictional persona per template"; the
 * minimal/editorial/edgerunner-v2 demos are dev-flavored, aurora stays the marketer
 * demo): the persona below is **Lena Voss**, a full-stack / product engineer —
 * DISTINCT from the minimal demo's backend persona (Devon Park) and the founder's own
 * portfolio. The section SHAPE follows the FOUNDER seed's dev shape (hero / about /
 * skills / projects / experience / contact — NOT aurora's services/metrics marketer
 * shape). editorial's spec marks all of these `supported: true`.
 *
 * isPublishReady CONTRACT (LOAD-BEARING — `src/lib/cms/completeness.ts:162-181`): the
 * demo MUST render FULLY (not noindex) or the LHCI/smoke fixtures are meaningless, so
 * every one of the four `isPublishReady` inputs is satisfied here:
 *   1. `hero.heading` is a REAL persona name (NOT the literal `[Your Name]`) AND the
 *      profile `display_name` is non-empty.
 *   2. `about.bio` is a non-empty string.
 *   3. `projects.items` has ≥1 entry.
 *   4. `profile.avatar_url` is a non-empty https URL.
 *
 * URL / EMAIL fields (project `live_url`/`repo_url`, the social links, `avatar_url`,
 * `bootstrap.email`, `settings.email_public`) are validated by Zod as http(s)-only
 * URLs (`z.url({ protocol: /^https?$/ })`, the CR-01 stored-XSS gate) and real-format
 * emails (`z.email()`), so every placeholder here MUST be shape-valid (`https://…` /
 * `name@example.com`) — a bare string would throw on the seed's Zod re-parse.
 */
import type {
  HeroContent,
  AboutContent,
  SkillsContent,
  ProjectsContent,
  ExperienceContent,
  ContactContent,
} from '@/lib/validations';

import { DEMO_USERNAMES } from './demo-usernames';

/**
 * The editorial-demo-content fixture shape. The seed reads each typed slice and writes
 * it to the matching table/section (see `scripts/seed-editorial-demo.ts`). Mirrors the
 * founder fixture's dev-flavored shape (hero/about/skills/projects/experience/contact).
 */
export interface EditorialDemoContent {
  /** The public URL handle — `/[username]`. Sourced from the shared DEMO_USERNAMES. */
  username: string;

  /**
   * Fresh-local-DB bootstrap credentials — used ONLY against a LOCAL stack to
   * `auth.admin.createUser` the demo persona (so the live `handle_new_user` trigger
   * provisions the profile as `role:'user'`). The PROD path never reads these (the
   * demo account is created via normal signup first — plan 23-05 runbook).
   */
  bootstrap: {
    email: string;
    /** Local-only bootstrap password (the prod path never reads this). */
    password: string;
  };

  /**
   * The `profiles` columns the seed UPDATEs (service-role bypasses the
   * protected-columns trigger — the sanctioned path to set `published`).
   */
  profile: {
    display_name: string;
    /** Short tagline / role line — rendered as the hero role line. */
    headline: string;
    /** REQUIRED for isPublishReady — a non-empty https avatar URL. */
    avatar_url: string;
    /** Optional working résumé PDF URL — surfaced INTO the hero content by the seed. */
    resume_url?: string;
  };

  /** `portfolio_settings` — editorial ships only the `'default'` preset (its spec). */
  settings: {
    page_title: string;
    meta_description: string;
    /** Intended-public contact email (distinct from the private profiles.email). */
    email_public: string;
    // P25 (SET-05): social links as an ordered {platform,url} array (the fixed *_url
    // columns were dropped in migration 025). Curated slugs only; twitter -> 'x'.
    socials?: { platform: string; url: string }[];
    location?: string;
    phone?: string;
  };

  /** Section contents — each typed against its `*Content` Zod-inferred type (SHARED-C). */
  sections: {
    hero: HeroContent;
    about: AboutContent;
    skills: SkillsContent;
    projects: ProjectsContent;
    experience: ExperienceContent;
    contact: ContactContent;
  };
}

/**
 * The editorial-demo-content fixture — a full-stack / product-engineer persona, chosen
 * to be DISTINCT from the minimal demo's backend persona and the founder's portfolio
 * (D-15). Every value renders fully (isPublishReady satisfied) so the published
 * `/lena-voss` page is a meaningful Lighthouse + smoke fixture.
 */
export const EDITORIAL_DEMO: EditorialDemoContent = {
  // The seeded demo username — `/lena-voss`. From the shared constant so the LHCI
  // config + prod smoke (plan 23-04) and this fixture can never drift.
  username: DEMO_USERNAMES.editorial,

  bootstrap: {
    // SHAPE-VALID email (auth.admin.createUser rejects malformed) — distinct from the
    // founder + aurora + minimal bootstrap emails so the demo accounts never collide.
    email: 'editorial-demo@example.com',
    password: 'local-only-editorial-demo-password',
  },

  profile: {
    display_name: 'Lena Voss',
    headline: 'Full-stack product engineer — I take ideas from sketch to shipped.',
    // REQUIRED for isPublishReady — a non-empty https URL (a neutral avatar placeholder).
    avatar_url: 'https://avatars.githubusercontent.com/u/8019?s=400',
    resume_url: 'https://example.com/lena-voss-resume.pdf',
  },

  settings: {
    page_title: 'Lena Voss — Full-Stack Product Engineer',
    meta_description:
      'Full-stack product engineer who turns rough ideas into shipped, well-crafted software — from the data model to the last pixel.',
    email_public: 'hello-lena@example.com',
    socials: [
      { platform: 'github', url: 'https://github.com/lena-voss-demo' },
      { platform: 'linkedin', url: 'https://www.linkedin.com/in/lena-voss-demo' },
    ],
    location: undefined,
    phone: undefined,
  },

  sections: {
    // Hero — a REAL persona name (NOT `[Your Name]`) so the isPublishReady name gate passes.
    hero: {
      heading: 'Lena Voss',
      subheading: 'I take ideas from a napkin sketch to shipped software.',
      cta_text: 'Work with me',
      cta_url: '', // empty = in-page anchor to Contact resolved by the template
      background_image: '', // optional hero background (empty = none)
    },

    // About — a non-empty bio (isPublishReady requirement #2). The flat `skills` array is
    // not rendered (the Skills section supersedes it). Avatar omitted here (the PROFILE
    // avatar_url drives isPublishReady; an in-content avatar would also require avatar_alt).
    about: {
      bio: "I'm a full-stack product engineer who likes being close to the problem and close to the user. I've shipped everything from the first prototype of a startup's flagship product to the data layer underneath it — and I care just as much about the migration script as the micro-interaction. I work best on small teams where the line between design, product, and engineering is blurry, and the goal is a thing that actually ships and actually helps someone.",
      skills: [], // not rendered — the Skills section is the source of truth
      avatar: '', // optional — empty = none. If set, avatar_alt is REQUIRED (alt-text refine).
      avatar_alt: undefined,
    },

    // Skills — grouped (Core Competencies / Tech Stack / Currently Learning). `tier` drives
    // editorial's tasteful pills; the optional `level` is ignored by editorial (lossless).
    skills: {
      heading: 'What I work with',
      groups: [
        {
          label: 'Core Competencies',
          items: [
            { name: 'Product engineering', tier: 'core' },
            { name: 'Full-stack web', tier: 'core' },
            { name: 'Interface & interaction design', tier: 'proficient' },
          ],
        },
        {
          label: 'Tech Stack',
          items: [
            { name: 'TypeScript', icon: 'typescript', tier: 'core' },
            { name: 'React', icon: 'react', tier: 'core' },
            { name: 'Next.js', icon: 'nextdotjs', tier: 'core' },
            { name: 'PostgreSQL', icon: 'postgresql', tier: 'proficient' },
            { name: 'Node.js', icon: 'nodedotjs', tier: 'proficient' },
          ],
        },
        {
          label: 'Currently Learning',
          items: [{ name: 'Local-first / CRDT sync', tier: 'learning' }],
        },
      ],
    },

    // Projects — ≥1 entry (isPublishReady requirement #3). live_url/repo_url are
    // URL-validated, so placeholders are shape-valid https URLs.
    projects: {
      heading: 'Selected work',
      items: [
        {
          id: 'project-1',
          slug: 'fieldnote',
          title: 'Fieldnote — a research notebook for product teams',
          description:
            'Designed and built a tool that turns scattered user-research notes into searchable, taggable insights. Took it from a weekend prototype to a paying product with hundreds of teams.',
          image: '', // optional — empty = none. If set, image_alt is REQUIRED.
          image_alt: undefined,
          tech_stack: ['TypeScript', 'Next.js', 'PostgreSQL'],
          live_url: 'https://example.com/work/fieldnote',
          repo_url: 'https://github.com/lena-voss-demo/fieldnote',
        },
        {
          id: 'project-2',
          slug: 'tempo-scheduler',
          title: 'Tempo — a calm scheduling app',
          description:
            'A scheduling app that respects focus time. I owned the whole stack — the constraint solver that places meetings, the React front end, and the design system that holds it together.',
          image: '',
          image_alt: undefined,
          tech_stack: ['React', 'Node.js', 'TypeScript'],
          live_url: 'https://example.com/work/tempo',
          repo_url: 'https://github.com/lena-voss-demo/tempo',
        },
      ],
    },

    // Experience — YYYY-MM dates; end_date may be 'present' or empty.
    experience: {
      heading: "Where I've worked",
      items: [
        {
          id: 'experience-1',
          company: 'Pelham Labs',
          role: 'Founding Product Engineer',
          start_date: '2020-09',
          end_date: 'present',
          description:
            'Employee #3 — built the first version of the product end-to-end and grew the engineering practice as the team scaled to 25.',
        },
        {
          id: 'experience-2',
          company: 'Harbor & Co.',
          role: 'Full-Stack Engineer',
          start_date: '2017-01',
          end_date: '2020-08',
          description:
            'Shipped customer-facing features across the stack and led the design-system rewrite that unified six product surfaces.',
        },
      ],
    },

    // Contact — the contact section. The seed surfaces `settings.email_public` INTO the
    // content so the section can render a mailto fallback under the frozen SectionProps.
    contact: {
      heading: "Let's make something worth shipping",
      subheading: 'Got an idea that needs to become real? Tell me about it.',
    },
  },
};
