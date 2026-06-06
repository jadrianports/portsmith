/**
 * The canonical golden fixture (D-12) — the Lovable prompt scaffold's placeholder
 * content, in machine-checkable form.
 *
 * CANONICAL LOCATION (W8 — Phase-10 Plan 02): this module is the SRC-SIDE home of the
 * golden fixture content. It was moved here from `tests/fixtures/lovable-scaffold-golden.ts`
 * (now a one-line re-export shim) so the `__fixture` render route — served by the real
 * Next dev server during Playwright runs — can import it as `@/lib/fixtures/...` WITHOUT
 * pulling any `tests/` source into the Next compilation graph (W8 / T-10-02-GRAPHLEAK).
 * It is a PURE DATA module: zero imports, no zod, no node APIs — so it is safe in the
 * Next graph and on any bundle.
 *
 * WHAT THIS IS
 * ------------
 * This object is the SAME placeholder content carried verbatim by
 * `docs/lovable-prompt-scaffold.md` (the copy-paste Lovable prompt). It serves two
 * roles at once:
 *   1. It is the dev-flavored placeholder content the scaffold instructs Lovable to
 *      populate, so a design arrives pre-mapped to our soft-enum section model
 *      ("clamp the data, free the look" — D-10).
 *   2. It is the GOLDEN FIXTURE the Phase-10 conformance + visual-parity gates render
 *      against (source Lovable design vs ingested Portsmith template, compared on
 *      IDENTICAL content). Because it is a real fixture — not prose — it MUST validate
 *      against the live `sectionContentSchemas` (`src/lib/validations/sections.ts`).
 *      `tests/unit/templates/scaffold-fixture.test.ts` proves that conformance.
 *
 * GATES THIS CONTENT HONORS (or it fails `scaffold-fixture.test.ts`)
 * -----------------------------------------------------------------
 *   - Every URL field is `http(s)` only — NEVER `javascript:`/`data:`/`vbscript:`
 *     (the `httpUrlOrEmptyOptional` stored-XSS gate, `sections.ts:51-54` —
 *     `z.url({ protocol: /^https?$/ })`). The negative control in the test proves the
 *     gate is real (a `javascript:` URL is rejected).
 *   - Every present `image`/`avatar` has a non-empty `*_alt` (the `altTextOk` refine).
 *   - `experience` dates match `^\d{4}-(0[1-9]|1[0-2])$`; `end_date` also accepts
 *     `'present'` or empty.
 *   - `stars` is an integer 1–5.
 *   - skill `tier` ∈ `core | proficient | learning` (tasteful labels, never % gauges).
 *
 * SHAPE
 * -----
 * Keyed by the 7 dev section types the CMS produces (D-P7-05) PLUS the 5 marketer-vertical
 * types added in 11-04 Step C1 (`education`/`metrics`/`services`/`moodboard`/
 * `certifications`) — 12 keys total. `blog_preview` is OMITTED on purpose: it exists in the
 * schema, but the CMS never produces it in v1 (the editorial template marks it unsupported),
 * so the dev scaffold does not ask Lovable to build it. Each value is the `content` object
 * for that type, shaped EXACTLY as the matching `sectionContentSchemas` branch (verbatim
 * field names).
 *
 * RENDER-NEUTRALITY (11-04 Step C1): adding the 5 marketer keys does NOT change what the
 * minimal/editorial templates render — those specs OMIT the new types (a Partial spec record
 * ⇒ treated as unsupported) AND `goldenPortfolioData`'s `GOLDEN_SECTION_ORDER` emits only the
 * 7 dev sections. So the live templates' golden parity baselines stay byte-identical; the new
 * keys exist only so a SUPPORTING template (the upcoming `aurora`) can render them.
 *
 * VARIANT-READINESS (D-11-scaffold)
 * ---------------------------------
 * The content is dev-flavored to match the v2.0 dev dogfood, but the SHAPE is
 * profession-agnostic: a marketer variant (services/clients/gallery placeholder
 * content) is a cheap copy of this file when that vertical lands. The marketer
 * variant is NOT authored now (deferred past v2.0).
 *
 * Image/avatar/background URLs point at the project's own Supabase Storage public
 * bucket so the fixture models the only sanctioned external image origin (D-16); the
 * exact object paths are placeholders — the parity gate renders the SHAPE, not the
 * pixels of these specific files.
 */

const STORAGE = 'https://supabase.portsmith.example/storage/v1/object/public';

/**
 * The golden fixture: dev-flavored placeholder `content` per dev section type. Frozen
 * so a consumer (a gate, a render harness) cannot mutate the canonical baseline.
 */
