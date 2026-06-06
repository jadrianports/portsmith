/**
 * scripts/seed/founder-content.example.ts — the COMMITTED founder-content template
 * (Plan 03-03, Task 1). This is the discoverable contract for the seed's content
 * shape; the REAL content lives in the GITIGNORED sibling `founder-content.ts`
 * (copy this file → `founder-content.ts`, then replace every `REPLACE:` value
 * with James's verbatim content).
 *
 * WHY a fixture (D-01 / D-02): there is no CMS in Phase 3 to enter content, so
 * James's real portfolio is hand-seeded. Content is provided by James at seed
 * time — NOT a planning blocker. This template makes the content contract
 * type-checked (`FOUNDER` is annotated against the Zod-inferred content types
 * from `@/lib/validations`) and the seed runnable even before the real values
 * land: every field already holds a SHAPE-VALID placeholder, so `npx tsc
 * --noEmit` and a local `npm run seed:founder` both stay green.
 *
 * THE CONTRACT (both files export the SAME `FOUNDER` shape):
 *   - `scripts/seed-founder-portfolio.ts` imports `{ FOUNDER } from './seed/founder-content'`.
 *   - A shape mismatch fails `tsc` (the section contents are typed against the
 *     `*Content` types, so the seed and the future Phase-4 CMS write IDENTICAL
 *     shapes — SHARED-C).
 *
 * URL fields (`resume_url`, project `live_url`/`repo_url`, the social links) are
 * validated by Zod as URLs (`z.url()`), so the placeholders here MUST be
 * shape-valid URLs (`https://example.com/REPLACE`), NOT bare `REPLACE:` strings —
 * otherwise `validateSectionContent` would throw on a placeholder run. The SAME
 * rule applies to the EMAIL fields (`bootstrap.email`, `settings.email_public`):
 * `auth.admin.createUser` rejects a malformed email, so the placeholders are
 * shape-valid addresses (`replace-…@example.com`) — fill them with James's real
 * values in the gitignored copy, but never break the format.
 *
 * Testimonials content is intentionally OMITTED (D-06): never ship placeholder
 * quotes. The seed writes the Testimonials section `visible: false` until James
 * has ≥2 real quotes; this fixture supplies no testimonial items.
 */
import type {
  HeroContent,
  AboutContent,
  SkillsContent,
  MetricsContent,
  ProjectsContent,
  ExperienceContent,
  ContactContent,
} from '@/lib/validations';

/**
 * The founder-content fixture shape. The seed reads each typed slice and writes
 * it to the matching table/section (see `scripts/seed-founder-portfolio.ts`).
 */
export interface FounderContent {
  /**
   * The public URL handle — `/[username]`. MUST agree with `generateStaticParams`
   * in 03-05 (D-27 / RESEARCH Open Question 1 RESOLVED: `jadrianports`). Lowercase,
   * starts with a letter, `[a-z][a-z0-9-]*`, 3–30 chars (matches the profiles
   * username CHECK in migration 001).
   */
  username: string;

  /**
   * The fresh-local-DB bootstrap credentials. Used ONLY when the seed runs against
   * a local stack where James's profile does not yet exist — the seed then
   * `auth.admin.createUser`s him (mirrors `_setup.ts` createTestUser) so the real
   * `handle_new_user` trigger provisions the profile. The PROD path assumes he
   * signed up normally and ignores these.
   */
  bootstrap: {
    email: string;
    /** Local-only bootstrap password (prod path never reads this). */
    password: string;
  };

  /**
   * The `profiles` columns the seed UPDATEs (service-role bypasses the
   * protected-columns trigger — the sanctioned path to set `published`).
   */
  profile: {
    display_name: string;
    /** Short tagline / role line — rendered as the hero role line (Body, muted). */
    headline: string;
    /** Optional avatar URL (omit / empty if none). */
    avatar_url?: string;
    /**
     * A working résumé PDF URL (D-14 — the button must visibly work in P3). The
     * production FILE SOURCE is decided at Phase 5; the URL itself just has to
     * resolve. Egress-trivial for a ~200KB PDF.
     */
    resume_url: string;
  };

