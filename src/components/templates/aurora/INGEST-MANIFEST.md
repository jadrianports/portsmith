# Ingest Manifest — aurora

**Source:** Lovable export (raw, gitignored: `lovable-exports/marketing-girl/`)
**Ingested:** 2026-06-06 · **Operator:** James (jadrianports) · **Lane:** standard
**Slug:** `aurora` · **UUID:** `00000000-0000-4000-8000-000000000003` · **Migration:** `supabase/migrations/010_seed_aurora_template.sql`

> The auditable, re-runnable curation record for the Wave-C dogfood ship (PIPE-07 / D-P11-11):
> ONE real Lovable design (the marketer "marketing-girl" export) ingested end-to-end into the
> SHIPPED, conforming, gate-passing public template #3. The raw export stays gitignored; only
> the translated `src/components/templates/aurora/` output, this manifest, and the seeded row are
> committed. This was NOT the plan's assumed clean standard-lane dev export — at the 11-03
> checkpoint the operator redirected to the marketer export (11-04-ADDENDUM, authoritative), so
> the input is HEAVY (admin CMS, react-router, react-quill, framer-motion) and adds 5 new
> marketer-vertical soft-enum types (the Step-C1 platform work).

## Section Map

The marketing-girl single-page composition (`src/pages/Index.tsx`) maps cleanly to the closed
soft-enum set. 7 existing types map 1:1; 5 new marketer-vertical types were added to the soft-enum
set (Step C1 — operator decision, no type invented); the Blog section is dropped (D-19); the SPA
chrome is stripped/converted to the kit. aurora is the BROADEST template — it supports 12 of the 13
soft-enum types (all except `blog_preview`).

| Lovable section | Soft-enum type   | Disposition | Rationale |
|-----------------|------------------|-------------|-----------|
| Hero            | `hero`           | mapped      | clean 1:1 — existing type |
| About           | `about`          | mapped      | clean 1:1 — existing type |
| Experience      | `experience`     | mapped      | clean 1:1 — existing type |
| Projects        | `projects`       | mapped      | clean 1:1 — existing type |
| Skills          | `skills`         | mapped      | clean 1:1 — existing type |
| Testimonials    | `testimonials`   | mapped      | clean 1:1 — existing type |
| Contact         | `contact`        | mapped      | clean 1:1 — existing type |
| Education       | `education`      | mapped (NEW)| new marketer-vertical soft-enum type (Step C1 — CMS-08, no migration) |
| Metrics         | `metrics`        | mapped (NEW)| new marketer-vertical soft-enum type (Step C1) |
| Services        | `services`       | mapped (NEW)| new marketer-vertical soft-enum type (Step C1) |
| Moodboard       | `moodboard`      | mapped (NEW)| new marketer-vertical soft-enum type (Step C1) |
| Certifications  | `certifications` | mapped (NEW)| new marketer-vertical soft-enum type (Step C1) |
| Blog            | `blog_preview`   | dropped     | D-19 — `supported:false`; the blog/posts engine is unbuilt + the CMS never produces `blog_preview` (dedicated section-pages capability deferred to a future phase) |
| Navigation / Footer / ScrollProgressBar / CursorTrail / GlobalLoader | — | stripped/converted | SPA chrome — not portfolio content; reveals handled by the kit `ScrollReveal` + scoped CSS |

**Result:** 12 supported `[data-section-type]` sections render in aurora's RSC root (verified by
`gate:conformance` — every spec-declared supported+filled section renders, no drop, no null leak):
`hero, about, education, experience, metrics, projects, services, skills, testimonials, moodboard,
certifications, contact`. `blog_preview` is `supported:false`.

## Dependency Decisions