export const goldenFixture = {
  hero: {
    heading: 'Riley Chen',
    subheading: 'Full-stack engineer building fast, accessible web products.',
    cta_text: 'View my work',
    cta_url: 'https://example.com/#projects',
    background_image: `${STORAGE}/portfolio-assets/hero-bg.webp`,
    resume_url: `${STORAGE}/portfolio-assets/riley-chen-resume.pdf`,
  },
  about: {
    bio: "I'm a full-stack engineer with eight years shipping production web apps. I care about type-safe data flows, sub-second page loads, and interfaces that stay usable for everyone. Lately I've been building multi-tenant SaaS on Next.js and Postgres.",
    skills: ['TypeScript', 'React', 'Next.js', 'PostgreSQL', 'Accessibility'],
    avatar: `${STORAGE}/portfolio-assets/riley-chen-avatar.webp`,
    avatar_alt: 'Riley Chen smiling in front of a bookshelf',
  },
  skills: {
    heading: 'Skills & Tooling',
    groups: [
      {
        label: 'Core Stack',
        items: [
          { name: 'TypeScript', icon: 'typescript', tier: 'core' },
          { name: 'React', icon: 'react', tier: 'core' },
          { name: 'Next.js', icon: 'nextdotjs', tier: 'core' },
          { name: 'PostgreSQL', icon: 'postgresql', tier: 'core' },
        ],
      },
      {
        label: 'Proficient',
        items: [
          { name: 'Node.js', icon: 'nodedotjs', tier: 'proficient' },
          { name: 'Tailwind CSS', icon: 'tailwindcss', tier: 'proficient' },
          { name: 'Docker', icon: 'docker', tier: 'proficient' },
        ],
      },
      {
        label: 'Currently Learning',
        items: [
          { name: 'Rust', icon: 'rust', tier: 'learning' },
          { name: 'WebGPU', tier: 'learning' },
        ],
      },
    ],
  },
  projects: {
    heading: 'Selected Work',
    items: [
      {
        id: 'prj_ledgerline',
        slug: 'ledgerline',
        title: 'Ledgerline',
        description:
          'A double-entry bookkeeping app for freelancers. Real-time balance sheets, CSV import, and a keyboard-first ledger. Built with Next.js, Postgres, and a typed RPC layer.',
        image: `${STORAGE}/portfolio-assets/ledgerline-cover.webp`,
        image_alt: 'Ledgerline dashboard showing a monthly balance sheet',
        tech_stack: ['TypeScript', 'Next.js', 'PostgreSQL', 'Prisma'],
        live_url: 'https://example.com/ledgerline',
        repo_url: 'https://github.com/rileychen/ledgerline',
      },
      {
        id: 'prj_tidepool',
        slug: 'tidepool',
        title: 'Tidepool',
        description:
          'An open-source design-token sync tool. Watches a Figma file and writes typed CSS custom properties into your repo on every change. ~3k weekly downloads.',
        image: `${STORAGE}/portfolio-assets/tidepool-cover.webp`,
        image_alt: 'Tidepool CLI output syncing design tokens to a code editor',
        tech_stack: ['TypeScript', 'Node.js', 'Figma API'],
        live_url: 'https://example.com/tidepool',
        repo_url: 'https://github.com/rileychen/tidepool',
      },
    ],
  },
  experience: {
    heading: 'Experience',
    items: [
      {
        id: 'exp_northwind',
        company: 'Northwind Software',
        role: 'Senior Software Engineer',
        start_date: '2021-03',
        end_date: 'present',
        description:
          'Lead engineer on the billing platform. Cut invoice-generation time 60% with a streaming Postgres pipeline and shipped a self-serve plan-management UI used by 12k customers.',
      },
      {
        id: 'exp_brightwave',
        company: 'Brightwave Labs',
        role: 'Software Engineer',
        start_date: '2018-06',
        end_date: '2021-02',
        description:
          'Built the customer-facing analytics dashboard and the public API. Introduced end-to-end TypeScript and a component test suite that took flaky CI from 70% to 99% green.',
      },
    ],
  },
  testimonials: {
    heading: 'What people say',
    items: [
      {
        id: 'tst_morgan',
        name: 'Morgan Avery',
        quote:
          'Riley turned our tangled billing code into something the whole team could reason about. The rewrite paid for itself in a quarter.',
        avatar: `${STORAGE}/portfolio-assets/morgan-avery-avatar.webp`,
        avatar_alt: 'Morgan Avery, VP of Engineering at Northwind',
        stars: 5,
        company: 'Northwind Software',
      },
      {
        id: 'tst_sam',
        name: 'Sam Okafor',
        quote:
          'One of the rare engineers who cares as much about accessibility and load time as about clean abstractions. A pleasure to ship with.',
        stars: 5,
        company: 'Brightwave Labs',
      },
    ],
  },
  contact: {
    heading: 'Get in touch',
    subheading: "Open to senior and staff roles, and the occasional consulting project. I'll reply within a day or two.",
    email_public: 'hello@rileychen.example',
  },
  // ── 11-04 Step C1: the 5 marketer-vertical types ────────────────────────────────
  // Added so a SUPPORTING template (the upcoming `aurora`) renders them over the golden
  // route. minimal/editorial OMIT these types from their spec (Partial record ⇒ treated
  // as unsupported) AND `goldenPortfolioData`'s GOLDEN_SECTION_ORDER does not emit them,
  // so adding these keys does NOT change what minimal/editorial render — their golden
  // parity baselines stay byte-identical. Content is dev-flavored to match Riley Chen but
  // the SHAPE is profession-agnostic. Every URL is http(s); every image has a non-empty
  // alt (the altTextOk refine); palette colors are hex literals.
  education: {
    heading: 'Education',
    items: [
      {
        id: 'edu_berkeley',
        degree: 'B.S. in Computer Science',
        school: 'University of California, Berkeley',
        year: '2010 - 2014',
        achievements: ['Graduated with Distinction', 'ACM Programming Team'],
      },
      {
        id: 'edu_recurse',
        degree: 'Recurse Center (S2 batch)',
        school: 'The Recurse Center',
        year: '2017',
        achievements: ['Built a toy database from scratch', 'Mentored two attendees'],
      },
    ],
  },
  metrics: {
    heading: 'By the numbers',
    subheading: 'A few outcomes from the last few years of shipping.',
    items: [
      { id: 'met_years', value: '8+', label: 'Years shipping production web apps', icon: 'calendar' },
      { id: 'met_users', value: '120k', label: 'Monthly active users served', icon: 'users' },
      { id: 'met_perf', value: '60%', label: 'Faster invoice generation', icon: 'gauge' },
      { id: 'met_uptime', value: '99.9%', label: 'Platform uptime', icon: 'activity' },
    ],
  },
  services: {
    heading: 'How I can help',
    subheading: 'Consulting engagements I take on between roles.',
    items: [
      {
        id: 'svc_perf',
        title: 'Performance audits',
        description: 'Find and fix the slow paths in a Next.js or Postgres app.',
        icon: 'gauge',
        deliverables: ['Lighthouse + bundle report', 'Prioritized fix list', 'One follow-up review'],
      },
      {
        id: 'svc_a11y',
        title: 'Accessibility reviews',
        description: 'WCAG 2.2 AA pass over your key user flows.',
        icon: 'accessibility',
        deliverables: ['Axe + manual audit', 'Annotated screenshots', 'Remediation PRs'],
      },
      {
        id: 'svc_types',
        title: 'Type-safety migrations',
        description: 'Move a JS codebase to strict, end-to-end TypeScript.',
        icon: 'shield',
      },
    ],
  },
  moodboard: {
    heading: 'Things I find beautiful',
    subheading: 'Visual references that shape how I build interfaces.',
    items: [
      {
        id: 'mb_grid',
        image: `${STORAGE}/portfolio-assets/moodboard-grid.webp`,
        image_alt: 'A precise modular grid layout in muted neutrals',
        caption: 'Modular grids',
      },
      {
        id: 'mb_type',
        image: `${STORAGE}/portfolio-assets/moodboard-type.webp`,
        image_alt: 'Large editorial typography set in a serif display face',
        caption: 'Editorial type',
      },
      {
        id: 'mb_mono',
        image: `${STORAGE}/portfolio-assets/moodboard-mono.webp`,
        image_alt: 'A monochrome interface with a single accent color',
        caption: 'Restrained color',
      },
    ],
    palette: [
      { color: '#0A0A0A', name: 'Ink' },
      { color: '#F7F7F2', name: 'Paper' },
      { color: '#3B82F6', name: 'Signal' },
    ],
  },
  certifications: {
    heading: 'Certifications',
    items: [
      {
        id: 'cert_aws',
        title: 'AWS Certified Solutions Architect – Associate',
        issuer: 'Amazon Web Services',
        year: '2023',
        description: 'Designing distributed systems on AWS.',
        url: 'https://example.com/certs/aws-saa',
      },
      {
        id: 'cert_cka',
        title: 'Certified Kubernetes Administrator (CKA)',
        issuer: 'The Linux Foundation',
        year: '2022',
        description: 'Cluster operation and troubleshooting.',
        url: 'https://example.com/certs/cka',
      },
    ],
  },
} as const;

/**
 * The dev section types covered by the golden fixture (the keys of {@link goldenFixture}).
 * `blog_preview` is deliberately absent — see the file header.
 */
export type GoldenFixtureSectionType = keyof typeof goldenFixture;

/**
 * The golden fixture as `[type, content]` entries — the shape `scaffold-fixture.test.ts`
 * iterates to run `validateSectionContent` per section.
 */
export const goldenFixtureSections = Object.entries(goldenFixture) as Array<
  [GoldenFixtureSectionType, (typeof goldenFixture)[GoldenFixtureSectionType]]
>;
