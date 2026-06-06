# Ingest Manifest — edgerunner

**Source:** Lovable export (raw, gitignored: `lovable-exports/synthwave-founder/`)
**Ingested:** 2026-06-06 · **Operator:** James (jadrianports) · **Lane:** rich / viz (R3F v9 + drei, lazy `{ssr:false}` island)
**Slug:** `edgerunner` · **UUID (to pin):** `00000000-0000-4000-8000-000000000004` · **Migration:** `supabase/migrations/015_seed_edgerunner_template.sql` (a later plan)

> The auditable, re-runnable curation record for the Phase-13 rich/viz-lane dogfood (PIPE-09 /
> D-01..D-11): the founder's synthwave Lovable export ingested as the SHIPPED `restricted`/exclusive
> WebGL template that replaces `minimal` as the founder's live page. The raw export stays gitignored;
> only the translated `src/components/templates/edgerunner/` output, this manifest, and the seeded row
> are committed. This is the project's FIRST **rich-lane** ingest — the single `HoloShape` WebGL object
> becomes a lazy `dynamic(() => import('./Scene'), { ssr:false })` client island (the export is also a
> BROADER framework shell than aurora's Vite SPA: **TanStack Start + Nitro + file routing + server fns +
> an MDX blog** — see the playbook's additive TanStack-Start strip note).
>
> **Seeded by Plan 13-01** (deps + scan + scope). The reserved slots (the real async-cap chunk size,
> the parity-threshold choice, the final gate results, the seed-migration details) are filled by the
> downstream generation/gate plans 13-02..13-07. Do NOT inline copied allowlists — this manifest points
> at the source files (`scripts/template-allowlist.ts`, `contract.ts`, `CONTRACT.md`).

## Locked Scope Decisions (CONTEXT D-01 / D-06..D-11)

- **D-01 (Scope = SPLIT, single-scroll ONLY):** ingest the export's single-scroll portfolio ONLY.
  The blog engine (`/blog` + `/blog/$slug`), the `/services` page, and ALL multi-page routing are
  **OUT → Phase 13.2**. Do NOT carry the export's MDX chain (`@mdx-js/*`, `shiki`, `@shikijs/rehype`,
  `remark-*`), the TanStack-Start server entry (`server.ts`/`start.ts`/`router.tsx`/`routeTree.gen.ts`),
  file routes, or Nitro into the template.
- **D-06 (dark-only):** slug `edgerunner`, `defaultMode='dark'`; bind `themeInitScript('dark')` but do
  NOT mount the kit `ThemeToggle`. Dark-only is edgerunner's per-template choice, NOT a platform retreat
  from light/dark (minimal/editorial/aurora keep the dual-mode contract).
- **D-07 (synthwave a11y):** keep `PowerOnFlash` (soft, reduced-motion-gated, well under WCAG 2.3.1) +
  `CursorTrail` (reduced-motion + pointer-coarse-gated). **Drop the `cmdk` CommandPalette** (multi-page
  nav affordance, pointless on a single scroll).
- **D-08 (map-to-existing first):** `tools → skills`, `timeline → experience` (a render-style, not a new
  type), `selected-work → projects`, `profile.stats → metrics` (exists, P11). New types/fields added
  sparingly (CMS-08, Zod-only, NO migration).
- **D-09 (skills `level`):** add an OPTIONAL numeric `skills.level` (0–100) so edgerunner renders its
  signature animated bars. minimal/editorial keep rendering tier pills and IGNORE `level`. (Reconcile
  the Phase-3 "never numeric gauges" comment — a later plan; the two "D-09" labels are different
  decisions, resolved by `level` being optional + rich-only.)
- **D-10 (enrich founder-content now):** seed the founder's REAL content (metrics stats + skill levels)
  so the live page ships complete — **seed-first** + a narrow targeted skills/metrics CMS input (NOT the
  full per-type-form overhaul, which is the deferred CMS-editing-surface phase 13.1).
- **D-11 (visibility wiring):** edgerunner ships `restricted` + founder-granted; the founder's portfolio
  is switched to it; the current synthwave `minimal` is flipped to `public`. Rides the P12 model
  (`templateVisibilitySchema`, `template_grants`, `switchTemplateAction` GATE-03) — no render-time gate.

