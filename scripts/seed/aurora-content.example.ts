/**
 * scripts/seed/aurora-content.example.ts — the COMMITTED demo-marketer-content
 * template (Plan 22-02, Task 1; D-04 / LAND-03). This is the discoverable contract
 * for the aurora demo seed's content shape; the REAL (tweakable) content lives in
 * the GITIGNORED sibling `scripts/seed/aurora-content.ts` (copy this file →
 * `aurora-content.ts`, then replace each placeholder with James's chosen demo copy).
 *
 * WHY a demo fixture (D-04 — the landing-page proof block): the LAND-03 proof
 * section needs TWO CONTRASTING published showcases — the founder's developer
 * portfolio (`/jadrianports`, edgerunner-v2, showcase #1) AND a marketer portfolio
 * on the `aurora` template (showcase #2). Research conclusively verified NO aurora
 * portfolio exists anywhere in the repo, so this plan SEEDS one. This fixture makes
 * that demo content type-checked (`AURORA_DEMO` is annotated against the
 * Zod-inferred `*Content` types from `@/lib/validations`) and the seed runnable even
 * before James tweaks the copy: every field already holds a SHAPE-VALID placeholder,
 * so `npx tsc --noEmit` and a local `npm run seed:aurora` both stay green.
 *
 * AUTHOR-SUPPLIED PLACEHOLDER (RESEARCH A3 / parallels D-10): the copy below is a
 * deliberately-MARKETER persona (a freelance brand & growth marketing consultant) so
 * the dev-vs-marketer contrast in the proof block is obvious. It is clearly-marked
 * demo placeholder — James can replace it in the gitignored copy without breaking the
 * shape (the seed re-parses each section through the SAME Zod gate the CMS uses).
 *
 * THE CONTRACT (both files export the SAME `AURORA_DEMO` shape):
 *   - `scripts/seed-aurora-demo.ts` imports `{ AURORA_DEMO } from './seed/aurora-content'`.
 *   - A shape mismatch fails `tsc` (the section contents are typed against the
 *     `*Content` types, so the seed and the CMS write IDENTICAL shapes — SHARED-C).
 *
 * URL fields (project `live_url`/`repo_url`, testimonial `avatar`, the social links)
 * are validated by Zod as http(s)-only URLs (`z.url({ protocol: /^https?$/ })`, the
 * CR-01 stored-XSS gate), so the placeholders here MUST be shape-valid `https://…`,
 * NOT bare strings — otherwise `validateSectionContent` would throw on a placeholder
 * run. The SAME rule applies to EMAIL fields (`bootstrap.email`,
 * `settings.email_public`): `auth.admin.createUser` rejects a malformed email and the
 * Zod `z.email()` gate rejects an invalid `contact.email_public`, so the placeholders
 * are shape-valid addresses (`replace-aurora-demo@example.com` form) — fill them with
 * James's chosen values in the gitignored copy, but never break the format.
 *
 * AURORA SUPPORTED SET (verified `src/components/templates/aurora/spec.ts`): aurora
 * is the BROADEST template (12 of 13 soft-enum types `supported:true`). This demo
 * seeds a sensible marketer subset — `hero`, `about`, `services`, `metrics`,
 * `testimonials`, `projects`, `contact` — all `supported:true` and rendered by
 * aurora's per-section components. `color_presets` / `font_presets` are both
 * `['default']` (aurora's only presets), so `portfolio_settings` uses `'default'`.
 */
import type {
  HeroContent,
  AboutContent,
  ServicesContent,
  MetricsContent,
  TestimonialsContent,
  ProjectsContent,
  ContactContent,
} from '@/lib/validations';

/**
 * The aurora-demo-content fixture shape. The seed reads each typed slice and writes
 * it to the matching table/section (see `scripts/seed-aurora-demo.ts`).
 */
export interface AuroraDemoContent {
  /**
   * The public URL handle — `/[username]`. The seeded demo portfolio is reachable at
   * `/aurora-demo` (the public read path resolves any PUBLISHED username via
   * `dynamicParams=true` — RESEARCH A2). Lowercase, starts with a letter,
   * `[a-z][a-z0-9-]*`, 3–30 chars (matches the profiles username CHECK in migration
   * 001). Plan 03 (showcase address bar) + Plan 04 (capture) both consume this.
   */
  username: string;

