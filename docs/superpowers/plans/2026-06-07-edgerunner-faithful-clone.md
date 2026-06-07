# Edgerunner Faithful Synthwave Clone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `edgerunner` template's visual layer as a faithful 1:1 clone of the `lovable-exports/synthwave-founder/` export, driven by `PortfolioData` and conforming to the Portsmith template contract.

**Architecture:** Keep all existing wiring (slug `edgerunner`, UUID `…0004`, migration 015, seed, registry, `fonts.ts`). Delete the invented WebGL lane. Port the export's real components (TerminalCard, CityScene, GlowCard/TiltCard/NeonButton/MagneticButton, circular skill gauges, TechMarquee, NeonDivider, sticky Navbar, 3-col Footer) using `motion/react` for enhancement and the kit `ScrollReveal` for no-JS-safe entrance. Bind every component to `PortfolioData` soft-enum content.

**Tech Stack:** Next 16 RSC, `motion/react` (new dep), `lucide-react`, `simple-icons`, Tailwind v4 layout utilities + scoped `.tmpl-edgerunner` tokens, `next/image`, kit `ScrollReveal`.

**Spec:** `docs/superpowers/specs/2026-06-07-edgerunner-faithful-clone-design.md`

---

## Global Transformation Rules (applied to EVERY export-component port)

When a task says "port `<export file>` → `<dest file>` applying the Transformation Rules", it means apply ALL of these. They are the DRY algorithm; do not restate per task.

- **R1 — Import swaps:** `import { motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValue, useReducedMotion } from "framer-motion"` → `from "motion/react"`. `lucide-react` icons stay. `react-icons/si|fa6` brand logos → the `TECH_ICONS` / `simple-icons` `.path` pattern in `edgerunner/sections/icons.ts` (extend the curated set; a slug absent from the map renders no logo). NEVER `import * from`.
- **R2 — Data binding:** delete every `import { profile|projects|experience|services|tools|socials } from "@/data/*"`. The component receives `SectionProps = { section: PublicSection | undefined }` (decorative components receive no data). Cast `section.content` to the matching `*Content` type from `@/lib/validations`, null-guard it, return `null` if absent. See the Data Map below for the exact field-to-field mapping per section.
- **R3 — Token vocabulary:** every color/font/radius/shadow value reads a scoped `var(--token)` defined in `edgerunner/theme.css`. NO hardcoded hex in JSX. NO chrome tokens (`--color-*`) or chrome font (Inter). NO Tailwind color/font utilities (Tailwind layout utilities — flex/grid/gap/spacing — are allowed).
- **R4 — Null-guards & helpers:** use `present(v)` (non-empty trimmed predicate, from `sections/shared.ts`) before rendering any text field; hide-if-empty per field. Every URL through `safeHref(url)` (and `safeHref(`mailto:${e}`, { allowMailto: true })` for mailto). Every image through `next/image` with `unoptimized` + explicit `width`/`height` + required `alt`; only Supabase Storage / same-origin (`/templates/...`) sources.
- **R5 — Motion strategy (no-JS-safe + faithful):**
  - **Section + per-card entrance** = kit `ScrollReveal` (SSR-renders visible; reduced-motion-safe; no-JS-safe). Per-card stagger = wrap each card in `<ScrollReveal as="li" delay={i * 60}>`.
  - **`motion/react`** is for ENHANCEMENT that degrades gracefully without JS only: hover tilt (TiltCard), magnetic pointer (MagneticButton), scroll-parallax (NeonBlobs), inView gauge fill, infinite loops (beams/marquee/sun) — none may hide content when JS is off (gauges render full, marquee static, terminal shows final line, tilt flat). NEVER use `initial={{opacity:0}}` on content that carries text/data.
  - Every `motion` animation calls `useReducedMotion()` and renders static when true. Decorative CSS loops are zeroed by the `@media (prefers-reduced-motion: reduce)` block in theme.css.
- **R6 — Client boundary:** a component is `'use client'` ONLY if it uses `motion/react` hooks, React state, or event handlers. Keep decorative/pure-layout pieces as Server Components. The RSC root (`index.tsx`) imports NO `motion` and NO client-only hook.
- **R7 — Security:** no `dangerouslySetInnerHTML` except the two sanctioned producers already in `index.tsx` (`themeInitScript`, `personLdScriptHtml`). No external script/font/style origins. No inline `on*=` handler strings. No `eval`/`new Function`. No secrets.

## Data Map (export content → soft-enum section content)