The Task-1 `ingest:scan` surfaced 177 advisory FLAGs (unknown deps — they do NOT block; the OUTPUT
`gate:security` re-asserts on the translated template). The entire data/admin/router/CMS dependency
graph was stripped during translation. **No new dependency was installed** — the kit `ScrollReveal`
island + scoped CSS covered all animation, so Task 3 (the slopcheck/install human-verify checkpoint)
was correctly SKIPPED ("no new dependency required"). `package.json` is unchanged by this ship.

| Dependency (export package.json) | ingest:scan | Decision | Allowlist action |
|----------------------------------|-------------|----------|------------------|
| `framer-motion@^12.23.24`        | flag        | replace/strip | reveals handled by the kit `ScrollReveal` + CSS — `motion` NOT installed (kit sufficient); bare `framer-motion` is deliberately unallowlisted (D-07/A6) |
| `react-router-dom@^6.30.1`       | flag        | reject   | SPA router — not used in the single-scroll RSC template |
| `react-quill@^2.0.0` (+ css)     | flag        | reject   | admin blog WYSIWYG — entire admin/CMS layer stripped |
| `@tanstack/react-query@^5.83.0`  | flag        | reject   | data layer stripped (template reads only null-guarded `PortfolioData`) |
| `react-hook-form` / `@hookform/resolvers` | flag | reject  | admin form layer stripped |
| `@radix-ui/*` (27 packages)      | flag        | reject   | shadcn primitives — stripped (D-17 two-layer isolation; identity is the scoped 18-token block) |
| `recharts@^2.15.4`               | flag        | reject   | admin dashboard charts — admin layer stripped |
| `next-themes@^0.3.0`             | flag        | reject   | replaced by the shared kit `ThemeToggle` + `themeInitScript` (D-01/D-02) |
| `sonner` / `vaul` / `cmdk` / `embla-carousel-react` / `input-otp` / `react-day-picker` / `react-resizable-panels` | flag | reject | shadcn/SPA UI widgets — stripped |
| `clsx` / `tailwind-merge` / `class-variance-authority` / `tailwindcss-animate` | flag | reject | shadcn class-merge utilities — not needed (scoped CSS tokens + layout-only Tailwind) |
| `lovable-tagger` / `vite` / `@vitejs/plugin-react-swc` | flag | reject | Lovable/Vite build tooling — irrelevant under Next 16 |
| `zod@^3.25.76`                   | flag        | reject   | the platform owns Zod 4 (write gate); the template does no validation at render |

**Net:** zero install. `gate:security` (D-13/14) re-asserts on the OUTPUT and is GREEN — no
unvetted/unallowlisted import specifier survived into `src/components/templates/aurora/`.

## Security Findings (ingest:scan must-strip — all 43 resolved)

The HEAVY marketer export tripped **43 must-strip findings** (the strip list for Task 2 — must-strips
are eliminated by translation, NOT a blocker to the ship). Breakdown: **40 external-origin**, **2
danger-html**, **1 external-font-origin**. All resolved by stripping the data/admin/blog layer and
self-hosting fonts. The OUTPUT `gate:security` confirms ZERO survive into the translated template.

| Rule | Count | Representative file(s) | Resolution |
|------|-------|------------------------|------------|
| `external-origin` | 40 | `index.html` (4), `src/pages/Blogs.tsx` (6), `src/components/Moodboard.tsx` (6), `src/components/Testimonials.tsx` (4), `src/components/Projects.tsx` (4), `src/components/Blog.tsx` (4), `src/pages/admin/sections/HeroEditor.tsx` (5), `src/pages/BlogPost.tsx` (2), admin dialogs/editors (5) | external image origins (unsplash/CDN) — re-hosted to null-guarded `PortfolioData` reads (the seed/fixture supplies a Storage-origin or none); the Blog + admin source carrying most of these is dropped/stripped entirely |
| `danger-html` | 2 | `src/components/ui/chart.tsx`, `src/pages/BlogPost.tsx` | both stripped — chart.tsx (shadcn/recharts admin) and BlogPost.tsx (the dropped blog engine) are not in the translated template. aurora's RSC root keeps ONLY the ONE sanctioned `themeInitScript` danger-html (FOUC guard) — re-asserted by `gate:security` |
| `external-font-origin` | 1 | `index.html` | the runtime Google Fonts CDN `<link>` → converted to `next/font/google` build-time self-host in `aurora/fonts.ts` (D-16); zero runtime font request |

