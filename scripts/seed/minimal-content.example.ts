/**
 * scripts/seed/minimal-content.example.ts — the COMMITTED minimal-template
 * demo-content template (Plan 23-01, Task 1; D-15). This is the discoverable
 * contract for the `minimal` demo seed's content shape; the REAL (tweakable) content
 * lives in the GITIGNORED sibling `scripts/seed/minimal-content.ts` (copy this file →
 * `minimal-content.ts`, then tweak the copy if desired).
 *
 * WHY a demo fixture (D-15 — the production verification fixtures + landing
 * examples): the Lighthouse-CI run (LAUNCH-02) and the production public smoke
 * (LAUNCH-08) each need a published, FULLY-RENDERING portfolio per live template. The
 * four live templates are minimal / editorial / edgerunner-v2 / aurora; this fixture
 * is the `minimal` one. `MINIMAL_DEMO` is annotated against the Zod-inferred
 * `*Content` types from `@/lib/validations`, so the seed and the CMS write IDENTICAL
 * shapes (SHARED-C) and a shape mismatch fails `tsc`.
 *
 * DEV-FLAVORED PERSONA (D-15 — "distinct fictional persona per template"; the
 * minimal/editorial/edgerunner-v2 demos are dev-flavored, aurora stays the marketer
 * demo): the persona below is **Devon Park**, a backend / platform engineer. The
 * section SHAPE follows the FOUNDER seed's dev shape (hero / about / skills /
 * projects / experience / contact — NOT aurora's services/metrics marketer shape).
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
 * The minimal-demo-content fixture shape. The seed reads each typed slice and writes
 * it to the matching table/section (see `scripts/seed-minimal-demo.ts`). Mirrors the
 * founder fixture's dev-flavored shape (hero/about/skills/projects/experience/contact).
 */
export interface MinimalDemoContent {
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