  /** `portfolio_settings` — theme is forced dark + toggle-on by the seed (D-15/D-16). */
  settings: {
    page_title: string;
    meta_description: string;
    /** Intended-public contact email (distinct from the private profiles.email). */
    email_public: string;
    github_url?: string;
    linkedin_url?: string;
    twitter_url?: string;
    dribbble_url?: string;
    website_url?: string;
  };

  /** Section contents — each typed against its `*Content` Zod-inferred type (SHARED-C). */
  sections: {
    hero: HeroContent;
    about: AboutContent;
    // PIPE-09 / 13-05: the "by the numbers" stat block edgerunner renders (the export's
    // `profile.stats` → the `metrics` soft-enum type). minimal/editorial ignore it; the
    // content round-trips losslessly across a template switch. `value` is a free-form
    // display string ('5+', '10M+', '98%') so it carries its own units/sign.
    metrics: MetricsContent;
    skills: SkillsContent;
    projects: ProjectsContent;
    experience: ExperienceContent;
    contact: ContactContent;
    // testimonials: intentionally omitted — seeded hidden, no placeholder quotes (D-06).
  };
}

/**
 * The founder-content fixture. In this COMMITTED example every value is a
 * clearly-marked placeholder; the gitignored `founder-content.ts` holds James's
 * real values. Each field's inline comment names the decision it satisfies.
 */