| Section | Reads (`*Content`) | Field mapping / notes |
|---|---|---|
| hero | `HeroContent` (+ `resume_url?`) | `heading`→name, `subheading`→role/tagline, `cta_text`/`cta_url`→primary button (default `#contact`), `resume_url`→ghost "Download CV". No email/phone/location (not in `public_profiles`). |
| about | `AboutContent` | `bio`→body, `avatar`/`avatar_alt`→holo portrait (`next/image`). |
| metrics | `MetricsContent` | `heading`/`subheading`/`items[]` (value/label/icon) → the stat band, placed right after About. |
| experience | `ExperienceContent` | `items[]` company/role/start_date/end_date/description + **new** `highlights[]` → bullet list. |
| projects | `ProjectsContent` | `items[]` title/description/image/image_alt/tech_stack/live_url/repo_url. Card→tech_stack badges; modal→description (no separate long_description/tags). |
| skills | `SkillsContent` | `groups[].items[]` name/icon/`level`(0–100) → circular gauges; `icon`→`TECH_ICONS`. Flattened names → TechMarquee strip. |
| contact | `ContactContent` (+ `email_public?`) | `heading`/`subheading` + Direct Lines + the real `<ContactForm portfolioId emailPublic>` island when `section.portfolio_id` present; else mailto fallback. |
| footer/navbar | `PortfolioData` (`FooterProps`) | profile `display_name`/`username`; nav anchors derived from rendered section types. |

Exact `*Content` field shapes: see spec §6 and `src/lib/validations/sections.ts`.

---

## Task 1: Tear down the WebGL lane + add `motion`

**Files:**
- Delete: `src/components/templates/edgerunner/Scene.tsx`
- Delete: `src/components/templates/edgerunner/HoloShape.tsx`
- Delete: `tests/unit/templates/edgerunner-rsc-root.test.ts`
- Delete: `tests/unit/templates/async-island-cap.test.ts`
- Modify: `src/components/templates/edgerunner/sections/hero.tsx` (remove the `HoloShape` import + its `<HoloShape/>` block so the tree compiles — this hero is fully rewritten in Task 9)
- Modify: `scripts/check-bundle-budget.ts` (strip async-scene discovery + Phase-13 edgerunner comments; keep `ASYNC_ISLAND_CAP_BYTES` as a nominal generic constant)
- Modify: `package.json` (add `motion`; remove `three`, `@react-three/fiber`, `@react-three/drei`)

- [ ] **Step 1: Delete the WebGL + obsolete-test files**

```bash
git rm src/components/templates/edgerunner/Scene.tsx \
       src/components/templates/edgerunner/HoloShape.tsx \
       tests/unit/templates/edgerunner-rsc-root.test.ts \
       tests/unit/templates/async-island-cap.test.ts
```

- [ ] **Step 2: Remove the `HoloShape` usage from the current hero so the tree compiles**

In `src/components/templates/edgerunner/sections/hero.tsx`, delete the line `import { HoloShape } from '../HoloShape';` and the entire `<div … ><HoloShape className="tmpl-holo" /></div>` block. (Leave the rest; the file is replaced wholesale in Task 9.)

- [ ] **Step 3: Strip the async-island-cap discovery from the bundle script**

In `scripts/check-bundle-budget.ts`, remove: the `ASYNC_SCENE_MODULE_MARKER` const, the `collectLoadableSceneChunks()` function, its call site, and the second-discovery-path block (per the reference: ~lines 358–386, 452–487, 518–519). Keep `ASYNC_ISLAND_CAP_BYTES` defined but reword its comment to be generic (no edgerunner/Phase-13 reference). The First-Load-JS ≤200 kB check and the ● SSG/ISR check stay untouched.

- [ ] **Step 4: Swap dependencies**

```bash
npm uninstall three @react-three/fiber @react-three/drei
npm install motion
```

Expected: `motion` appears in `package.json` dependencies; the three packages are gone. `react`/`react-dom` stay `19.2.6` (no transitive bump).

- [ ] **Step 5: Verify the tree compiles and the bundle script runs**

```bash
npx tsc --noEmit
```
Expected: exits 0 (no dangling `three`/`HoloShape`/`Scene` references).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(edgerunner): remove invented WebGL lane, add motion dep"
```

---

## Task 2: Add optional `experience.highlights[]` to the section schema (TDD)

**Files:**
- Modify: `src/lib/validations/sections.ts` (the experience item schema)
- Test: `tests/unit/validations/experience-highlights.test.ts` (create)
- Modify: `src/components/templates/edgerunner/spec.ts` (add `'highlights'` to experience fields)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/validations/experience-highlights.test.ts
import { describe, it, expect } from 'vitest';
import { validateSectionContent } from '@/lib/validations/sections';

const base = {
  heading: 'Experience',
  items: [{
    id: 'e1', company: 'Acme', role: 'Engineer',
    start_date: '2023-01', end_date: 'present', description: 'Built things',
  }],
};

describe('experience.highlights', () => {
  it('accepts content with no highlights (back-compat)', () => {
    expect(validateSectionContent('experience', base).success).toBe(true);
  });
  it('accepts an item with a highlights array', () => {
    const c = { ...base, items: [{ ...base.items[0], highlights: ['Shipped X', 'Led Y'] }] };
    expect(validateSectionContent('experience', c).success).toBe(true);
  });
  it('rejects more than 8 highlights', () => {
    const c = { ...base, items: [{ ...base.items[0], highlights: Array(9).fill('x') }] };
    expect(validateSectionContent('experience', c).success).toBe(false);
  });
  it('rejects a non-array highlights value', () => {
    const c = { ...base, items: [{ ...base.items[0], highlights: 'nope' }] };
    expect(validateSectionContent('experience', c).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it; verify it fails**

Run: `npx vitest run tests/unit/validations/experience-highlights.test.ts`
Expected: FAIL — the "non-array" / ">8" cases pass validation (field not yet defined / stripped), or the array case fails depending on Zod strictness.

- [ ] **Step 3: Add the optional field**

In `src/lib/validations/sections.ts`, locate the experience item object schema (fields `id, company, role, start_date, end_date, description`) and add:

```typescript
highlights: z.array(z.string().trim().min(1).max(200)).max(8).optional(),
```

- [ ] **Step 4: Run the test; verify it passes**

Run: `npx vitest run tests/unit/validations/experience-highlights.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Record the field in the spec**