  /** `portfolio_settings` — minimal supports many presets; the demo uses `'default'`. */
  settings: {
    page_title: string;
    meta_description: string;
    /** Intended-public contact email (distinct from the private profiles.email). */
    email_public: string;
    github_url?: string;
    linkedin_url?: string;
    website_url?: string;
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
 * The minimal-demo-content fixture — a backend / platform-engineer persona, chosen to
 * be DISTINCT from the editorial and founder dev personas (D-15). Every value renders
 * fully (isPublishReady satisfied) so the published `/devon-park` page is a meaningful
 * Lighthouse + smoke fixture.
 */
export const MINIMAL_DEMO: MinimalDemoContent = {
  // The seeded demo username — `/devon-park`. From the shared constant so the LHCI
  // config + prod smoke (plan 23-04) and this fixture can never drift.
  username: DEMO_USERNAMES.minimal,

  bootstrap: {
    // SHAPE-VALID email (auth.admin.createUser rejects malformed) — distinct from the
    // founder + aurora bootstrap emails so the demo accounts never collide.
    email: 'minimal-demo@example.com',
    password: 'local-only-minimal-demo-password',
  },

  profile: {
    display_name: 'Devon Park',
    headline: 'Backend & platform engineer — I build the systems other apps run on.',
    // REQUIRED for isPublishReady — a non-empty https URL (a neutral avatar placeholder).
    avatar_url: 'https://avatars.githubusercontent.com/u/9919?s=400',
    resume_url: 'https://example.com/devon-park-resume.pdf',
  },

  settings: {
    page_title: 'Devon Park — Backend & Platform Engineer',
    meta_description:
      'Backend and platform engineer building reliable distributed systems, developer tooling, and the infrastructure other apps depend on.',
    email_public: 'hello-devon@example.com',
    github_url: 'https://github.com/devon-park-demo',
    linkedin_url: 'https://www.linkedin.com/in/devon-park-demo',
    website_url: undefined,
  },

  sections: {
    // Hero — a REAL persona name (NOT `[Your Name]`) so the isPublishReady name gate passes.
    hero: {
      heading: 'Devon Park',
      subheading: 'I build the reliable systems other apps run on.',
      cta_text: 'Work with me',
      cta_url: '', // empty = in-page anchor to Contact resolved by the template
      background_image: '', // optional hero background (empty = none)
    },

    // About — a non-empty bio (isPublishReady requirement #2). The flat `skills` array is
    // not rendered (the Skills section supersedes it). Avatar omitted here (the PROFILE
    // avatar_url drives isPublishReady; an in-content avatar would also require avatar_alt).
    about: {
      bio: "I'm a backend and platform engineer with eight years building the unglamorous systems that keep products online — queues, schedulers, data pipelines, and the developer tooling that lets teams ship without fear. I care about correctness, observability, and making the hard things boring. Most of my best work is invisible: the page just loads, the job just runs, the deploy just goes out.",
      skills: [], // not rendered — the Skills section is the source of truth
      avatar: '', // optional — empty = none. If set, avatar_alt is REQUIRED (alt-text refine).
      avatar_alt: undefined,
    },

    // Skills — grouped (Core Competencies / Tech Stack / Currently Learning). `tier` drives
    // minimal's tasteful pills; the optional `level` is ignored by minimal (lossless).
    skills: {
      heading: 'What I work with',
      groups: [
        {
          label: 'Core Competencies',
          items: [
            { name: 'Distributed systems', tier: 'core' },
            { name: 'API & service design', tier: 'core' },
            { name: 'Observability & SRE', tier: 'proficient' },
          ],
        },
        {
          label: 'Tech Stack',
          items: [
            { name: 'Go', icon: 'go', tier: 'core' },
            { name: 'PostgreSQL', icon: 'postgresql', tier: 'core' },
            { name: 'Kubernetes', icon: 'kubernetes', tier: 'proficient' },
            { name: 'Terraform', icon: 'terraform', tier: 'proficient' },
            { name: 'TypeScript', icon: 'typescript', tier: 'proficient' },
          ],
        },
        {
          label: 'Currently Learning',
          items: [{ name: 'Rust for systems work', tier: 'learning' }],
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
          slug: 'pipeline-orchestrator',
          title: 'Flowline — a self-healing data pipeline orchestrator',
          description:
            'Designed and built a fault-tolerant job orchestrator that runs thousands of daily data jobs with automatic retry, backpressure, and dead-letter handling. Cut failed-overnight-run pages by 90%.',
          image: '', // optional — empty = none. If set, image_alt is REQUIRED.
          image_alt: undefined,
          tech_stack: ['Go', 'PostgreSQL', 'Kubernetes'],
          live_url: 'https://example.com/work/flowline',
          repo_url: 'https://github.com/devon-park-demo/flowline',
        },
        {
          id: 'project-2',
          slug: 'devtools-cli',
          title: 'devkit — an internal developer-experience CLI',
          description:
            'A single command-line tool that scaffolds services, wires CI, and provisions preview environments — turning a two-day setup into a two-minute one for every engineer on the team.',
          image: '',
          image_alt: undefined,
          tech_stack: ['Go', 'TypeScript', 'Terraform'],
          live_url: 'https://example.com/work/devkit',
          repo_url: 'https://github.com/devon-park-demo/devkit',
        },
      ],
    },

    // Experience — YYYY-MM dates; end_date may be 'present' or empty.
    experience: {
      heading: "Where I've worked",
      items: [
        {
          id: 'experience-1',
          company: 'Lattice Systems',
          role: 'Staff Platform Engineer',
          start_date: '2021-03',
          end_date: 'present',
          description:
            'Lead the platform team owning CI/CD, observability, and the internal developer platform for ~120 engineers.',
        },
        {
          id: 'experience-2',
          company: 'Northgate Data',
          role: 'Senior Backend Engineer',
          start_date: '2017-06',
          end_date: '2021-02',
          description:
            'Built the data-ingestion backbone processing billions of events a day; owned the on-call rotation and SLOs.',
        },
      ],
    },

    // Contact — the contact section. The seed surfaces `settings.email_public` INTO the
    // content so the section can render a mailto fallback under the frozen SectionProps.
    contact: {
      heading: "Let's build something solid",
      subheading: 'Have a system that needs to scale or stop paging you? Get in touch.',
    },
  },
};