export const FOUNDER: FounderContent = {
  // D-27 / RESEARCH OQ-1 RESOLVED — the public slug 03-05's generateStaticParams uses.
  username: 'jadrianports',

  bootstrap: {
    // SHAPE-VALID email (auth.admin.createUser rejects malformed) — replace the
    // local-part with James's real account email in the gitignored copy.
    email: 'replace-founder-account@example.com',
    password: 'replace-local-only-bootstrap-password',
  },

  profile: {
    display_name: 'REPLACE: James Adrian Porter', // hero name line
    headline: 'REPLACE: Full-stack developer who ships products, not demos.', // hero role line (Body, muted)
    avatar_url: undefined, // optional — set a https URL if an avatar exists, else leave undefined
    // D-14: a real working PDF URL (button must work in P3; prod source decided at Phase 5).
    resume_url: 'https://example.com/REPLACE-resume.pdf',
  },

  settings: {
    page_title: 'REPLACE: James Adrian Porter — Portfolio',
    meta_description: 'REPLACE: A short SEO description of James and what he builds.',
    email_public: 'replace-hello@example.com', // intended-public contact email (shape-valid)
    github_url: 'https://github.com/REPLACE',
    linkedin_url: 'https://www.linkedin.com/in/REPLACE',
    twitter_url: undefined, // optional — set a https URL or leave undefined
    dribbble_url: undefined, // optional
    website_url: undefined, // optional
  },

  sections: {
    // Hero — D-12 CTA copy "Work with me"; tagline is seed-sourced (UI-SPEC Copywriting Contract).
    hero: {
      heading: 'REPLACE: James Adrian Porter', // the big hero name/title
      subheading: 'REPLACE: I ship products, not demos.', // the sharp tagline (Muted-Body)
      cta_text: 'Work with me', // D-12 — solo/individual framing, locked copy
      cta_url: '', // in-page anchor to Contact resolved by the template; empty = anchor
      background_image: '', // optional hero background (empty = none)
    },

    // About — bio + optional avatar. NOTE: the flat `about.skills` array is NOT
    // rendered by the template (superseded by the Skills section, UI-SPEC §2) —
    // keep it minimal/empty here; the Skills section below is the real source.
    about: {
      bio: 'REPLACE: 1–3 short paragraphs about James — who he is, what he builds, his focus.',
      skills: [], // intentionally empty — the Skills SECTION supersedes this flat list
      avatar: '', // optional — a https URL; empty = none. If set, avatar_alt is REQUIRED.
      avatar_alt: undefined, // set a non-empty alt iff `avatar` is a non-empty URL (alt-text refine)
    },

    // Metrics — PIPE-09 / 13-05: the "by the numbers" stat block edgerunner renders
    // (the export's `profile.stats`). `value` is a free-form display string so it carries
    // its own units/sign ('5+', '10M+', '98%'); `label` describes it; `icon` is optional.
    // minimal/editorial ignore this section (lossless across a switch). Replace the values
    // with James's real numbers in the gitignored copy.
    metrics: {
      heading: 'REPLACE: By the numbers', // e.g. "By the numbers"
      subheading: undefined, // optional — a short line under the heading, or omit
      items: [
        { id: 'metric-1', value: 'REPLACE: 5+', label: 'REPLACE: Years shipping products' },
        { id: 'metric-2', value: 'REPLACE: 20+', label: 'REPLACE: Projects delivered' },
        { id: 'metric-3', value: 'REPLACE: 100%', label: 'REPLACE: Focus on real products' },
      ],
    },

    // Skills — grouped (D-09): Core Competencies / Tech Stack (simple-icons slugs) /
    // Currently Learning. Tier labels (core/proficient/learning) drive minimal/editorial;
    // the OPTIONAL `level` (0–100 int, Phase-13 D-09) drives edgerunner's signature animated
    // bars — minimal/editorial IGNORE `level` (lossless across a switch). NEVER % gauges on
    // the standard templates. The server re-parse (`skillItemSchema.level`) is the 0–100/int
    // gate; a level absent simply renders edgerunner's tier-pill fallback.
    skills: {
      heading: 'REPLACE: Skills', // e.g. "What I work with"
      groups: [
        {
          label: 'Core Competencies', // D-09 group label
          items: [
            { name: 'REPLACE: Full-stack Web Development', tier: 'core', level: 90 },
            { name: 'REPLACE: API Design', tier: 'core', level: 85 },
          ],
        },
        {
          label: 'Tech Stack', // D-09 — items carry simple-icons slugs (dots → "dot")
          items: [
            { name: 'TypeScript', icon: 'typescript', tier: 'core', level: 95 }, // simple-icons slug
            { name: 'React', icon: 'react', tier: 'core', level: 90 },
            { name: 'Next.js', icon: 'nextdotjs', tier: 'proficient', level: 85 }, // dots → "dot"
            { name: 'Node.js', icon: 'nodedotjs', tier: 'proficient', level: 80 },
            { name: 'PostgreSQL', icon: 'postgresql', tier: 'proficient', level: 75 },
          ],
        },
        {
          label: 'Currently Learning', // D-09 group label
          items: [{ name: 'REPLACE: a thing James is learning', tier: 'learning', level: 40 }],
        },
      ],
    },

    // Projects — D-10: REAL working products. live_url/repo_url are URL-validated,
    // so placeholders must be shape-valid https URLs.
    projects: {
      heading: 'REPLACE: Projects', // e.g. "Selected work"
      items: [
        {
          id: 'project-1', // stable id (client-minted nanoid in the CMS; any stable string here)
          slug: 'replace-project-one', // lowercase slug (future modal deep-link)
          title: 'REPLACE: Project One', // real product name
          description: 'REPLACE: What it is, who it serves, what you built.',
          image: '', // optional — a https URL; empty = none. If set, image_alt is REQUIRED.
          image_alt: undefined, // set iff `image` is a non-empty URL (alt-text refine)
          tech_stack: ['REPLACE-tech-1', 'REPLACE-tech-2'], // up to 10 entries
          live_url: 'https://example.com/REPLACE-live', // D-10 — the working product link
          repo_url: 'https://github.com/REPLACE/repo', // D-10 — the repo link (empty if private)
        },
      ],
    },

    // Experience — YYYY-MM dates; end_date may be 'present' or empty.
    experience: {
      heading: 'REPLACE: Experience', // e.g. "Where I've worked"
      items: [
        {
          id: 'experience-1',
          company: 'REPLACE: Company Name',
          role: 'REPLACE: Role / Title',
          start_date: '2020-01', // YYYY-MM (month 01–12)
          end_date: 'present', // YYYY-MM | 'present' | ''
          description: 'REPLACE: What you did and the impact.',
        },
      ],
    },

    // Contact — form SHELL only in P3 (functional submit is P6). Subhead copy D-12.
    contact: {
      heading: 'REPLACE: Get in touch', // e.g. "Let's build something"
      subheading: "Have an idea in mind? Let's talk", // D-12 — locked copy
    },
  },
};