## Section Map (proposed — RESEARCH §6; confirm at generation)

The synthwave single-scroll composition maps onto the closed soft-enum set. 7 types map; `services`
links to a dedicated multi-page route (OUT by D-01) and `blog_preview` is the deferred blog engine — both
`supported:false` for now (the types already exist; no invention). The SPA chrome + decorative layers are
stripped/converted to the kit + scoped CSS; the ONE WebGL file becomes the lazy rich-lane scene island.

| Export section | Soft-enum type | Disposition | Rationale |
|----------------|----------------|-------------|-----------|
| Hero | `hero` | mapped | clean 1:1 (heading/subheading/cta/background) |
| About (+ stats) | `about` + `metrics` | mapped + mapped | bio → `about`; `profile.stats` → `metrics` (exists, P11) per D-08 |
| Experience (timeline) | `experience` | mapped | "timeline" is a render-style, not a new type (D-08) |
| Projects (selected work, modal `longDescription`) | `projects` | mapped | reuse the in-repo focus-trapped project modal for `longDescription` (verify the field contract at generation) |
| Tools (skill gauges, `level`) | `skills` | mapped (+ optional `level`) | tools → skills (D-08); the numeric `level` is the new optional Zod field (D-09) |
| Contact | `contact` | mapped | clean 1:1 |
| Services | `services` | **DROPPED this phase** (`supported:false`) | export links to a dedicated `/services` page (multi-page) — OUT by D-01 → 13.2; the `services` type exists (P11) but edgerunner marks it unsupported for now |
| Blog / BlogTeaser | `blog_preview` | dropped (`supported:false`) | blog engine deferred (D-01/D-19) → 13.2 |
| Navbar / Footer / **CommandPalette** / CursorTrail / AmbientOverlays / PowerOnFlash / ScrollProgress | — | stripped / converted | SPA chrome. `cmdk` CommandPalette DROPPED (D-07). CursorTrail + PowerOnFlash KEPT, reduced-motion-gated, re-authored CSS/light-JS. Navbar/Footer → minimal/none (single scroll). |
| AnimatedSun / CityScene / TerminalCard / TechMarquee | — | decorative → scoped CSS | pure CSS/motion backdrops re-authored as `.tmpl-edgerunner` `@keyframes` — the CSS synthwave layer that keeps the page COMPLETE without WebGL (D-04 progressive enhancement) |
| **HoloShape (WebGL)** | — (decorative) | → **lazy rich-lane Scene island** | the ONE WebGL file → `edgerunner/Scene.tsx` (the `{ssr:false}` heavy chunk the async-cap measures); thin `'use client'` mount in `edgerunner/HoloShape.tsx` |

**Proposed supported set (7):** `hero, about, metrics, experience, projects, skills, contact`.
`services` and `blog_preview` are `supported:false`. Confirm the exact list when `edgerunner/spec.ts` is
authored.

### CONFIRMED at generation (Plan 13-04)

**Final supported set (7) — locked in `edgerunner/spec.ts`:** `hero, about, metrics, experience,
projects, skills, contact` (rendered IN THIS source order by `index.tsx`). `services` + `blog_preview`
are `supported:false` (D-01 → 13.2). The exact section order in the RSC root is: Hero (→ mounts the
`<HoloShape>` WebGL centerpiece + the CSS sky/sun/grid backdrop, D-04) → About → Metrics
(`profile.stats → metrics`, D-08) → Experience (the "timeline" render-style, D-08) → Projects (reuses
`ProjectsWithModal`, reading `item.description` — A4 resolved, no `longDescription`) → Skills (the
animated `level` bars, the D-09 signature) → Contact → Footer.

**react-icons → simple-icons translation (T-13-04-ORIGIN):** the export's `src/data/tools.ts` imported
~24 brand logos from `react-icons/si` (NOT on the D-15 allowlist). These were re-authored to the in-repo
`simple-icons` `.path` server-render pattern in `edgerunner/sections/icons.ts` — a curated ≤15 NAMED-import
set (`react/typescript/nextdotjs/tailwindcss/nodedotjs/python/graphql/go/postgresql/supabase/prisma/
docker/vercel/cloudflare`) covering the founder's Tools stack. NAMED individual imports only (the
tree-shaking guarantee — a namespace/barrel import is forbidden); a slug absent from the map renders no
logo (the skill name + bar still render). Zero client JS (Server-Component `<svg><path d></svg>`).