  /**
   * The fresh-local-DB bootstrap credentials. Used to `auth.admin.createUser` the
   * demo marketer on a local stack where the profile does not yet exist, so the real
   * `handle_new_user` trigger provisions the profile (the seed never sets `role` — the
   * demo user stays `role:'user'`). Distinct from the founder's bootstrap email.
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
    /** Optional avatar URL (omit / empty if none). */
    avatar_url?: string;
  };

  /** `portfolio_settings` — aurora presets are both `'default'` (its only presets). */
  settings: {
    page_title: string;
    meta_description: string;
    /** Intended-public contact email (distinct from the private profiles.email). */
    email_public: string;
    linkedin_url?: string;
    twitter_url?: string;
    website_url?: string;
  };

  /** Section contents — each typed against its `*Content` Zod-inferred type (SHARED-C). */
  sections: {
    hero: HeroContent;
    about: AboutContent;
    services: ServicesContent;
    metrics: MetricsContent;
    testimonials: TestimonialsContent;
    projects: ProjectsContent;
    contact: ContactContent;
  };
}

/**
 * The aurora-demo-content fixture. In this COMMITTED example every value is a
 * clearly-marked marketer-persona placeholder; the gitignored `aurora-content.ts`
 * holds James's chosen demo copy. The persona — a freelance brand & growth marketing
 * consultant — is chosen to CONTRAST sharply with the founder's developer portfolio
 * in the LAND-03 proof block ("works across professions, always looks good").
 */
