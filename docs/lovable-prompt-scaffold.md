# Lovable Prompt Scaffold — Portsmith Developer Portfolio (PIPE-10)

> **What this is.** ONE copy-pasteable prompt you paste into [Lovable](https://lovable.dev)
> to generate a portfolio design that arrives **already shaped to the Portsmith data
> model**. The section names, field names, and content constraints below are fixed —
> they map 1:1 onto how Portsmith stores and renders a portfolio, so the ingested design
> needs the fewest possible hand-adjustments before it becomes a real template.
>
> **Clamp the data, free the look.** The *structure* (which sections exist, what fields
> they carry, the security rules) is locked. The *aesthetics* — layout, colour, type,
> motion, imagery direction — are 100% yours. Append your own design direction after the
> brief below.
>
> **This doc is also the brief + the reference.** The placeholder content here doubles
> as Portsmith's **golden fixture** (the machine-checkable copy lives in
> `tests/fixtures/lovable-scaffold-golden.ts`, proven conformant by
> `tests/unit/templates/scaffold-fixture.test.ts`). The Phase-11 Lovable→Portsmith skill
> references this same doc when translating the ingested design.

---

## How to use

1. Copy everything from **"=== PASTE INTO LOVABLE BELOW ==="** to the end of this file.
2. Paste it into Lovable as your prompt.
3. **Append your own aesthetic direction** — the vibe, palette, typography, motion, and
   any reference designs. (e.g. "Make it feel like a late-night synthwave terminal" or
   "Editorial, newsprint-inspired, lots of whitespace.") The structure stays fixed; the
   look is entirely yours.