In `src/components/templates/edgerunner/spec.ts`, change the experience entry's `fields` array to include `'highlights'`:

```typescript
experience: { supported: true, fields: ['company', 'role', 'start_date', 'end_date', 'description', 'highlights'] },
```

- [ ] **Step 6: Verify types + commit**

```bash
npx tsc --noEmit
git add src/lib/validations/sections.ts tests/unit/validations/experience-highlights.test.ts src/components/templates/edgerunner/spec.ts
git commit -m "feat(edgerunner): optional experience.highlights[] (Zod-only, no migration)"
```

---

## Task 3: Rewrite `theme.css` (the scoped synthwave token system)

**Files:**
- Modify (rewrite): `src/components/templates/edgerunner/theme.css`
- Reference: `lovable-exports/synthwave-founder/src/styles.css` (palette source)

Everything is scoped to `.tmpl-edgerunner`. Port the export's oklch palette and keyframes; map onto the 18 REQUIRED tokens + template-private extras; add the contact-form hooks and reduced-motion reset.

- [ ] **Step 1: Define the required tokens + synthwave palette (scoped)**

Write the token block. The 18 required names map onto the export's synthwave values:

```css
.tmpl-edgerunner {
  /* synthwave neons (template-private, ported from export styles.css) */
  --neon-pink: oklch(0.72 0.30 350);
  --neon-magenta: oklch(0.65 0.32 330);
  --neon-cyan: oklch(0.85 0.18 200);
  --neon-purple: oklch(0.62 0.28 305);
  --neon-yellow: oklch(0.92 0.18 95);
  --bg-deep: oklch(0.10 0.04 285);
  --neon-gradient: linear-gradient(135deg, var(--neon-pink), var(--neon-purple), var(--neon-cyan));
  --sky-gradient: linear-gradient(180deg, oklch(0.16 0.10 305), oklch(0.20 0.18 340) 45%, oklch(0.40 0.25 25) 75%, oklch(0.65 0.22 60));

  /* 18 REQUIRED tokens (the contract vocabulary) */
  --bg: oklch(0.10 0.04 285);
  --surface: oklch(0.14 0.05 285);
  --surface-muted: oklch(0.18 0.06 285);
  --fg: oklch(0.97 0.02 320);
  --muted-fg: oklch(0.72 0.06 300);
  --border: oklch(0.30 0.10 300 / 0.4);
  --border-strong: oklch(0.45 0.14 300 / 0.6);
  --accent: var(--neon-pink);
  --ring: var(--neon-pink);
  --success: oklch(0.80 0.18 160);
  --destructive: oklch(0.65 0.28 25);
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-full: 9999px;
  /* --font-display/-body/-mono come from fonts.ts variable: bindings */
}
```

- [ ] **Step 2: Add base element styling + scoped utilities**

Port the export's `@layer base` (background, foreground, font-body, selection) scoped under `.tmpl-edgerunner`, plus the scoped utility CLASSES the sections use (rename to plain classes, no Tailwind `@utility`): `.tmpl-glow-pink/-cyan/-purple` (text-shadow glows), `.tmpl-holo-panel` (the glass panel), `.tmpl-bg-neon` / `.tmpl-bg-sky` (gradient fills). All reference the tokens above.

- [ ] **Step 3: Port the keyframes (scoped, `tmpl-edgerunner-` prefixed)**

Port from the export: `flicker`, `neon-pulse`, `float`, `grid-scroll`, `scanline`, `spin`, and add `marquee` (`from{transform:translateX(0)} to{transform:translateX(-50%)}`). Prefix each name `tmpl-edgerunner-*` to keep them scoped.

- [ ] **Step 4: Add the kit-reveal + contact-form class hooks**

