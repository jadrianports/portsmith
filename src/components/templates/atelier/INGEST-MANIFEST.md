# Ingest Manifest — atelier

**Source:** Lovable export (committed under `lovable-exports/atelier/` — the D-02 human-sourced gate, Plan 36-01)
**Ingested:** 2026-06-24 · **Operator:** James (jadrianports) · **Lane:** standard (faithful clone)
**Slug:** `atelier` · **UUID:** `00000000-0000-4000-8000-000000000006` · **Migration:** `supabase/migrations/032_seed_atelier_template.sql`

> The auditable curation record for the gallery-forward creative template (v2.8 "Show the Work",
> Phase 36). A human-sourced **dark-editorial** Lovable export ingested 1:1 into the public template
> `atelier` — a FAITHFUL CLONE (the same posture as `edgerunner-v2`): the export's exact look (layout,
> spacing, oversized Bebas type, near-black canvas + acid-green accent, film grain, sharp corners) is
> reproduced; only the SPA chrome / danger surface is stripped. The export's three image-specific
> renderers (`gallery`/`case_study`/`moodboard`) are hand-authored against the scoped tokens.

## Section Map

The export's single-page composition maps onto the closed soft-enum set. The 5 normal sections are
ingested 1:1; the 3 image-specific types are hand-authored; the export's extra visual vocabulary
(Services / Experience / Journal) is NOT part of the supported set (atelier is image-first, D-10).

| Lovable section (export) | Soft-enum type   | Disposition | Rationale |
|--------------------------|------------------|-------------|-----------|
| Hero                     | `hero`           | mapped 1:1  | full-bleed masthead + oversized Bebas headline + lede |
| About                    | `about`          | mapped 1:1  | 12-col portrait/copy spread |
| SelectedWork             | `projects`       | mapped 1:1  | the CSS-columns "wall" — caption-under-image masonry |
| Testimonials             | `testimonials`   | mapped 1:1  | "Words" hairline-grid quote panels |
| Contact                  | `contact`        | mapped 1:1  | oversized headline + mailto + studio/elsewhere + LIVE form |
| Footer/Nav/Grain         | footer + chrome  | converted   | footer ingested 1:1; Nav dropped (SPA chrome); Grain = scoped `.tmpl-grain` |
| (CaseStudies, hand-authored) | `case_study` | hand-authored | stacked narrative + a COMPACT distinct image grid (D-11/D-12) |
| (gallery, hand-authored)     | `gallery`    | hand-authored | native-aspect CSS-columns masonry, CLS-safe, no crop (D-07/D-08/D-14) |
| (moodboard, hand-authored)   | `moodboard`  | hand-authored | mirror of aurora's captioned tiles + hex-validated palette |
| Services / Experience / Journal | —         | not supported | the export's extra vocabulary; `supported:false` (D-10 — atelier is image-first) |
| skills / education / metrics / certifications / blog_preview | — | not supported | `supported:false` (D-10) |

**Result:** 8 supported `[data-section-type]` sections render in atelier's RSC root:
`hero, about, gallery, case_study, projects, testimonials, contact, moodboard`. 7 declared
unsupported (skills, experience, education, metrics, services, certifications, blog_preview).

## Theme (D-05 — DARK-ONLY, no ThemeToggle)

The export ships **dark as the only canvas** — no light mode, no toggle in its Nav. `theme.css`
declares ONE `.tmpl-atelier` block (no `[data-template-theme='dark']` inversion) and `index.tsx`
does **NOT** mount the `_kit` ThemeToggle. Atelier ships exactly what the export ships.

| Token | Value (from `lovable-exports/atelier/src/styles.css`) |
|-------|-------|
| `--bg` | `#0a0a0b` (near-black) |
| `--surface` | `#0d0d0f` · `--surface-muted` `#141417` |
| `--fg` | `#f2f2f0` · `--muted-fg` `#8a8a86` |
| `--border` | `rgba(242,242,240,0.08)` · `--border-strong` `rgba(242,242,240,0.12)` |
| `--accent` | `#c8ff00` (acid green) · `--accent-fg` `#0a0a0b` · `--ring` `#c8ff00` |
| `--destructive` | `#ff4d3d` · `--success` `#5fcf93` (added — export has none) |
| radius | `0` (sharp) for sm/md/lg; `--radius-full` `9999px` |
| fonts | display = **Bebas Neue**; body = **Archivo** (Inter is chrome-forbidden — substituted); mono = Space Mono (required token; export has none) |

## Dependency Decisions

**Zero install.** The kit `ScrollReveal` + scoped CSS cover all animation; the masonry is native CSS
`columns` (no `react-photo-album`). `framer-motion` / `react-router` / `@tanstack/react-query` /
`@radix-ui/*` / `recharts` / shadcn utilities are all stripped during the faithful-clone translation.
`package.json` is unchanged. `gate:security` re-asserts on the OUTPUT — no unvetted specifier survives
into `src/components/templates/atelier/`.

## Security Findings (lovable-ingest must-strip)

| Rule | Resolution |
|------|------------|
| `external-origin` (bundled `@/assets/*.jpg`) | re-hosted to null-guarded Storage-origin `PortfolioData` reads (the seed/fixture supplies a Storage-origin URL or none); every tile filters via `isHttpImageSrc` |
| `danger-html` (`src/components/ui/chart.tsx`) | stripped — the shadcn/recharts admin chart is not in the translated template. atelier's RSC root keeps ONLY the TWO sanctioned `dangerouslySetInnerHTML` (`themeInitScript` FOUC + `personLdScriptHtml` JSON-LD) |
| `external-font-origin` (runtime Google Fonts `<link>`) | converted to `next/font/google` build-time self-host in `atelier/fonts.ts`; zero runtime font request |

**T-36-04 / T-36-05 / T-36-08 mitigations confirmed:** no carried-over danger-html (only the two
sanctioned scripts); every image src filtered by `isHttpImageSrc` (Storage-origin only); the entire
tree is RSC (zero `'use client'`) — only the `_kit` islands cross to the client.

## Files

**16 atelier files:** `index.tsx`, `spec.ts`, `theme.css`, `fonts.ts`, `INGEST-MANIFEST.md`,
`sections/{types,shared}.ts`, `sections/{hero,about,projects,testimonials,contact,footer}.tsx`
(ingested 1:1), `sections/{gallery,case-study,moodboard}.tsx` (hand-authored).

**~7 registration surfaces:** `registry.ts` (templateRegistry + specRegistry + TEMPLATE_UUIDS),
`template-meta.ts`, `e2e/helpers/slugs.ts`, `e2e/template-conformance.spec.ts`,
`scripts/generate-template-thumbnails.mjs`, migration `032`.

## Parity

Source-parity is **DEFERRED** for atelier (like aurora/minimal/editorial). atelier ships on its own
committed golden SELF-baseline only; the source-parity case stays file-existence-guarded and SKIPPED
until a `<slug>-source.png` is committed.