**T-11-04-XSS / T-11-04-ORIGIN mitigations confirmed:** the translated template carries no
carried-over danger-html (only the sanctioned `themeInitScript`) and no external script/font/style/image
origin — `gate:security`'s `danger-html` / `external-origin` / `external-font-origin` rules all GREEN
on the OUTPUT.

## Parity

Source-parity is **DEFERRED** for aurora (11-04-ADDENDUM / D-P11-10). The marketing-girl source is a
multi-page SPA; aurora deliberately collapses it to a single-scroll template, so a full-page
source-PNG diff would not be a translate-not-redesign signal. aurora ships on its own committed golden
SELF-baseline only; the source-parity case stays file-existence-guarded and SKIPPED for aurora (no
`aurora-source.png` committed), exactly like minimal/editorial. A future single-scroll ingest that
commits a `<slug>-source.png` activates the diff automatically at the wired ratio.

| Field | Value |
|-------|-------|
| self-baseline `maxDiffPixelRatio` | `0.01` (global) — `e2e/__screenshots__/template-visual-parity.spec.ts/aurora-golden.png` |
| source-parity | **DEFERRED** (SPA → single-scroll; self-baseline only) — case file-existence-guarded, skipped for aurora |
| source-parity `maxDiffPixelRatio` (wired, dormant) | `0.04` — looser than the self-baseline (anti-aliasing + RSC-vs-React render + Lovable paraphrase); activates only when a `<slug>-source.png` is committed |
| source-reference | `e2e/__source-reference__/aurora-source.png` — NOT committed (deferred) |

## Gate Results (`npm run gate:template -- aurora`)

**ALL GREEN** end-to-end (the CICD-01 umbrella — blocks on any single sub-gate failure). minimal +
editorial stay green (the new soft-enum types are `supported:false`/absent for them — their golden
baselines unchanged).

| Gate | Result |
|------|--------|
| tsc `--noEmit` | ✅ green |
| security (D-13/14 — TS-AST + regex over `aurora/**`) | ✅ green |
| isolation (D-17 kit-isolation + token-conformance — scoped `.tmpl-aurora` 18 tokens, zero chrome tokens) | ✅ green |
| registry (CICD-03 — 4-surface consistency + neg-fixture absence) | ✅ green |
| async-island-cap (B2 reject predicate) | ✅ green |
| next build | ✅ green |
| bundle (`check:bundle` — ≤200kB gz First Load JS + ●SSG/ISR + async cap) | ✅ green |
| SSG / route-table-ssg (D-22 `/[username]` SSG/ISR invariant) | ✅ green |
| conformance (PIPE-05 — every supported+filled section renders, no drop, no null/undefined/NaN leak, incl. the 5 new types) | ✅ green |
| a11y (axe wcag2a/2aa/21a/21aa serious+critical hard-fail) | ✅ green |
| parity (PIPE-11 golden-fixture self-baseline) | ✅ green |
| source-parity | ⏭️ DEFERRED / skipped (file-existence guard — no `aurora-source.png`) |

**Local migration applied (D-P11-11):** `npx supabase migration up` applied `010_seed_aurora_template.sql`
to the LOCAL Supabase stack; `SELECT id, slug FROM templates WHERE slug = 'aurora'` returns exactly 1
row with `id = 00000000-0000-4000-8000-000000000003` (equal to `TEMPLATE_UUIDS.aurora`). No
`src/types/database.ts` regen (data-only INSERT). **Thumbnail:** `public/templates/aurora.webp` rendered
at 1280×800 via the sharp-free PIPE-06 Playwright path.