```css
.tmpl-edgerunner .tmpl-load-reveal { opacity: 1; } /* hero: SSR-visible, translate-only entrance */
.tmpl-edgerunner .tmpl-reveal { opacity: 0; transform: translateY(16px); transition: opacity .6s ease, transform .6s ease; }
.tmpl-edgerunner .tmpl-reveal[data-revealed="true"] { opacity: 1; transform: none; }
.tmpl-edgerunner .tmpl-contact-field { background: var(--surface); color: var(--fg); border: 1px solid var(--border); border-radius: var(--radius-md); }
.tmpl-edgerunner .tmpl-contact-field:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.tmpl-edgerunner .tmpl-contact-success-pulse { animation: tmpl-edgerunner-neon-pulse 2.4s ease-in-out infinite; }
.tmpl-edgerunner .tmpl-contact-spinner { animation: tmpl-edgerunner-spin .8s linear infinite; }
```
(Confirm the exact `data-revealed` attribute / class the kit `ScrollReveal` toggles by reading `_kit/scroll-reveal.tsx`, and match it. Mirror minimal/aurora's reveal CSS naming.)

- [ ] **Step 5: Add the reduced-motion blanket reset**

```css
@media (prefers-reduced-motion: reduce) {
  .tmpl-edgerunner *, .tmpl-edgerunner *::before, .tmpl-edgerunner *::after {
    animation: none !important;
    transition: none !important;
  }
  .tmpl-edgerunner .tmpl-reveal { opacity: 1; transform: none; }
}
```

- [ ] **Step 6: Verify isolation + token gates, then commit**

```bash
npm run gate:isolation
```
Expected: PASS — `.tmpl-edgerunner` defines all 18 required tokens, zero chrome tokens, zero Inter.

```bash
git add src/components/templates/edgerunner/theme.css
git commit -m "feat(edgerunner): scoped synthwave theme.css ported from export"
```

---

## Task 4: Extend `shared.ts` + `icons.ts`

**Files:**
- Modify: `src/components/templates/edgerunner/sections/shared.ts`
- Modify: `src/components/templates/edgerunner/sections/icons.ts`

- [ ] **Step 1: Add shared style constants the ports need**

Keep existing exports (`present`, `kickerStyle`, `headingStyle`, `sectionShellStyle`, `hairlineStyle`). Add pure `CSSProperties` constants reused across sections so the look stays byte-identical: `eyebrowStyle` (the `//`-prefixed SectionHeading eyebrow), `mutedBodyStyle`, `cardStyle` (the holo-panel base as inline style referencing tokens). Export them. No client JS.

- [ ] **Step 2: Extend the curated brand-icon set**

In `icons.ts`, add any `simple-icons` named imports the founder's seeded skills reference that aren't already present (read the seeded `skills` content via `scripts/seed-founder-portfolio.ts` to confirm the slugs). Keep NAMED imports only; extend `TECH_ICONS` accordingly.

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit
git add src/components/templates/edgerunner/sections/shared.ts src/components/templates/edgerunner/sections/icons.ts
git commit -m "feat(edgerunner): shared style constants + extended brand-icon set"
```

---

## Task 5: Port the bespoke UI primitives

**Files (create):**
- `src/components/templates/edgerunner/sections/ui/neon-button.tsx` (server)
- `src/components/templates/edgerunner/sections/ui/glow-card.tsx` (server)
- `src/components/templates/edgerunner/sections/ui/section-heading.tsx` (server)
- `src/components/templates/edgerunner/sections/ui/neon-divider.tsx` (client — `motion` scale-in)
- `src/components/templates/edgerunner/sections/ui/tilt-card.tsx` (client — `motion` tilt)
- `src/components/templates/edgerunner/sections/ui/magnetic.tsx` (client — `motion` pointer)
- **Source:** the matching files in `lovable-exports/synthwave-founder/src/components/ui/`

Port each applying the Transformation Rules. `NeonButton`/`NeonLink`, `GlowCard`, `SectionHeading` are pure CSS → Server Components. `NeonDivider` (scale-in), `TiltCard`, `MagneticButton` use `motion/react` → `'use client'`.

- [ ] **Step 1: Write `neon-button.tsx` (the exemplar pattern for all primitives)**

```tsx
// src/components/templates/edgerunner/sections/ui/neon-button.tsx
import type { ReactNode } from 'react';

type Variant = 'primary' | 'outline' | 'ghost';
const base: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  minHeight: '44px', padding: '0 24px', borderRadius: 'var(--radius-md)',
  fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px',
  textTransform: 'uppercase', letterSpacing: '0.12em', textDecoration: 'none',
  cursor: 'pointer',
};
const variants: Record<Variant, React.CSSProperties> = {
  primary: { background: 'var(--neon-gradient)', color: 'var(--bg)', boxShadow: '0 8px 28px -12px color-mix(in oklab, var(--neon-pink) 50%, transparent)' },
  outline: { background: 'transparent', color: 'var(--neon-cyan)', border: '1px solid var(--border-strong)' },
  ghost: { background: 'transparent', color: 'var(--fg)' },
};
export function NeonLink({ href, variant = 'primary', children, external }: { href: string; variant?: Variant; children: ReactNode; external?: boolean }) {
  return <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} style={{ ...base, ...variants[variant] }}>{children}</a>;
}
```

- [ ] **Step 2: Port the remaining primitives**

Port `glow-card.tsx`, `section-heading.tsx` (server) and `neon-divider.tsx`, `tilt-card.tsx`, `magnetic.tsx` (client) from the export's `ui/` applying the Transformation Rules (R1 import swap, R3 tokens, R5 motion+reduced-motion, R6 client boundary). TiltCard/Magnetic keep their `useMotionValue`/`useSpring` logic; SSR-render flat (no `initial` that hides children).

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit
git add src/components/templates/edgerunner/sections/ui/
git commit -m "feat(edgerunner): port bespoke UI primitives (neon button/card/divider/tilt/magnetic)"
```