**Stripped / dropped decisions (confirmed shipped):**
- **`ThemeToggle` DROPPED** (D-06 dark-only) — `index.tsx` injects `themeInitScript('dark')` + hardcodes
  `data-template-theme="dark"` and does NOT import/mount the kit `ThemeToggle` (the single structural
  deviation from minimal/aurora; the kit toggle stays intact for the other templates).
- **`cmdk` CommandPalette DROPPED** (D-07) — pointless on a single scroll; not carried in, not installed.
- **`services` / `blog_preview` DEFERRED → 13.2** (D-01) — `supported:false` in `spec.ts`.
- **The 2 sanctioned `dangerouslySetInnerHTML` producers ONLY** survive (`themeInitScript` FOUC guard +
  `personLdScriptHtml` JSON-LD); the export's danger-html (chart.tsx) + inline-handler (error-page) +
  external-origin (data layer) + external-font-origin (runtime Google-Fonts link) must-strips are all gone
  with the stripped files (fonts self-hosted via `next/font/google` in `edgerunner/fonts.ts`).
- **`framer-motion` DROPPED** — the entrance reveals are the kit `ScrollReveal`; the CSS synthwave layer
  (`@keyframes tmpl-edgerunner-*`) replaces the decorative motion; the kept effects (PowerOnFlash +
  CursorTrail) are re-authored zero-install (CSS/rAF) in `edgerunner/effects.tsx` (Plan 13-04 Task 3).

## Dependency Decisions

**The Task-1 (13-01) `ingest:scan` surfaced 186 advisory unknown-dependency FLAGs** (the export's
TanStack-Start + MDX + Radix/shadcn graph — they do NOT block; the OUTPUT `gate:security` re-asserts on
the translated template). The entire framework/data/admin/blog dependency graph is STRIPPED by
translation. The rich-lane WebGL triple was the ONLY new install (Task 1, behind the founder-approved
blocking-human legitimacy gate).

### Installed (Task 1 — verified legitimate, on the D-15 allowlist)

Legitimacy substitute for slopcheck (unavailable): **3 corroborations** — (1) registry resolve
(`npm view`), (2) D-15 allowlist membership (`scripts/template-allowlist.ts:46-49`), (3) the export's
OWN lockfile pins. React stayed **19.2.6** post-install (no transitive bump; R3F v9 peer is
`react >=19 <19.3` — Pitfall 1).

| Dependency | Installed pin | Export pin | Legitimacy | Allowlist |
|------------|---------------|------------|------------|-----------|
| `three` | `0.184.0` (exact) | `^0.184.0` | registry resolves → github.com/mrdoob/three.js | on `ALLOWED_IMPORT_SPECIFIERS` (D-15) |
| `@react-three/fiber` | `9.6.1` (exact) | `^9.6.1` | registry resolves → github.com/pmndrs/react-three-fiber | on the allowlist (D-15) |
| `@react-three/drei` | `10.7.7` (exact) | `^10.7.7` | registry resolves → github.com/pmndrs/drei | on the allowlist (D-15) |

**React baseline:** `react@19.2.6` / `react-dom@19.2.6` — **unbumped** (`npm ls react` deduped to 19.2.6
everywhere; the at-the-upper-edge R3F v9 peer is satisfied, Pitfall 1).

### Deliberate ZERO-installs (translated away, not carried)

