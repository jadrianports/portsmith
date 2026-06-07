# Edgerunner — Faithful Synthwave Clone (Design)

**Date:** 2026-06-07
**Branch:** `feat/edgerunner-faithful-clone`
**Author:** James (jadrianports) + Claude
**Status:** Awaiting review → writing-plans

---

## 1. Problem

The `edgerunner` template was supposed to be a faithful 1:1 clone of the Lovable export at
`lovable-exports/synthwave-founder/`. GSD's `lovable-ingest` skill instead **rebuilt each
section in `minimal`'s shape and painted synthwave color tokens on top.** Proof, from the
Hero alone:

| Export `Hero.tsx` | Shipped `edgerunner/sections/hero.tsx` |
|---|---|
| 2-col grid: text left, **`<TerminalCard/>` HUD** right | single-column left-aligned text only |
| **`<CityScene/>`** city image + 6 neon beams + sun glow | generic CSS sun/grid wash |
| no WebGL in the hero | a **bolted-on `<HoloShape/>` WebGL blob GSD invented** |
| contact pills + social row | dropped |
| Tailwind utilities on `@theme` tokens | hand-written inline `style={{}}` everywhere |

The skill threw away every component that *is* the design — `TerminalCard`, `CityScene`,
`GlowCard`, `TiltCard`, `NeonButton`, `MagneticButton`, `TechMarquee`, `AnimatedSun`,
`NeonDivider`, `SectionHeading`, the sticky `Navbar`, the 3-col `Footer` — kept the palette
and fonts, and reskinned `minimal`. Root cause: the skill's `translation-playbook.md` tells
the agent to *"follow `minimal/index.tsx` as the canonical output shape."*

## 2. Goal

A **faithful 1:1 visual clone** of the synthwave export, **driven by `PortfolioData`** (CMS
content, not the export's hardcoded `src/data/*`), that **conforms to the Portsmith template
contract** (RSC-first, scoped `.tmpl-edgerunner` tokens, null-guards, security gates, SSG/ISR).

Translate the **data layer, security, and design-token vocabulary** — reproduce the **visual
composition, layout, and motion** exactly.

## 3. Locked decisions (from review)

1. **Max fidelity.** Port the export's real components & layouts. Bring in `motion` (the
   allowlisted framer-motion rebrand) for the animations; carry the interactive islands.
2. **Rebuild `edgerunner` in place.** Keep all wiring (slug, UUID `…0004`, migration 015,
   seed, founder switched onto it, registry). Replace only the visual layer.
3. **Clone by hand now; fix the skill after** (§11), using this clone as the worked example.
4. **Drop the WebGL.** The export's hero is `TerminalCard` + `CityScene` — `HoloShape` is dead
   code in the export, never rendered. Remove `Scene.tsx` / `HoloShape.tsx` and the rich-lane
   apparatus; uninstall `three` / `@react-three/fiber` / `@react-three/drei`.
5. **Include the Navbar + Footer** chrome (sticky neon nav with scroll-spy + 3-col footer).

## 4. Architecture

### 4.1 Kept untouched (the wiring)
- `edgerunner/spec.ts` — 7 supported types (`hero, about, metrics, experience, projects,
  skills, contact`); `services`/`blog_preview` stay `supported:false`.
- `edgerunner/fonts.ts` — Orbitron (display) · Space Grotesk (body) · VT323 (mono). Already
  the export's exact fonts, self-hosted via `next/font/google`.
- Registry/UUID/meta wiring in `registry.ts` + `template-meta.ts` (slug `edgerunner`, UUID
  `00000000-0000-4000-8000-000000000004`).
- Migration `015_seed_edgerunner_template.sql` + the seeded founder content (already applied).
  The seed's `skills.level` + `metrics` data stays; we render it faithfully.
- Dark-only posture (D-06): hardcoded `data-template-theme="dark"`, no `ThemeToggle`.

### 4.2 Dependencies
- **Add** `motion` (the allowlisted modern line; `import { motion, AnimatePresence, useScroll,
  useTransform, useSpring, useMotionValue, useReducedMotion } from 'motion/react'`). The
  export's `framer-motion` imports become `motion/react` — same API. This is the
  founder-approved legitimacy-checkpoint install.
- **Remove** `three`, `@react-three/fiber`, `@react-three/drei` (WebGL dropped).
- **Keep** `lucide-react` (allowlisted; the export's icon set) and `simple-icons` (brand logos
  via `.path`, reusing `edgerunner/sections/icons.ts`). The export's `react-icons/si` brand
  imports translate to the `simple-icons` pattern (already done once; extend the curated set).