4. Generate, iterate on the *look* until you're happy, then download the code and hand it
   to the operator for ingestion (see **What stays the operator's**, below).

---

## The contract in one paragraph

Build a **single-scroll, one-page** developer portfolio with **exactly these sections, in
this order**: `hero` → `about` → `skills` → `projects` → `experience` → `testimonials` →
`contact`. Use the **exact field names** listed for each section — Portsmith reads these
names directly. Renaming a field, omitting a listed field, or inventing a brand-new
section type produces an **unmapped section** that an operator has to hand-resolve during
ingestion, so stay on these names. Every URL must be a real `https://` (or `http://`)
link — never `javascript:`, `data:`, or any other scheme. Every image must carry
descriptive alt text. Do **not** build a blog/blog-preview section.

---

```
=== PASTE INTO LOVABLE BELOW ===

Build me a single-scroll, one-page developer portfolio website as a React + Tailwind app.

It must contain EXACTLY these sections, in this order, using EXACTLY these field names.
Do not add, remove, rename, or reorder sections. Do not add a blog or blog-preview section.

GLOBAL RULES (non-negotiable — the data is clamped, the look is yours):
- Every URL is a real https:// (or http://) link. Never javascript:, data:, or any other scheme.
- Every image and avatar has descriptive alt text.
- Use only self-hosted fonts (no external font CDNs).
- Do not wire any backend, database, or auth. Use the literal placeholder content below as
  static content — Portsmith supplies the real data at render time.

----------------------------------------------------------------------
1. HERO  (fields: heading, subheading, cta_text, cta_url, background_image, resume_url)
----------------------------------------------------------------------
- heading:          Riley Chen
- subheading:       Full-stack engineer building fast, accessible web products.
- cta_text:         View my work
- cta_url:          https://example.com/#projects
- background_image: a hero background image (with alt text)
- resume_url:       a link to a downloadable résumé PDF

----------------------------------------------------------------------
2. ABOUT  (fields: bio, skills [string list], avatar, avatar_alt)
----------------------------------------------------------------------
- bio:        I'm a full-stack engineer with eight years shipping production web apps. I care
              about type-safe data flows, sub-second page loads, and interfaces that stay usable
              for everyone. Lately I've been building multi-tenant SaaS on Next.js and Postgres.
- skills:     TypeScript, React, Next.js, PostgreSQL, Accessibility   (a simple list of strings)
- avatar:     a headshot image
- avatar_alt: Riley Chen smiling in front of a bookshelf

----------------------------------------------------------------------
3. SKILLS  (fields: heading, groups[] -> { label, items[] -> { name, icon?, tier? } })
   tier is one of: core | proficient | learning   (tasteful labels — NOT percentage bars)
----------------------------------------------------------------------
- heading: Skills & Tooling
- groups:
  - "Core Stack":         TypeScript (core), React (core), Next.js (core), PostgreSQL (core)
  - "Proficient":         Node.js (proficient), Tailwind CSS (proficient), Docker (proficient)
  - "Currently Learning": Rust (learning), WebGPU (learning)
  (icon is an optional brand-icon slug, e.g. "react" — omit it if you don't have one)

----------------------------------------------------------------------
4. PROJECTS  (fields: heading, items[] -> { id, slug, title, description, image, image_alt,
             tech_stack [string list], live_url, repo_url })
----------------------------------------------------------------------
- heading: Selected Work
- items:
  - id: prj_ledgerline | slug: ledgerline | title: Ledgerline
    description: A double-entry bookkeeping app for freelancers. Real-time balance sheets, CSV
                 import, and a keyboard-first ledger. Built with Next.js, Postgres, and a typed
                 RPC layer.
    image_alt:   Ledgerline dashboard showing a monthly balance sheet
    tech_stack:  TypeScript, Next.js, PostgreSQL, Prisma
    live_url:    https://example.com/ledgerline
    repo_url:    https://github.com/rileychen/ledgerline
  - id: prj_tidepool | slug: tidepool | title: Tidepool
    description: An open-source design-token sync tool. Watches a Figma file and writes typed CSS
                 custom properties into your repo on every change. ~3k weekly downloads.
    image_alt:   Tidepool CLI output syncing design tokens to a code editor
    tech_stack:  TypeScript, Node.js, Figma API
    live_url:    https://example.com/tidepool
    repo_url:    https://github.com/rileychen/tidepool

----------------------------------------------------------------------
5. EXPERIENCE  (fields: heading, items[] -> { id, company, role, start_date, end_date, description })
   dates are YYYY-MM. end_date may be "present" or empty for a current role.
----------------------------------------------------------------------
- heading: Experience
- items:
  - id: exp_northwind | company: Northwind Software | role: Senior Software Engineer
    start_date: 2021-03 | end_date: present
    description: Lead engineer on the billing platform. Cut invoice-generation time 60% with a
                 streaming Postgres pipeline and shipped a self-serve plan-management UI used by
                 12k customers.
  - id: exp_brightwave | company: Brightwave Labs | role: Software Engineer
    start_date: 2018-06 | end_date: 2021-02
    description: Built the customer-facing analytics dashboard and the public API. Introduced
                 end-to-end TypeScript and a component test suite that took flaky CI from 70% to
                 99% green.

----------------------------------------------------------------------
6. TESTIMONIALS  (fields: heading, items[] -> { id, name, quote, avatar?, avatar_alt?, stars?, company? })
   stars is an integer 1-5.
----------------------------------------------------------------------
- heading: What people say
- items:
  - id: tst_morgan | name: Morgan Avery | company: Northwind Software | stars: 5
    avatar_alt: Morgan Avery, VP of Engineering at Northwind
    quote: Riley turned our tangled billing code into something the whole team could reason
           about. The rewrite paid for itself in a quarter.
  - id: tst_sam | name: Sam Okafor | company: Brightwave Labs | stars: 5
    quote: One of the rare engineers who cares as much about accessibility and load time as
           about clean abstractions. A pleasure to ship with.
    (no avatar for Sam — that's fine; avatar is optional)

----------------------------------------------------------------------
7. CONTACT  (fields: heading, subheading, email_public)
----------------------------------------------------------------------
- heading:      Get in touch
- subheading:   Open to senior and staff roles, and the occasional consulting project. I'll
                reply within a day or two.
- email_public: hello@rileychen.example

=== END OF PASTE ===
```

> Append your own aesthetic / design direction below the paste before you hit generate.
> The seven sections, their order, and the field names above are fixed; the visual design
> is entirely yours to direct.

---

## What stays yours (the design)

Everything about **how it looks** is yours to direct in Lovable:

- **Layout** — section composition, grid, spacing, sticky elements, the scroll rhythm.
- **Colour & type** — palette, display/body/mono typefaces, dark/light treatment.
- **Motion** — reveal-on-scroll, hover states, hero animation (kept tasteful + accessible).
- **Imagery direction** — the mood of the hero background, project covers, and avatar
  framing.

The Portsmith ingest preserves these design choices ("translate, not redesign"). Two
constraints shape what survives ingestion, both about safety on a shared multi-tenant
domain — they do not limit your visual range:

- **Fonts are self-hosted** (no external font origins).
- **Images load from Supabase Storage on ingest** (the operator re-hosts content images;
  decorative/background images are committed as scoped template assets).

## What stays the operator's (ingestion)

Ingestion is **operator-curated** — you design in Lovable, the operator (the Portsmith
maintainer) runs the Phase-11 skill to translate your downloaded code into a conforming,
secure Portsmith template. During that step the operator: strips any data/auth layer and
exposed secrets, converts styling to Portsmith's scoped token system, and runs the design
through the **full template contract gate checklist**.

You don't need to satisfy the gate checklist yourself — but the closer your design sticks
to the section/field contract above, the closer the translation is to a 1:1 copy.

**The full contract** the ingested design is translated toward — the all-nullable
`PortfolioData` shape, the required token surface, the dependency-lane policy, and the
pass/fail **Gate Checklist** (security, conformance, two-layer isolation) — lives in
[`src/components/templates/CONTRACT.md`](../src/components/templates/CONTRACT.md). Read it
if you're authoring or ingesting a template; it is the source of truth and is **not**
duplicated here.

---

## Notes

- **This is the developer scaffold.** The placeholder content is dev-flavored to match
  Portsmith's first dogfood (a developer portfolio). The seven section types and field
  shapes are **profession-agnostic** by construction.
- **Marketer variant — deferred, not authored now.** A marketer variant of this scaffold
  (services / clients / gallery placeholder content) is a cheap copy of this doc when the
  marketer vertical lands (deferred past v2.0). Do **not** author it as part of this
  scaffold.
- **No blog.** `blog_preview` exists in the Portsmith schema, but the CMS does not produce
  it in v1, so this scaffold deliberately does not ask Lovable to build a blog/blog-preview
  section. Dedicated blog pages are a separate, multi-page direction tracked for later.
- **Keep this doc and the fixture in sync.** The placeholder content above is identical to
  `tests/fixtures/lovable-scaffold-golden.ts`. That fixture is validated against the live
  `sectionContentSchemas` by `tests/unit/templates/scaffold-fixture.test.ts` — so this
  doc's content is proven to be ingestion-conformant, not just well-written. If you edit
  the placeholder content here, mirror it in the fixture (and vice-versa).