---

## Task 6: Port the CityScene backdrop + hero-city asset

**Files:**
- Create: `public/templates/edgerunner/hero-city.jpg` (copy from `lovable-exports/synthwave-founder/src/assets/hero-city.jpg`)
- Create: `src/components/templates/edgerunner/sections/city-scene.tsx` (client — `motion` beam pulses; or pure-CSS if budget-driven)
- **Source:** `lovable-exports/synthwave-founder/src/components/sections/CityScene.tsx`

- [ ] **Step 1: Copy the city image into `public/`**

```bash
mkdir -p public/templates/edgerunner
cp lovable-exports/synthwave-founder/src/assets/hero-city.jpg public/templates/edgerunner/hero-city.jpg
```
(Verify it's a Lovable-generated asset with no third-party licensing problem before committing.)

- [ ] **Step 2: Port CityScene**

Port applying the Transformation Rules. The base city photo renders via `next/image` (`src="/templates/edgerunner/hero-city.jpg"`, `fill` or explicit dims, `priority`, `unoptimized`, `alt=""` aria-hidden). The 6 neon beams + horizon glow + scanline sweep use scoped token colors; prefer CSS `@keyframes` (theme.css) so the layer is no-JS-safe; use `motion` only if the staggered beam pulse needs it (reduced-motion-gated). `aria-hidden="true"`, `pointer-events:none`.

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit
git add public/templates/edgerunner/hero-city.jpg src/components/templates/edgerunner/sections/city-scene.tsx
git commit -m "feat(edgerunner): port CityScene backdrop + hero-city asset"
```

---

## Task 7: Port the TerminalCard

**Files:**
- Create: `src/components/templates/edgerunner/sections/terminal-card.tsx` (client)
- **Source:** `lovable-exports/synthwave-founder/src/components/sections/TerminalCard.tsx`

- [ ] **Step 1: Port applying the Transformation Rules**

Window dots + `~/portfolio — zsh` titlebar + the type-written lines + the progress bar + the conic-gradient spin border. Lines are composed from props the hero passes (display_name, headline, a couple metric values) — NOT hardcoded export data. SSR-renders the final (fully-typed) state visible; the typing animation is JS enhancement only, reduced-motion-gated (static final state under reduce). Accepts a typed `lines: string[]` prop.

- [ ] **Step 2: Verify + commit**

```bash
npx tsc --noEmit
git add src/components/templates/edgerunner/sections/terminal-card.tsx
git commit -m "feat(edgerunner): port TerminalCard (data-driven, no-JS-safe)"
```

---

## Task 8: Rewrite the Hero section

**Files:**
- Modify (rewrite): `src/components/templates/edgerunner/sections/hero.tsx`
- **Source:** `lovable-exports/synthwave-founder/src/components/sections/Hero.tsx`

- [ ] **Step 1: Port the 2-col hero applying the Transformation Rules + Data Map**

2-col grid (`lg:grid-cols-[1.4fr_1fr]`): left = "System online" mono label, the neon-gradient flickering name (`content.heading`), the role/tagline (`content.subheading`), the CTA `NeonLink` (`content.cta_text`→`content.cta_url`||`#contact`) + the résumé ghost button (`content.resume_url`, render-if-present); right = `<TerminalCard lines={…}/>` (lines built from `data.profile.display_name`/`headline` + metric values — pass via props from `index.tsx`, OR read a `profile` prop; keep `SectionProps` frozen and pass extra hero data through the section `content` + a `profile` prop only if `SectionProps` allows — if not, derive terminal lines from hero content alone). The `<CityScene/>` renders behind (mounted in `index.tsx`, not here). No contact pills (R2/Data Map). Hero is the LCP: wrapped by `index.tsx` in `<ScrollReveal priority>`, zero entrance motion (`.tmpl-load-reveal`).

> Note: `SectionProps` is frozen to `{ section }`. The TerminalCard needs profile data; supply it by having `index.tsx` read `data.profile` and pass a `profile` prop to `<Hero>` ONLY if the frozen contract is preserved for the gate. Simplest compliant path: build terminal lines from hero `content` (heading/subheading) + the metrics section content, resolved inside `index.tsx`, and pass the resulting `string[]` to `<Hero terminalLines={…} section={…}/>`. Confirm the conformance gate tolerates the extra optional prop (minimal/aurora Footer already takes `{ data }`, so an extra typed prop is fine).

- [ ] **Step 2: Verify + commit**

```bash
npx tsc --noEmit
git add src/components/templates/edgerunner/sections/hero.tsx
git commit -m "feat(edgerunner): faithful 2-col hero (TerminalCard + CityScene, data-driven)"
```

---

## Task 9: Rewrite About + Metrics

**Files:**
- Modify (rewrite): `src/components/templates/edgerunner/sections/about.tsx`
- Modify (rewrite): `src/components/templates/edgerunner/sections/metrics.tsx`
- **Source:** `lovable-exports/synthwave-founder/src/components/sections/About.tsx`

- [ ] **Step 1: Port About**

2-col: holographic portrait (`about.avatar`/`avatar_alt` via `next/image`, scanline-glitch border) left; `SectionHeading` + `bio` body right. Stats are NOT here (they're the Metrics section). Apply Transformation Rules.

- [ ] **Step 2: Rewrite Metrics as the export's stat band**

Render `metrics.items[]` (value/label/icon) as the export's 4-stat holo-panel grid (the visual that sat inside the export's About). `index.tsx` places it immediately after About so it reads as one "About + stats" block. Apply Transformation Rules; per-stat stagger via `<ScrollReveal as="li" delay={i*60}>`.

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit
git add src/components/templates/edgerunner/sections/about.tsx src/components/templates/edgerunner/sections/metrics.tsx
git commit -m "feat(edgerunner): faithful About (portrait+bio) + Metrics stat band"
```

---

## Task 10: Rewrite Experience (timeline + highlights)

**Files:**
- Modify (rewrite): `src/components/templates/edgerunner/sections/experience.tsx`
- **Source:** `lovable-exports/synthwave-founder/src/components/sections/Experience.tsx`

- [ ] **Step 1: Port the timeline**

Vertical neon spine (gradient left rule, `md` centered), alternating left/right cards, neon node markers. Per item: period+location (mono cyan; period from `start_date — end_date`, "present" handled), role (display), company (pink glow), description, and the `highlights[]` bullet list (cyan-dot bullets) when present. Per-card stagger via `<ScrollReveal as="li" delay={i*50}>`. Apply Transformation Rules + Data Map.

- [ ] **Step 2: Verify + commit**

```bash
npx tsc --noEmit
git add src/components/templates/edgerunner/sections/experience.tsx
git commit -m "feat(edgerunner): faithful Experience timeline with highlights"
```

---

## Task 11: Rewrite Projects (tilt cards + modal)

**Files:**
- Modify (rewrite): `src/components/templates/edgerunner/sections/projects.tsx` (client)
- **Source:** `lovable-exports/synthwave-founder/src/components/sections/Projects.tsx` + modal pattern from `src/components/templates/minimal/sections/projects.tsx`
- **Reference:** `minimal/sections/projects.tsx` for the focus-trapped, ISR-safe modal pattern

- [ ] **Step 1: Port the 3-col grid + modal**

3-col `GlowCard`+`TiltCard` grid; each card: tech_stack pills, title, description, GitHub/Live links (`safeHref`). Click opens a detail modal (`AnimatePresence`) showing title/description/full tech_stack/links. Reuse minimal's focus-trap + escape-close + scroll-lock approach (a11y); keep the synthwave styling. Per-card stagger via `<ScrollReveal as="li" delay={i*60}>`. Apply Transformation Rules + Data Map (modal uses `description`, no separate long_description).

- [ ] **Step 2: Verify + commit**

```bash
npx tsc --noEmit
git add src/components/templates/edgerunner/sections/projects.tsx
git commit -m "feat(edgerunner): faithful Projects grid with tilt cards + modal"
```

---

## Task 12: Rewrite Skills (circular gauges + TechMarquee)

**Files:**
- Modify (rewrite): `src/components/templates/edgerunner/sections/skills.tsx` (client)
- **Source:** `lovable-exports/synthwave-founder/src/components/sections/Tools.tsx` + `TechMarquee.tsx`

- [ ] **Step 1: Build the circular gauge**

Per skill item with a numeric `level` (0–100), render an SVG ring whose `stroke-dashoffset` encodes the level. The math (r=32, circumference = 2πr ≈ 201.06):

```tsx
const R = 32, C = 2 * Math.PI * R; // ≈ 201.06
const offset = C * (1 - level / 100);
// <svg viewBox="0 0 80 80"><circle cx=40 cy=40 r=32 (track) /><circle cx=40 cy=40 r=32
//   stroke="var(--neon-cyan)" strokeDasharray={C} strokeDashoffset={animated? C : offset}
//   transform="rotate(-90 40 40)" strokeLinecap="round" /></svg>
// center: the brand icon (TECH_ICONS) + the % label below.
```
SSR renders the ring FULL/at-rest visible (no-JS-safe); `motion`/CSS animates `strokeDashoffset` from `C`→`offset` on inView, reduced-motion-gated (jumps straight to `offset`). Items without `level` render an icon+name pill (graceful).

- [ ] **Step 2: Port the groups layout + TechMarquee**

2-col groups (category title + "N modules" counter + the gauge grid). Below the groups, the `TechMarquee`: an infinite horizontal strip of the flattened skill names (`icon` + name + `/` separator), doubled for a seamless loop, animated by the scoped `tmpl-edgerunner-marquee` CSS keyframe (no-JS-safe: static strip without animation), with left/right fade masks. Apply Transformation Rules + Data Map.

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit
git add src/components/templates/edgerunner/sections/skills.tsx
git commit -m "feat(edgerunner): faithful Skills circular gauges + TechMarquee"
```

---

## Task 13: Rewrite Contact (Direct Lines + spinning-border live form)

**Files:**
- Modify (rewrite): `src/components/templates/edgerunner/sections/contact.tsx`
- **Source:** `lovable-exports/synthwave-founder/src/components/sections/Contact.tsx` + the live-wiring pattern from `aurora/sections/contact.tsx`

- [ ] **Step 1: Port the 2-col contact**

Left: "Direct Lines" holo-panel (heading/subheading + the mailto when `email_public` present). Right: the export's conic-gradient spinning border (scoped CSS) WRAPPING the real `<ContactForm portfolioId={section.portfolio_id} emailPublic={emailPublic} />` island (exact aurora pattern: render the island when `present(section?.portfolio_id)`, else mailto-only fallback). The island reads the `.tmpl-contact-field`/`.tmpl-contact-success-pulse`/`.tmpl-contact-spinner` hooks defined in Task 3. Apply Transformation Rules + Data Map. The export's fake setTimeout form is dropped.

- [ ] **Step 2: Verify + commit**

```bash
npx tsc --noEmit
git add src/components/templates/edgerunner/sections/contact.tsx
git commit -m "feat(edgerunner): faithful Contact (Direct Lines + spinning-border live form)"
```

---

## Task 14: Build Navbar + rewrite Footer

**Files:**
- Create: `src/components/templates/edgerunner/sections/navbar.tsx` (client — scroll-spy)
- Modify (rewrite): `src/components/templates/edgerunner/sections/footer.tsx`
- **Source:** `lovable-exports/synthwave-founder/src/components/layout/Navbar.tsx` + `Footer.tsx`

- [ ] **Step 1: Port the sticky scroll-spy Navbar**

Sticky neon pill nav: logo badge (from `display_name`/`username`), anchor links to the rendered section types (`#about`, `#experience`, …), scroll-spy active-link highlight via an IntersectionObserver client hook. Drop the cmdk hint (CommandPalette dropped). Mobile: `AnimatePresence` dropdown. No-JS-safe: renders all links visible, active-highlight is enhancement. Accepts the list of present section types as a prop from `index.tsx`.

- [ ] **Step 2: Port the 3-col Footer**

`FooterProps = { data }`. Col1 logo+tagline, Col2 quick links (anchors to present sections), Col3 channels (socials/email — render only real data; drop the export's example socials). Apply Transformation Rules.

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit
git add src/components/templates/edgerunner/sections/navbar.tsx src/components/templates/edgerunner/sections/footer.tsx
git commit -m "feat(edgerunner): sticky scroll-spy Navbar + 3-col Footer"
```

---

## Task 15: Rewrite `index.tsx` — compose the faithful template (flips it live)

**Files:**
- Modify (rewrite): `src/components/templates/edgerunner/index.tsx`

- [ ] **Step 1: Compose the RSC root**

Keep: `import './theme.css'`, the fonts, `themeInitScript('dark')` + `personLdScriptHtml` (the only two danger-html), dark-only hardcoded `data-template-theme="dark"`, `<EdgerunnerEffects/>`, NO `ThemeToggle`. Structure (export's homepage order):

```tsx
<div className={`tmpl-edgerunner ${fontVars}`} data-template-root data-template-theme="dark">
  <script dangerouslySetInnerHTML={{ __html: themeInitScript('dark') }} />
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: personLdHtml }} />
  <EdgerunnerEffects />
  <Navbar sectionTypes={presentTypes} profile={profile} />
  <main>
    <ScrollReveal as="section" priority data-section-type="hero">
      <CityScene />
      <Hero section={sectionOfType(sections,'hero')} terminalLines={terminalLines} />
    </ScrollReveal>
    <NeonDivider glyph="◇" />
    <ScrollReveal as="section" data-section-type="about"><About section={sectionOfType(sections,'about')} /></ScrollReveal>
    <ScrollReveal as="section" data-section-type="metrics"><Metrics section={sectionOfType(sections,'metrics')} /></ScrollReveal>
    <NeonDivider glyph="◆" />
    <ScrollReveal as="section" data-section-type="experience"><Experience section={sectionOfType(sections,'experience')} /></ScrollReveal>
    <NeonDivider glyph="✦" />
    <ScrollReveal as="section" data-section-type="projects"><Projects section={sectionOfType(sections,'projects')} /></ScrollReveal>
    <NeonDivider glyph="◇" />
    <ScrollReveal as="section" data-section-type="skills"><Skills section={sectionOfType(sections,'skills')} /></ScrollReveal>
    <NeonDivider glyph="◆" />
    <ScrollReveal as="section" data-section-type="contact"><Contact section={sectionOfType(sections,'contact')} /></ScrollReveal>
  </main>
  <Footer data={data} />