### 4.3 Server / client split
- **RSC root** (`index.tsx`): server component. Renders the decorative backdrop layers
  (CityScene image + CSS beams/sun/grid, AmbientOverlays) and composes the sections. No
  `motion` import at the root.
- **Section wrappers**: keep `<ScrollReveal as="section" data-section-type="<type>">` (satisfies
  the per-section conformance gate's `data-section-type` requirement and gives a reduced-motion
  fade-up + no-JS visible fallback). Hero keeps `priority` (LCP, zero entrance motion).
- **Intra-section choreography**: `motion/react` *inside* sections for the signature animation
  the kit can't express — staggered card reveals, `TiltCard`, `MagneticButton`, the `AnimatedSun`,
  `CityScene` beam pulses, the `Tools` SVG gauges, `TechMarquee`, the `TerminalCard` typing, the
  `NeonDivider` scale-in. Sections that use `motion` become `'use client'` (allowed — custom
  client islands already exist via `effects.tsx`; only the dep allowlist + budget constrain us).
- **Existing islands kept**: `effects.tsx` (PowerOnFlash CRT boot + CursorTrail, reduced-motion +
  pointer-coarse gated, CSS/rAF, zero animation-lib). Add a small **scroll-spy** island for the
  Navbar active-link highlight.
- **Reduced motion is mandatory** on every animated element (`useReducedMotion()` + CSS
  `@media (prefers-reduced-motion: reduce)` resets in `theme.css`). The export already respects
  it in `AnimatedSun`; we extend the discipline everywhere (a11y gate = axe serious/critical 0,
  no >3 flashes/sec).

### 4.4 Bundle budget — KNOWN RISK
Making sections client + adding `motion` (~30–40 kB gz) grows First Load JS from the current
164.4 kB baseline. Budget is **≤200 kB gz**. Mitigation, in order:
1. Dropping the WebGL frees the rich-lane weight and removes the async-island-cap apparatus.
2. `motion/react` is tree-shakeable; import only what's used.
3. Keep purely-decorative loops (sun, beams, grid, scanlines, marquee) as **CSS `@keyframes`**,
   not `motion` — they need no JS. Reserve `motion` for scroll/pointer-driven and stagger work.