| Export dependency | Export pin | Decision | Rationale |
|-------------------|------------|----------|-----------|
| `motion` | (absent) — export uses `framer-motion@^12.40.0` | **NOT installed** (zero Motion default) | CSS-first / kit `ScrollReveal` covers the entrance reveals + decorative loops (aurora precedent, D-06). bare `framer-motion` is deliberately unallowlisted (D-07). Motion returns ONLY through this SAME human-verify checkpoint if a later plan proves the `CursorTrail` spring genuinely needs it. |
| `react-icons` | `^5.6.0` | **rejected → simple-icons** | brand logos translate to the in-repo `simple-icons` `.path` server-render pattern (zero client JS). `react-icons` is NOT allowlisted. |
| `cmdk` | `^1.1.1` | **rejected (dropped)** | the `CommandPalette` is a multi-page nav affordance — pointless on a single scroll (D-07). |
| `@tanstack/react-start` / `@tanstack/react-router` / `@tanstack/router-plugin` | `^1.167.x` | rejected | TanStack-Start server entry + file routing — no place in a single RSC root (see the playbook's additive strip note). |
| `nitro` | `3.0.x-beta` (devDep) | rejected | the export's server/build runtime — irrelevant under Next 16. |
| `@mdx-js/react` / `@mdx-js/rollup` / `shiki` / `@shikijs/rehype` / `remark-*` | various | rejected (→ 13.2) | the MDX blog chain — OUT by D-01; the blog engine is deferred to 13.2 (sanitized HTML, NOT MDX). |
| `@radix-ui/*` (30 packages) / `@hookform/resolvers` / `react-hook-form` / `@tanstack/react-query` / `vite` / `@tailwindcss/vite` / shadcn utils | various | rejected | shadcn/Radix primitives + the data/admin/form/Vite-build layer — stripped (D-17 two-layer isolation; the data layer carries any creds, D-14). |

**Net new installs:** the 3 rich-lane deps ONLY. `gate:security` (D-13/14) will re-assert on the OUTPUT —
no unvetted/unallowlisted import specifier may survive into `src/components/templates/edgerunner/`.

## Security Findings (ingest:scan must-strip — to be eliminated by translation)

The TanStack-Start export tripped **13 must-strip findings** (the Tier-1 strip list — must-strips are
eliminated by translation, NOT a blocker to the ship; the scan exits non-zero on the RAW input by
design). Breakdown: **9 external-origin**, **2 external-font-origin**, **1 danger-html**, **1
inline-handler**. Disposition for ALL: **eliminated by translation downstream**; the OUTPUT
`gate:security` (run in the gate plan) confirms ZERO survive into `edgerunner/**`.

| Rule | Count | Representative file(s) | Disposition |
|------|-------|------------------------|-------------|
| `external-origin` | 9 | `src/data/socials.ts` (5), `src/data/projects.ts` (2), `src/components/layout/AmbientOverlays.tsx` (1), `src/styles.css` (1) | external image/link origins — the `src/data/*` layer is STRIPPED (the template reads only null-guarded `PortfolioData`; images come from a Storage origin or none); the decorative overlay's external ref is re-authored as scoped CSS. **Eliminated by translation.** |
| `external-font-origin` | 2 | `src/styles.css` (the runtime Google-Fonts `@import`/`<link>`) | the runtime Google-Fonts CDN origin → converted to build-time `next/font/google` self-host in `edgerunner/fonts.ts` (D-16); zero runtime font request. **Eliminated by translation.** (T-13-01-ORIGIN) |
| `danger-html` | 1 | `src/components/ui/chart.tsx` (shadcn/recharts) | the shadcn chart component is part of the admin/shadcn layer — NOT carried into the template. edgerunner's RSC root keeps ONLY the ONE sanctioned `themeInitScript` danger-html (FOUC guard). **Eliminated by translation.** (T-13-01-XSS) |
| `inline-handler` | 1 | `src/lib/error-page.ts` (an `on<word>=` in an error-page HTML string) | the SPA error-page string is part of the framework/data layer — stripped. The template has no inline HTML handlers. **Eliminated by translation.** |

**No `hardcoded-secret` / `eval-new-function` must-strips** were found (the data layer carrying any
`VITE_*`/secret is stripped regardless — T-13-01-SECRET; `gate:security` re-asserts on the output).
**No MDX must-strips reached the scan as code** — the MDX blog chain is OUT by D-01 (T-13-01-MDX) and is
never carried into the template.

## Async-Island Cap — RESERVED (Plan 13-02..)

The rich-lane Scene chunk (`three` + R3F + drei) is the heavy `{ssr:false}` import the async-island
sanity cap measures. RESEARCH §1 measured ~**235.4 kB gz** via esbuild and recommends raising
`ASYNC_ISLAND_CAP_BYTES` to **320 kB gz** (measured floor + ~36% headroom; still well under the D-05
~350 ceiling). The MANDATORY verify-on-real-build task (read the ACTUAL gzipped Turbopack chunk from
`.next/`) lands in a downstream plan.

| Field | Value |
|-------|-------|
| measured (esbuild, RESEARCH §1) | ~235.4 kB gz (three core dominates; drei helpers ~0.5 kB) |
| recommended `ASYNC_ISLAND_CAP_BYTES` | 320 × 1024 (320 kB gz) — tune after the real `.next/` chunk is read |
| REAL Turbopack chunk (`.next/`) | **RESERVED** — fill from the post-build measurement |
| public First Load JS (must hold ≤ 200 kB gz) | **RESERVED** — confirm via `check:bundle` that edgerunner did not raise it (standard-lane baseline 156.7 kB gz) |

## Parity — RESERVED (Plan 13-02..)

Source-parity is expected **DEFERRED** for edgerunner (the export is a multi-page TanStack-Start app
collapsed to a single scroll — exactly the aurora precedent; ship a self-baseline golden only). The
animated WebGL canvas is captured deterministically under emulated `prefers-reduced-motion` (the Phase-8
harness static-first-frame). The frozen-frame-vs-masked-canvas choice (RESEARCH §4) is recorded here once
made.

| Field | Value |
|-------|-------|
| self-baseline `maxDiffPixelRatio` | `0.01` (global) — `edgerunner-golden.png` |
| capture approach (frozen-frame vs masked canvas) | **RESERVED** — try frozen-frame first; mask the canvas only if it flakes >0.01 (RESEARCH §4) |
| source-parity | expected **DEFERRED** (SPA/multi-page → single-scroll; self-baseline only) — confirm at gate |

## Migration & Seed — APPLIED (Plan 13-05)

`015_seed_edgerunner_template.sql` was applied FORWARD-ONLY (`npx supabase migration up --local`, never
`db reset`) and asserted against the live local stack. The data-only seed runs in the load-bearing
grant-THEN-switch order (T-13-05-ORDER): INSERT edgerunner …0004 (restricted) → grant the founder
(derived from the portfolio on minimal, never a hardcoded username) → switch the founder's portfolio off
minimal → flip minimal → public.

| Assertion (post-apply) | Result |
|------------------------|--------|
| exactly ONE `templates` row id …0004, slug `edgerunner`, visibility `restricted` | ✅ |
| founder's portfolio `template_id` now …0004 (ZERO portfolios remain on …0001, A6) | ✅ |
| `template_grants` row for (…0004, founder user_id) present | ✅ |
| `minimal` visibility now `public` | ✅ |
| `tsx scripts/seed-founder-portfolio.ts` re-run clean (self-heal grant + metrics + skills.level through `validateSectionContent`) | ✅ |

**No `database.ts` regen — A3 confirmed.** 015 is data-only (INSERT/UPDATE on existing tables; no new
column or table), so the generated `src/types/database.ts` read types are unchanged — exactly the 010
aurora precedent. `supabase gen types` was deliberately NOT run; `git status src/types/database.ts` shows
no change.

**Seed-revert bug fixed (Rule 1, T-13-05-SPILL).** The seed's blind portfolio UPSERT (`SET template_id =
minimal`) reverted the migration's founder→edgerunner switch on every re-run. Fixed: the seed now preserves
the live `template_id` on an existing portfolio (refresh `updated_at` only) and sets `minimal` ONLY when
creating the portfolio fresh. Verified idempotent: re-running the seed keeps the founder on edgerunner …0004.

## Gate Results — RESERVED (Plan 13-07 umbrella)

`npm run gate:template -- edgerunner` (the CICD-01 umbrella: tsc → static → build → render) is run by the
downstream gate plan; the all-green table + the local migration-applied / thumbnail records are filled
there (mirroring `aurora/INGEST-MANIFEST.md`).