</div>
```

`presentTypes`/`terminalLines` are computed server-side from `data` before the return. `NeonDivider` is decorative chrome (no `data-section-type`). Keep `sectionOfType` helper. NO `motion` import here (R6).

- [ ] **Step 2: Build the whole template**

```bash
npx tsc --noEmit && npx next build
```
Expected: build succeeds; `/[username]` shows ● SSG/ISR in the route table.

- [ ] **Step 3: Commit**

```bash
git add src/components/templates/edgerunner/index.tsx
git commit -m "feat(edgerunner): compose faithful synthwave template (live)"
```

---

## Task 16: Run the full gate umbrella to green

**Files:** whatever the gates flag.

- [ ] **Step 1: Run the umbrella**

```bash
npm run gate:template -- edgerunner
```
Runs: `tsc` → `gate:security` → `gate:isolation` + token-conformance → `gate:registry` → `next build` → `check:bundle` (≤200 kB First Load JS + ● SSG/ISR) → `gate:conformance` (7 sections render on full + all-null, no null leak) → `gate:a11y` (axe 0 serious/critical, reduced-motion, no >3 flash/sec).

- [ ] **Step 2: Fix to green, honoring the budget fallback**

Fix each failure. If `check:bundle` reports First Load JS > 200 kB, apply spec §4.4 in order: CSS-ify ambient loops (sun/beams/grid/marquee) before touching the interactive pieces (TiltCard/terminal/gauges/nav). Re-run until all tiers pass.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(edgerunner): full gate umbrella green"
```