4. **Measure on a real `next build`** (the plan's gate). If over budget, downgrade the least
   essential `motion` usages to CSS until under. Fidelity priority order if forced to cut:
   keep TiltCard / TerminalCard / gauges / nav scroll-spy; CSS-ify ambient loops first.

## 5. Component port plan

Export → Portsmith. "Faithful" = reproduce layout/structure/motion; "data" = the
`PortfolioData` source replacing the export's `src/data/*`.

| Export component | New Portsmith file | Fidelity notes | Data source |
|---|---|---|---|
| `Hero` (2-col + TerminalCard + CityScene) | `sections/hero.tsx` + `sections/terminal-card.tsx` + decorative in `index.tsx`/theme.css | full 2-col port; name flicker; status dot; CTA + résumé buttons (NeonButton) | hero `content` (heading/subheading/cta_*/resume_url); profile fallback (display_name/headline/resume_url) |
| `CityScene` | decorative in `index.tsx` + `theme.css` keyframes | city image (Storage or bundled asset — see §7), 6 CSS/motion neon beams, sun-glow pulse, scanline sweep | none (decorative) |
| `TerminalCard` | `sections/terminal-card.tsx` (client) | window dots + `~/portfolio — zsh` + typed lines + progress bar; conic spin border | derived from public profile + metrics (real data as terminal output) |
| `About` (portrait + bio + stats) | `sections/about.tsx` | 2-col: holo portrait left, bio right. Stats band → rendered by the separate **Metrics** section placed immediately after (see §6) | about `content` (bio/avatar/avatar_alt) |
| `Experience` (timeline + highlights) | `sections/experience.tsx` | vertical neon spine, alternating cards, node markers, **highlight bullets** | experience `content.items` + new optional `highlights[]` (§6) |
| `Projects` (tilt cards + modal) | `sections/projects.tsx` (client) | 3-col `GlowCard`+`TiltCard` grid; click → `AnimatePresence` modal | projects `content.items` (title/description/image/tech_stack/live_url/repo_url); modal reuses `description` |
| `Tools` (circular gauges) + `TechMarquee` | `sections/skills.tsx` (client) | **circular SVG gauges** (not bars) animating `strokeDashoffset` from `level`; the infinite-scroll `TechMarquee` strip below | skills `content.groups[].items[]` (name/icon/level) |
| `Services` | — | stays `supported:false` (deferred, multi-page). Not rendered. | — |
| `BlogTeaser` | — | stays `supported:false` (deferred). Not rendered. | — |
| `Contact` (Direct Lines + form) | `sections/contact.tsx` | "Direct Lines" panel + the spinning conic-border **wrapping the real `<ContactForm>`** island (not the export's fake form) | contact `content` + settings `email_public`; `<ContactForm>` reads `section.portfolio_id` |
| `Navbar` (sticky, scroll-spy) | `sections/navbar.tsx` (client) | sticky neon pill nav, logo badge, anchor links, scroll-spy active highlight. Drop the cmdk hint (CommandPalette dropped, D-07) | section list (derived from rendered sections) |
| `Footer` (3-col) | `sections/footer.tsx` | logo+tagline / quick links / channels(socials+email). Replace example socials with real data or omit when absent | profile + settings |
| `CommandPalette` | — | **dropped** (D-07 — multi-page affordance, pointless single-scroll) | — |
| `NeonDivider`, `SectionHeading`, `GlowCard`, `NeonButton`, `MagneticButton`, `TiltCard` | `sections/ui/*.tsx` (shared) | port 1:1; `motion`-based ones are client | — |
| `AmbientOverlays` (Noise/Scanline/Grid/Blobs) | decorative in `index.tsx` + `theme.css` | CSS filters/gradients; NeonBlobs parallax via `motion` `useScroll` (client) or CSS-only if budget tight | none |
| `AnimatedSun` | decorative in hero/`theme.css` | breathing sun + orbiting sparks; CSS keyframes preferred (budget) | none |
| `PowerOnFlash`, `CursorTrail` | `effects.tsx` (kept) | already faithful, reduced-motion + pointer gated | none |
| `HoloShape`, `Scene.tsx` | **deleted** | WebGL dropped (decision 4) | — |

## 6. Data mapping & schema additions

The export's `src/data/*` is **stripped** (untrusted; carries example.com/external origins).
Content comes only from `PortfolioData`. Soft-enum additions are **Zod-only, no migration**
(CMS-08), following the `skills.level` precedent.

- **Hero** ← `hero` content. `heading`→name (Orbitron, neon-gradient, flicker),
  `subheading`→role/tagline, `cta_text`/`cta_url`→primary NeonButton (default `#contact`),
  `resume_url`→"Download CV" ghost button. **No email/phone/location pills** — `public_profiles`
  doesn't expose them; those live in Contact. Status dot ("Available for work") is static copy.
- **TerminalCard** — decorative; lines composed from public data (display_name, headline,
  metrics values) so it reads real, not faked.
- **About** ← `about` content: `bio`, `avatar`/`avatar_alt` (holo portrait). The export's
  in-About stat grid is rendered by the **Metrics** section placed right after About, styled as
  the export's stat band (so it reads visually identical to the export's "About + stats").
- **Metrics** ← `metrics` content (`items[]` value/label/icon) — already seeded.
- **Experience** ← `experience` content. **ADD optional `highlights: string[].max(8)` per item**
  (Zod-only) so the export's highlight bullets render. Items without it just show description.
- **Projects** ← `projects` content `items[]`. Cards show `tech_stack` badges; modal shows
  `description` (no separate `long_description`/`tags` — keep schema lean, matches manifest A4).
- **Skills** ← `skills` content `groups[].items[]` with `level` (0–100) → circular gauges;
  `icon` → `simple-icons` path. TechMarquee strip is the flattened skill names.
- **Contact** ← `contact` content + `email_public`. Real `<ContactForm>` island when
  `section.portfolio_id` present; mailto fallback otherwise (exact aurora pattern).
- **Footer/Navbar** ← profile (display_name/username) + settings. Socials: render only what
  real data provides; the export's hardcoded example socials are dropped.

**Schema-change checklist** (in `src/lib/validations/sections.ts`, then regenerate types if a
read type changes — it won't, content is JSONB):
- `experience` item: add optional `highlights: z.array(z.string().max(200)).max(8).optional()`.
- Confirm `skills` item `level` (0–100 optional) already present (edgerunner added it).
- No new section `type`. No Postgres migration.

## 7. Assets
- The export's hero uses `src/assets/hero-city.jpg` (1920×1088). Options: (a) bundle it as a
  static template asset (`public/templates/edgerunner/…` or import via `next/image`), or
  (b) reproduce the city band purely in CSS. **Recommendation:** bundle the image as a template
  static asset and render via `next/image` (allowlisted) — it's the export's actual backdrop and
  CSS can't reproduce the skyline. Verify it carries no licensing problem (Lovable-generated).
  Confirm during planning.

## 8. theme.css (`.tmpl-edgerunner`, dark-only)
- All **18 REQUIRED_TOKENS** scoped to `.tmpl-edgerunner` (`--bg --surface --surface-muted --fg
  --muted-fg --border --border-strong --accent --ring --success --destructive`; radius
  `--radius-sm/md/lg/full`; the three `--font-*` come from `fonts.ts` `variable:`).
- Synthwave palette ported from the export's `styles.css` (oklch neons: pink/magenta/cyan/
  purple/yellow, deep `--bg-deep`), mapped onto the required token names + template-private
  extras (`--neon-pink` etc., `--gradient-neon`, `--gradient-sky`, `--shadow-neon-*`).
- Keyframes ported (scoped, `tmpl-edgerunner-` prefixed): `flicker`, `neon-pulse`, `float`,
  `grid-scroll`, `scanline`, `marquee`, `spin`. Utility classes the sections use
  (`text-glow-*`, `holo-panel`, gradient utilities) as scoped classes — **no chrome tokens, no
  Inter, no hardcoded hex in JSX.**
- `.tmpl-reveal` / `.tmpl-load-reveal` styling (kit fade) + `.tmpl-contact-field` (the form
  field hooks the shared `<ContactForm>` reads) with the neon focus ring.
- `@media (prefers-reduced-motion: reduce)` blanket reset zeroing every decorative animation.

## 9. Contract & security compliance (non-negotiable)
- Null-guard every `PortfolioData` field; cast `content` per type; `present()` predicate;
  hide-if-empty.
- URLs through `safeHref` (scheme allowlist); images through the Storage-origin guard +
  `next/image`.
- Only the **2 sanctioned `dangerouslySetInnerHTML`** producers: `themeInitScript('dark')` +
  `personLdScriptHtml`. Nothing else.
- No external script/font/style origins (fonts self-hosted; the export's runtime Google-Fonts
  `@import` is NOT carried). No inline handlers, no `eval`. Deps ⊆ allowlist.
- `/[username]` stays ● SSG/ISR — no `cookies()`/`headers()`/host read on the public branch.
- Scoped `.tmpl-edgerunner` tokens only; the isolation + token-conformance gates must pass.

## 10. Verification (acceptance bar = the existing gates, unchanged)
- `npm run gate:template -- edgerunner` umbrella green: `tsc --noEmit` → `gate:security` →
  `gate:isolation` + token-conformance → `gate:registry` → `next build` → `check:bundle`
  (≤200 kB First Load JS + ● SSG/ISR) → `gate:conformance` (7 sections render 1:1 on full +
  all-null, no null leak) → `gate:a11y` (axe 0 serious/critical, reduced-motion, no flash) →
  `gate:parity` (regenerate `edgerunner-golden.png` self-baseline; WebGL gone → simpler capture).
- `tests/integration/templates/lossless-switch.test.ts` green (skills.level + metrics survive a
  round-trip switch byte-identically) against the live local Supabase stack.
- `tests/unit/templates/edgerunner-rsc-root.test.ts` — update/retire (it currently asserts the
  RSC root imports no `three`/R3F; still true after deletion, but the test's premise around the
  WebGL boundary should be revised).
- Regenerate the thumbnail (`scripts/generate-template-thumbnails.mjs`) — the look changed.
- Manual UAT via Playwright MCP (authed) against the founder's live local page on edgerunner.

## 11. Follow-up: fix the `lovable-ingest` skill (after the clone is green)
Root cause is `references/translation-playbook.md` instructing *"follow `minimal/index.tsx` as
the canonical output shape."* Rewrite it so a faithful ingest **ports the export's actual
component tree and layout**, translating only: (a) the data layer → `PortfolioData` soft-enum
mapping, (b) security (strip data/admin, external origins, danger-html, secrets), (c) the
design-token vocabulary → scoped `.tmpl-*`, (d) `framer-motion`→`motion/react`,
`react-icons`→`simple-icons`, runtime fonts→`next/font`. Use this edgerunner rebuild as the
worked example. Out of scope for this branch's core; a separate commit at the end.

## 12. Out of scope
- `services` / `blog_preview` sections (deferred → a later phase).
- The export's blog engine, `/services` page, TanStack-Start/Nitro/MDX (all stripped).
- Any change to other templates (minimal/editorial/aurora) or the chrome layer.
- Renaming the `edgerunner` slug (cheap later if wanted; not now).
