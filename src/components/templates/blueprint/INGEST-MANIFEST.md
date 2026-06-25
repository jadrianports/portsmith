# Ingest Manifest — blueprint

**Source:** Lovable export (raw, gitignored: `lovable-exports/blueprint/`)
**Ingested:** 2026-06-25 · **Operator:** James · **Profession:** electronics/hardware engineer (profession-agnostic design)
**Theme model:** dark-only · **Slug/UUID:** `blueprint` / `00000000-0000-4000-8000-000000000007`
**Category:** `dev` (Developer) · **Lane:** public, page-capable (carries `/blog` + `/blog/[slug]`)

> The export is a dark, oscilloscope/"engineering bench" single-scroll: near-black canvas,
> single blueprint-blue accent (`#2563eb`), mono channel eyebrows (`// SELECTED_WORK`,
> `CH1`…`CH14`), blueprint-grid texture, right-angle "PCB trace" hairline dividers, timeline
> spines with accent node dots, tier-pill skills, accent metric rules. It was authored against
> Portsmith's exact section spec — every field name already matches the Zod schemas, so the
> section map is 1:1 with ZERO new types.

## Section Map (generalize-first) — 1:1, no new types

| Export section (label)        | Soft-enum type | Disposition | Rationale |
|-------------------------------|----------------|-------------|-----------|
| Hero (`HARDWARE_ENGINEER`)    | hero           | map         | exact field match |
| `// ABOUT`                    | about          | map         | bio + skills pills + avatar |
| `// SKILLS_TOOLING`           | skills         | map         | grouped tier pills (core/proficient/learning) |
| `// READOUT` (By the numbers) | metrics        | map         | value/label stat tiles + accent rules |
| `// SELECTED_WORK`            | projects       | map         | card grid, tech/tags pills, live/repo |
| `// DEEP_DIVE`                | case_study     | map         | exact case_study shape (challenge/process/outcome + images w/h/alt) |
| `// EXPERIENCE`               | experience     | map         | timeline, YYYY-MM dates, highlights |
| `// EDUCATION`                | education      | map         | timeline, free-form year, achievements |
| `// CERTIFICATIONS`           | certifications | map         | issuer/year + verify link |
| `// SERVICES`                 | services       | map         | bordered cards + mono deliverables |
| `// VOICES`                   | testimonials   | map         | quote cards, accent left-rule, accent stars |
| `// NOTES_FROM_BENCH`         | blog_preview   | map         | 3 teaser cards → `/blog/[slug]` |
| `// CONTACT`                  | contact        | map         | heading/subheading + mailto (→ live ContactForm island) |

## Dedicated pages

| Page | Carried? | Routing | Data |
|------|----------|---------|------|
| /blog (+ /blog/[slug]) | **yes** | `spec.pages: ['blog']`, gated SSG sub-route | DB-Markdown blog engine (`blog_posts`); export's `blog.ts` posts are styling reference only — `/blog` renders each picking user's OWN posts |
| /services | no | — | export had no /services page; `services` renders inline in the single scroll |

**D-15 revision (operator decision):** dedicated `/blog` pages were previously an exclusive-lane
perk; the operator opted blueprint into them as a **public, page-capable** template — the first
public template with sub-pages. Pages are gated by `spec.pages`, not visibility.

## Dependency Decisions

| Dependency | ingest:scan | Decision | Action |
|------------|-------------|----------|--------|
| motion | flag | keep | already pinned (`motion 12`); reveals delegated to kit `ScrollReveal` |
| react-markdown + remark-gfm | flag | keep | already pinned; blog body via the DB-Markdown engine (Shiki server-side) |
| @tanstack/* (router/start/query) | flag | reject | SPA/data layer stripped |
| @radix-ui/*, shadcn ui/*, cmdk, vaul, sonner, recharts, embla, react-hook-form, class-variance-authority, clsx, tailwind-merge, date-fns, zod, etc. | flag | reject | all stripped with the scaffold/admin layer |
| **No new installs** | — | — | every kept dep already in Portsmith |

## Security Findings (must-strip — all resolved by stripping the data/scaffold layer)

| Rule | File | Resolution |
|------|------|------------|
| external-origin (example.com/github.com URLs) | content/portfolio.ts | placeholder data; replaced by per-user PortfolioData (URLs go through `safeHref`/`isHttpImageSrc`) |
| danger-html | components/ui/chart.tsx | shadcn primitive — not carried |
| inline-handler | lib/error-page.ts | lovable error scaffold — not carried |
| hardcoded VITE_* creds | (none present) | data layer not carried |

## Fonts (D-16 — the one sanctioned translation)

Export ships system stacks (Lovable left the intended faces unwired); `plan.md` intent =
Space Grotesk / Inter / JetBrains Mono. Inter is the **chrome face (forbidden in templates)**.
Self-hosted via `next/font/google`:
- **Display** = Space Grotesk (geometric engineering sans — the `--font-display` headings)
- **Body** = IBM Plex Sans (neutral technical sans, Inter-free — the `--font-body` copy)
- **Mono** = JetBrains Mono (the workhorse: eyebrows, channel markers, pills, metrics, labels)

## Phases

| Phase | Result |
|-------|--------|
| A — static faithful clone | _in progress_ |
| B — platform coat + registration | _pending_ |

## Gate Results (gate:template -- blueprint)

| Gate | Result |
|------|--------|
| tsc / security / isolation / registry / bundle / SSG / conformance / a11y / parity | _pending_ |