---

## Task 17: Regenerate parity + thumbnail; lossless-switch; manual UAT

**Files:**
- `e2e/__screenshots__/template-visual-parity.spec.ts/edgerunner-golden.png` (regenerate)
- `public/templates/edgerunner.webp` (regenerate)

- [ ] **Step 1: Regenerate the parity self-baseline**

```bash
npx playwright test e2e/template-visual-parity.spec.ts --update-snapshots
```
Then run WITHOUT `--update-snapshots` 3× to confirm a stable self-diff at `maxDiffPixelRatio 0.01`.

- [ ] **Step 2: Regenerate the thumbnail**

```bash
node scripts/generate-template-thumbnails.mjs
```
Expected: a fresh `public/templates/edgerunner.webp` reflecting the new look.

- [ ] **Step 3: Lossless-switch integration test (live local Supabase)**

```bash
npx vitest run tests/integration/templates/lossless-switch.test.ts
```
Expected: PASS — skills.level + metrics survive a switch round-trip byte-identically.

- [ ] **Step 4: Manual authed UAT**

Start `npm run dev`; via Playwright MCP (inject `@supabase/ssr` cookies at `127.0.0.1`, founder seed), open the founder's live page on edgerunner. Eyeball against the export: hero 2-col + TerminalCard + CityScene, neon dividers, About+Metrics, timeline, tilt/modal projects, gauges+marquee, spinning-border form, sticky nav, footer. Screenshot for the record.