export const AURORA_DEMO: AuroraDemoContent = {
  // The seeded demo username — `/aurora-demo` (RESEARCH A2 — published username
  // resolves via dynamicParams=true). Plan 03/04 consume this exact value.
  username: 'aurora-demo',

  bootstrap: {
    // SHAPE-VALID email (auth.admin.createUser rejects malformed) — distinct from the
    // founder's bootstrap email so the two demo accounts never collide.
    email: 'replace-aurora-demo@example.com',
    password: 'replace-local-only-aurora-demo-password',
  },

  profile: {
    display_name: 'Mara Quinn', // demo marketer name (placeholder — James tweaks)
    headline: 'Freelance brand & growth marketing consultant', // hero role line
    avatar_url: undefined, // optional — set a https URL if a demo avatar exists, else undefined
  },

  settings: {
    page_title: 'Mara Quinn — Brand & Growth Marketing',
    meta_description:
      'Freelance marketing consultant helping founders launch brands, grow audiences, and turn attention into revenue.',
    email_public: 'replace-hello-aurora-demo@example.com', // intended-public contact email (shape-valid)
    linkedin_url: 'https://www.linkedin.com/in/replace-aurora-demo',
    twitter_url: 'https://x.com/replace-aurora-demo',
    website_url: 'https://example.com/replace-aurora-demo',
  },

  sections: {
    // Hero — marketer framing. cta_url empty = template resolves an in-page anchor.
    hero: {
      heading: 'Marketing that turns attention into revenue',
      subheading:
        "I help founders and small teams build brands people remember — and pipelines that actually convert.",
      cta_text: "Let's work together",
      cta_url: '', // empty = in-page anchor to Contact resolved by the template
      background_image: '', // optional hero background (empty = none)
    },

    // About — bio. `skills` flat array is NOT rendered by aurora (kept empty); the
    // avatar is optional and, if set, REQUIRES a non-empty avatar_alt (alt-text refine).
    about: {
      bio: "I'm a freelance brand and growth marketing consultant with a decade of helping early-stage companies find their voice and their market. I blend positioning, content, and performance marketing into a single, measurable growth motion — no jargon, no vanity metrics, just work that moves the numbers that matter.",
      skills: [], // not rendered by aurora — kept empty
      avatar: '', // optional — a https URL; empty = none. If set, avatar_alt is REQUIRED.
      avatar_alt: undefined, // set a non-empty alt iff `avatar` is a non-empty URL (alt-text refine)
    },

    // Services — the marketer offering list. `deliverables` is an optional bullet list.
    services: {
      heading: 'What I do',
      subheading: 'Three ways I help brands grow — pick one or stack them.',
      items: [
        {
          id: 'service-brand',
          title: 'Brand & positioning',
          description:
            'Sharpen who you are, who you serve, and why it matters — the messaging foundation everything else stands on.',
          deliverables: [
            'Positioning & messaging framework',
            'Tone-of-voice and brand guidelines',
            'Homepage and landing-page copy',
          ],
        },
        {
          id: 'service-content',
          title: 'Content & social',
          description:
            'A repeatable content engine that builds an audience and keeps your brand top-of-mind.',
          deliverables: [
            'Editorial calendar & content strategy',
            'Newsletter and social playbook',
            'Monthly performance review',
          ],
        },
        {
          id: 'service-growth',
          title: 'Growth & performance',
          description:
            'Paid and lifecycle campaigns engineered around the metric you actually care about: revenue.',
          deliverables: [
            'Paid acquisition setup & optimization',
            'Email & lifecycle automation',
            'Conversion-rate experiments',
          ],
        },
      ],
    },

    // Metrics — the "by the numbers" headline-stat block. `value` is a free-form
    // display string ('5+', '10M+', '98%') so it carries its own units/sign.
    metrics: {
      heading: 'By the numbers',
      subheading: 'A decade of campaigns, measured by outcomes — not impressions.',
      items: [
        { id: 'metric-1', value: '10+', label: 'Years in marketing' },
        { id: 'metric-2', value: '40+', label: 'Brands launched & scaled' },
        { id: 'metric-3', value: '3.2x', label: 'Average ROAS on managed spend' },
        { id: 'metric-4', value: '120%', label: 'Avg. audience growth in year one' },
      ],
    },

    // Testimonials — real-shaped quotes (demo placeholder). `stars` is an int 1–5; an
    // avatar, if set, REQUIRES avatar_alt (alt-text refine). Seeded visible (D-04
    // wants a complete-looking showcase — these are clearly-marked demo quotes, not the
    // founder's "no placeholder quotes" D-06 rule which governs his REAL portfolio).
    testimonials: {
      heading: 'What clients say',
      items: [
        {
          id: 'testimonial-1',
          name: 'Priya Desai',
          quote:
            'Mara rebuilt our positioning from the ground up. Within a quarter our demo requests doubled and our messaging finally sounded like us.',
          stars: 5,
          company: 'Founder, Northwind Studio',
        },
        {
          id: 'testimonial-2',
          name: 'Daniel Okoro',
          quote:
            'The content engine she set up runs itself now. We went from posting sporadically to a real audience that converts — without hiring a full team.',
          stars: 5,
          company: 'CEO, Tellwell',
        },
        {
          id: 'testimonial-3',
          name: 'Sofia Lindqvist',
          quote:
            'Clear-eyed, data-driven, and genuinely kind to work with. Our paid spend finally pays for itself and then some.',
          stars: 5,
          company: 'Head of Growth, Brightleaf',
        },
      ],
    },

    // Projects — used here as a marketer's "selected work" / case studies. live_url is
    // URL-validated, so placeholders must be shape-valid https URLs. tech_stack doubles
    // as a tag list (channels/tools) for the marketer persona.
    projects: {
      heading: 'Selected work',
      items: [
        {
          id: 'project-1',
          slug: 'northwind-rebrand',
          title: 'Northwind Studio — full rebrand & launch',
          description:
            'Repositioned a design studio from generalist to specialist, rebuilt the site copy, and ran the launch campaign. Result: 2x qualified leads in the first quarter.',
          image: '', // optional — a https URL; empty = none. If set, image_alt is REQUIRED.
          image_alt: undefined,
          tech_stack: ['Positioning', 'Web copy', 'Launch campaign'],
          live_url: 'https://example.com/work/northwind',
          repo_url: '', // not applicable for a marketing case study — empty
        },
        {
          id: 'project-2',
          slug: 'tellwell-content-engine',
          title: 'Tellwell — content & newsletter engine',
          description:
            'Built a weekly newsletter and a repeatable social system from scratch, growing the list to 18k engaged subscribers in eleven months.',
          image: '',
          image_alt: undefined,
          tech_stack: ['Newsletter', 'Social', 'Editorial calendar'],
          live_url: 'https://example.com/work/tellwell',
          repo_url: '',
        },
        {
          id: 'project-3',
          slug: 'brightleaf-paid-growth',
          title: 'Brightleaf — paid acquisition overhaul',
          description:
            'Restructured paid campaigns around contribution margin, lifting blended ROAS from 1.4x to 3.2x while scaling spend 60%.',
          image: '',
          image_alt: undefined,
          tech_stack: ['Paid media', 'Lifecycle email', 'CRO'],
          live_url: 'https://example.com/work/brightleaf',
          repo_url: '',
        },
      ],
    },

    // Contact — the contact section. `email_public` is surfaced INTO the content (the
    // SAME additive idiom the founder seed uses) so aurora's contact section can render
    // a mailto fallback under the frozen `{ section }` SectionProps contract. The seed
    // copies `settings.email_public` here.
    contact: {
      heading: "Let's build something people remember",
      subheading: 'Tell me about your brand and where you want to take it.',
    },
  },
};