- [ ] **Step 5: Commit**

```bash
git add e2e/__screenshots__/ public/templates/edgerunner.webp
git commit -m "test(edgerunner): regenerate parity golden + thumbnail; UAT pass"
```

---

## Task 18 (follow-up): Fix the `lovable-ingest` skill

**Files:**
- Modify: `.claude/skills/lovable-ingest/references/translation-playbook.md`

- [ ] **Step 1: Rewrite the playbook's output-shape guidance**

Replace the *"follow `minimal/index.tsx` as the canonical output shape"* instruction with: **port the export's actual component tree and layout faithfully**, translating only (a) data layer → `PortfolioData` soft-enum mapping, (b) security (strip data/admin, external origins, danger-html, secrets), (c) design tokens → scoped `.tmpl-*`, (d) deps (`framer-motion`→`motion/react`, `react-icons`→`simple-icons`, runtime fonts→`next/font`). Cite this edgerunner rebuild + the Global Transformation Rules above as the worked example. Add an explicit anti-pattern note: "DO NOT rebuild sections in another template's shape and repaint tokens — that is a reskin, not a clone."

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/lovable-ingest/references/translation-playbook.md
git commit -m "docs(lovable-ingest): faithful-port playbook (fix the reskin failure mode)"
```

---

## Self-Review (completed)

- **Spec coverage:** §3 decisions → Tasks 1 (WebGL drop, motion), 15 (in-place rebuild), 14 (nav+footer), 18 (skill fix). §4 architecture → Tasks 1,3,15 + R5/R6. §5 component plan → Tasks 5–14. §6 data map/schema → Task 2 + Data Map + per-section tasks. §7 asset → Task 6. §8 theme → Task 3. §9 security → R7 + gate:security in Task 16. §10 verification → Tasks 16–17. §11 skill fix → Task 18. No gaps.
- **Placeholders:** none — port tasks reference an exact source file + the Global Transformation Rules + Data Map (the complete algorithm), not "TBD". Full code inlined for the schema, theme tokens, NeonButton exemplar, gauge math, index skeleton.
- **Type consistency:** `SectionProps = { section }` and `FooterProps = { data }` (frozen) used throughout; the hero's extra `terminalLines` prop + navbar's `sectionTypes` prop flagged as additive optionals to confirm against the conformance gate in Task 16.
- **Known risk:** First Load JS budget — surfaced in Task 16 Step 2 with the §4.4 fallback order.
