# Template Contract

**The single source of truth a Portsmith template must satisfy.** Human authors and the
Phase-11 ingestion skill both read this; Phase-10 CI builds the greps/tests that *enforce*
it. Phase 9 **defines** the contract — it does not yet enforce it.

This prose contract POINTS AT the machine-checkable half, [`contract.ts`](./contract.ts)
(the `REQUIRED_TOKENS` const + `PRESET_NAMES` + the type-only `PortfolioData`/`TemplateSpec`
re-exports). Where this doc and `contract.ts` disagree, `contract.ts` (asserted by the
Wave-0 tests) wins — it is the drift-checked source.

A conforming template (whether hand-written or translated from an ingested Lovable design)
must pass **all** of the [Gate Checklist](#gate-checklist) at the end of this document.

---

## 1. Data consumption — the all-nullable `PortfolioData`

A template consumes exactly ONE typed shape: `PortfolioData`
([`types.ts:54`](./types.ts)). There is no other data source — no DB read, no fetch, no
request-time lookup in the template (that would break the public ISR/SSG invariant).

**LOAD-BEARING NULLABILITY (cite verbatim — [`types.ts:15-23`](./types.ts)):**

> EVERY column on EVERY `public_*` view Row is nullable (`| null`) — including `id`,
> `username`, `theme_mode`, and `content`. Generated view types are always fully nullable.
> Consumers MUST null-guard (`?.` / `??`) before using any field.

So **every field read must be null-guarded.** `profile.id` is `string | null`; a heading,
an avatar URL, a section's whole `content` object — all may be `null`. A template that
dereferences a field without a guard is non-conforming (and will crash on a sparsely-filled
portfolio).

**All-or-nothing-public `content` (DATA-01 — see Plan 04's write-up):** a section's
`content` JSONB carries **no private fields**. Once a section is visible on a published
portfolio, its *entire* `content` object is public (the public read exposes the whole
object via the `public_sections` `security_invoker` view). Anything that must stay private
is a **protected column** on `profiles`/`portfolio_settings` (`email`, `role`,
`storage_used_bytes`, `locked` — REVOKEd/excluded from the public views), **never** a
`content` field. A template author/skill must never assume per-field privacy inside
`content`.

---

## 2. Spec field-gating — `TemplateSpec` / `TemplateSectionSpec`

Each template declares a local `spec.ts` (`minimalSpec` / `editorialSpec`) typed to
`TemplateSpec` ([`minimal/spec.ts:71`](./minimal/spec.ts)):

```ts
interface TemplateSectionSpec { supported: boolean; fields: readonly string[]; }
interface TemplateSpec {
  sections: Partial<Record<string, TemplateSectionSpec>>; // keyed by soft-enum section type
  color_presets: readonly string[];
  font_presets: readonly string[];
  pages?: readonly ('blog' | 'services')[]; // D-14/D-15 — dedicated sub-pages; omit → none
}
```

- `sections` is keyed by the **soft-enum** section types (a *partial* record — a template
  MAY omit a type entirely; the mismatch predicate treats an omitted type the same as
  `supported: false`).
- A template renders every section it marks `supported: true`, **1:1, in `sort_order`** —
  no section dropped, no section invented.
- `blog_preview: { supported: false, fields: [] }`
  ([`editorial/spec.ts:56`](./editorial/spec.ts)) is the precedent for an **unsupported**
  type: the blog engine is deferred (v2) and the CMS never produces `blog_preview` in v1.
  Declaring it unsupported is what makes the warn-but-allow mismatch predicate
  (`unsupportedFilledSections`, D-P7-11) testable.
- **Where `color_preset` support lives (D-05):** `spec.color_presets` declares the SUBSET
  of the platform-wide `PRESET_NAMES` this template supports. `minimal` ships all four;
  `editorial` ships `['default']` only ("fewer knobs = hard to make ugly").

`TemplateSpec` is defined ONCE (in `minimal/spec.ts`) as a STRUCTURAL widening, so a
sibling template's spec satisfies it regardless of which sections it marks unsupported.
`contract.ts` re-exports `TemplateSpec` / `TemplateSectionSpec` **type-only** for the
Phase-10 gates — the optional `pages` member rides along on that existing type-only
re-export automatically (NO value re-export — that would breach the §7 bundle-split rule).

### Dedicated sub-pages — `spec.pages` (D-14/D-15, EXCLUSIVE LANE)

The single-scroll page model is the default and the wedge. A small set of templates may
ALSO render **dedicated sub-pages** outside that scroll — a `/blog` index, `/blog/[slug]`
post pages, and a `/services` page. Which sub-pages a template renders is declared on its
spec:

```ts
// edgerunner-v2/spec.ts — the EXCLUSIVE-lane founder template opts in:
pages: ['blog', 'services'],
// minimal / editorial / aurora / edgerunner: OMIT `pages` entirely.
```

- **`pages` is OPTIONAL and defaults to NONE (D-15).** A template that does not declare it
  (every standard template today) renders the single scroll only — the three `(portfolio)`
  sub-routes (`/[username]/blog`, `/[username]/blog/[slug]`, `/[username]/services`) call
  `notFound()` for it. This is the safe degrade: omission = single-scroll.
- **Services, blogs and dedicated pages are an EXCLUSIVE-template perk, not a universal
  capability (D-15).** Not all future deployments get them; declaring `pages` is the opt-in
  that unlocks the dedicated-page routes for that template's users. Today only the founder's
  `edgerunner-v2` opts in.
- **Posts are DATA; the spec gates RENDERING (D-14).** A user on a non-granted template can
  still have published posts saved in the DB — the blog routes simply 404 (the `pages` gate)
  until they switch to a template whose spec declares `'blog'`. Switching templates is
  therefore lossless for posts exactly as it is for sections.
- **The gate adds NO request-time read.** Each sub-route consults the ALREADY-resolved
  `data.templateSpec.pages?.includes('blog' | 'services')` (resolved in the cookie-less
  `get-portfolio.ts` read via `resolveSpec`), so the routes stay ● SSG/ISR (D-22). The
  sub-routes also INHERIT the portfolio's `isPublishReady` noindex gate (D-18 — no
  posts-as-indexable side-door).

---

## 3. REQUIRED token surface — the 18 canonical custom properties

Every template MUST define this canonical CSS-custom-property vocabulary in its scoped
`.tmpl-<slug>` `theme.css`. The machine-checkable list is `REQUIRED_TOKENS` in
[`contract.ts`](./contract.ts); `token-conformance.test.ts` asserts each is defined in BOTH
live `theme.css` files. The surface is the **intersection** of `minimal/theme.css` ∩
`editorial/theme.css` (D-06) — 18 names:

| Token | Role | Group |
|-------|------|-------|
| `--bg` | page canvas | colour |
| `--surface` | elevated cards / panels | colour |
| `--surface-muted` | inset fills / chips | colour |
| `--fg` | primary text | colour |
| `--muted-fg` | meta / dates / captions | colour |
| `--border` | decorative hairline | colour |
| `--border-strong` | hover/focus-adjacent | colour |
| `--accent` | primary accent / CTA | colour |
| `--ring` | focus ring | colour |
| `--success` | success state | colour |
| `--destructive` | error state | colour |
| `--font-display` | display / heading face | type |
| `--font-body` | body face (anchors root) | type |
| `--font-mono` | mono label face | type |
| `--radius-sm` | small radius | radius |
| `--radius-md` | medium radius | radius |
| `--radius-lg` | large radius | radius |
| `--radius-full` | pill / circle | radius |

> **Doc note:** RESEARCH § D-06's table header says "19 names" but enumerates exactly these
> 18 rows — an off-by-one in the prose. The verified intersection of the live `theme.css`
> files (asserted by `token-conformance.test.ts`) is **18**.

**The three `--font-*` tokens are set via `next/font` `variable:` in each template's
`fonts.ts`** (e.g. `variable: '--font-display'`) — NOT as literal `--name:` declarations in
`theme.css` text. `next/font` injects them onto the root element. They are still REQUIRED;
the conformance test exempts them from the literal-`theme.css` check and instead asserts
their `variable:` provenance in both `fonts.ts`.

**Conditional modal sub-surface (NOT in `REQUIRED_TOKENS`):** a template that mounts the
shared `ReportDialog` island also defines `--tmpl-modal-hairline`,
`--tmpl-modal-backdrop`, `--tmpl-modal-shadow`, `--tmpl-modal-cta-shadow` (the island reads
these per-template tokens; it carries no hex). These are required ONLY for templates that
mount that island — documented here, deliberately out of `REQUIRED_TOKENS`.

**Template-private extras are ALLOWED and NOT required.** A template may define any extra
tokens it wants for its own distinctive palette — e.g. minimal's synthwave system
(`--accent-cyan`, `--accent-gold`, `--accent-orange`, `--accent-violet`,
`--sunset-gradient`). That variety is the whole point. The contract only mandates the 18
REQUIRED names (so presets can override a known surface).

**How presets bind (D-05):** a preset overrides a SUBSET of `REQUIRED_TOKENS` (primarily
`--accent`/`--ring`, optionally the `--font-*` triple) by setting them on the root under a
preset selector/attribute. The exact binding mechanism (a `data-preset` attribute mirroring
`data-template-theme`) is a **Phase-14** detail; Phase 9 only fixes the token NAMES presets
target + the `PRESET_NAMES` allowlist.

---

## 4. The kit + root contract

A template imports its unstyleable plumbing from the shared kit
([`_kit/`](./_kit/index.ts)) — never re-implementing it (PIPE-01 / D-01/D-02). The kit is
chrome-free, slug-agnostic, and logic-only; the dependency direction is **one-way**
(templates import the kit; the kit never imports a template).

A template root MUST:

1. Set **`data-template-root`** on its root element (alongside its `.tmpl-<slug>` class +
   `data-template-theme`). This is the generic contract the FOUC guard + toggle target —
   the kit references no slug.
2. Inject the pre-paint FOUC `<script dangerouslySetInnerHTML={{ __html:
   themeInitScript(defaultMode) }} />` (the kit's `themeInitScript`, run before first paint
   — no dark↔light flash). `defaultMode` is the template's own computed default (`minimal`
   = dark, `editorial` = light) — the kit hardcodes no default.
3. Mount `<ThemeToggle defaultMode={defaultMode} />` (the kit island) when a visitor toggle
   is wanted.
4. Style `.tmpl-<slug> .tmpl-theme-toggle`, `.tmpl-<slug> .tmpl-reveal`, and
   `.tmpl-<slug> .tmpl-load-reveal` in its scoped `theme.css`. The kit islands emit only
   those class names — all visual styling lives in the template (logic in the kit, looks in
   the template, D-01/D-03). The focus ring uses the canonical `--ring`.
5. Set **`data-section-type="<soft-enum type>"`** on EVERY section wrapper (e.g.
   `<ScrollReveal as="section" data-section-type="hero">`). This is the per-section analog
   of the root's `data-template-root`: it gives the PIPE-05 conformance gate a robust,
   always-mounted DOM signal to prove no spec-declared `supported: true` section is dropped
   (the wrapper is mounted even when its body is empty — the body is not). The value is a
   SOFT-ENUM section TYPE (`hero`/`about`/`skills`/`projects`/`experience`/`testimonials`/
   `contact`/…), NEVER a slug or a token, so the kit `ScrollReveal` (which forwards the
   attribute) stays chrome-free + slug-agnostic (D-02). A Phase-11 ingested template inherits
   this requirement by following the same root pattern.

The root is a **Server Component**; the only standard-lane client JS is the **2 sanctioned
kit islands** (`ScrollReveal` + `ThemeToggle`). The Hero must use `ScrollReveal priority`
(a static, fully-visible wrapper) — it is the LCP element and must NEVER be gated behind the
JS `opacity:0` reveal.

---

## 5. Two-lane dependency policy (PIPE-08)

A template ships on ONE of two lanes. **All lanes** consume the same all-nullable
`PortfolioData` and render sections 1:1 — a rich-lane (WebGL) template is additive, never a
content replacement, and switching between any two templates stays lossless.

### Standard lane (≤ 200 kB gz First Load JS)

- Scoped `theme.css` + the kit `ScrollReveal` island + ONE blessed animation lib:
  **Motion** (`motion/react`, the framer-motion line). `LazyMotion` + `m` = ~4.6 kB
  initial (features async-loaded); MIT; React-19 / Next-16 ready. Lovable emits
  framer-motion → near-identity translation.
- This is the default lane. Most templates never need more than the CSS reveal + Motion.

### Rich / viz lane (opt-in)

- Blesses **React Three Fiber v9 + drei** for WebGL/3D, in a **lazy client island**.
- The WebGL scene MUST be `dynamic(() => import('./Scene'), { ssr: false })` **inside a
  `'use client'` component**.
- **`next/dynamic({ ssr: false })` is BUILD-FORBIDDEN in the RSC template root** (D-11).
  Next 16 errors verbatim: *"`ssr: false` is not allowed with `next/dynamic` in Server
  Components. Please move it into a Client Component."* The heavy import lives ONLY in the
  client island, never the server root.

### The bundle accounting (why the rich lane is still ≤ 200 kB initial)

A `dynamic(..., { ssr: false })` scene nested inside a client island is a **separate
runtime-loaded chunk** — it appears in NEITHER the shared `rootMainFiles` NOR the page's
`page_client-reference-manifest.js`, so the bundle gate's **First Load JS** figure does NOT
count it. Therefore a rich-lane template's INITIAL load stays ≤ 200 kB gz (SSG/ISR + LCP
protected); the WebGL scene loads *after* paint. Only the THIN mount island (the
`'use client'` wrapper — the `dynamic()` call + a `<Suspense>` shell, a few hundred bytes)
counts toward First Load JS.

Because the First-Load-JS gate genuinely can't see the lazy scene chunk, it is governed by
a SEPARATE per-template **async-island sanity cap = 250 kB gz** (a starting figure — Phase
13 tunes it on the real Three.js dogfood; deliberately ~1.25× the standard budget: "rich,
but not unbounded" — catches a 1 MB texture-dump or an un-tree-shaken `import * from
'three'`).

### Dependency allowlist (D-15)

`_kit` + **Motion** + **R3F/drei** (rich lane) + `lucide-react` + `next/font`. An
**unrecognized dependency is FLAGGED for an operator decision** (ingestion is
operator-curated) — NOT silently rejected, NOT silently merged.

> **GSAP note:** GSAP is now 100% free for commercial use including all plugins (since
> April 2025, post-Webflow acquisition) — but it is NOT blessed (Motion is: GSAP is
> imperative and not what Lovable emits). A future GSAP bless would need no license
> re-check.

---

## 6. Styling-translation target (D-17)

**Tailwind LAYOUT utilities** (flex / grid / spacing / sizing — `flex`, `grid`, `gap-4`,
`p-6`, `max-w-5xl`, etc.) used in a template's JSX automatically ship from the lean public
root's `@import "tailwindcss"` ([`(portfolio)/portfolio.css`](../../app/(portfolio)/portfolio.css)).
Tailwind v4 auto-scans the template source and emits only the utilities actually used — you
do **NOT** add a CSS entry or a config. (The two current templates use ZERO utilities, so
the utilities layer tree-shakes to nothing today; the moment a template *uses* a layout
utility, it ships.)

**Color / type / visual identity must NOT use Tailwind color/font utilities.** All brand
identity resolves through the scoped `.tmpl-<slug>` token vocabulary (§3) — layout utilities
are geometry (no colour/type identity), so they don't breach two-layer isolation.

**shadcn theme vars** (`--background` / `--primary` / shadcn-style `--ring`) and **Radix
component deps** are **stripped/converted** (token collision with the chrome layer +
unvetted dependencies).

---

## 7. Bundle-split rule

Client chrome imports template display metadata from
[`template-meta.ts`](./template-meta.ts), **never** [`registry.ts`](./registry.ts).
`registry.ts` evaluates `templateSlugSchema = z.enum(...)` at module scope, so importing ANY
symbol from it into a client component drags zod (~63 kB gz) onto the public `/[username]`
First Load JS ([`registry.ts:133-141`](./registry.ts) warning block). The kit and
`contract.ts` honor the same rule: the kit is logic-only (imports nothing from `registry.ts`
or `@/lib/validations`); `contract.ts` re-exports types **type-only** (zero runtime weight).
Enforced by `kit-isolation.test.ts` + `npm run check:bundle`.

---

## Gate Checklist

Phase 9 DEFINES this checklist; Phase-10 CI BUILDS the greps/tests that enforce it; the
Phase-11 skill enforces it on ingested code. A conforming template must pass ALL:

### Security (D-13/14 — hard-reject, non-negotiable)

- [ ] No `dangerouslySetInnerHTML` EXCEPT the kit-provided FOUC script + the server JSON-LD
  serializer (both XSS-safe by construction). A template's own use is rejected.
- [ ] No external script/font/style origins. Fonts self-hosted via `next/font` ONLY (D-16).
- [ ] No external image origins EXCEPT Supabase Storage (the `NEXT_PUBLIC_SUPABASE_URL`
  origin — matches the existing `safe-image` host-lock).
- [ ] No inline event handlers (`onclick=` in markup strings), no `eval` / `new Function`.
- [ ] No hardcoded secrets / API keys / `VITE_*` creds / Supabase anon key or URL inline
  (D-14 — Lovable's #1 documented pitfall; falls out of stripping the data layer).

### Conformance (D-15 + the contract shape)

- [ ] Consumes `PortfolioData` (all-nullable) with null-guards on every field read.
- [ ] Renders every spec-declared `supported: true` section type 1:1 in `sort_order`; no
  section dropped.
- [ ] Defines every `REQUIRED_TOKENS` custom property in its scoped `theme.css` (the
  `--font-*` triple via `next/font` `variable:`).
- [ ] Zero chrome tokens (`--color-*` / `@theme`) and zero chrome font (Inter) — two-layer
  isolation grep.
- [ ] Server-Component root + ONLY the 2 sanctioned islands (kit `ThemeToggle` +
  `ScrollReveal`) as standard-lane client JS (+ 1 lazy `{ ssr: false }` scene island for
  the rich lane).
- [ ] Dependencies ⊆ the allowlist (`_kit` + Motion + R3F/drei [rich] + `lucide-react` +
  `next/font`); an unrecognized dep is FLAGGED for an operator decision, not silently
  rejected (D-15).

### Performance (the bundle gate)

- [ ] `/[username]` stays ● SSG/ISR (no `cookies()` / `headers()` / `searchParams` /
  request-host read) — `route-table-ssg` proof.
- [ ] Standard lane: First Load JS ≤ 200 kB gz. Rich lane: First Load JS ≤ 200 kB gz
  (initial) AND the lazy scene chunk ≤ the per-template async cap (250 kB gz starting).

### Parity (PIPE-11, Phase-10)

- [ ] Renders pixel-equivalent to the source Lovable design on the golden-fixture content
  (Playwright screenshot-diff, reusing the Phase-8 harness
  `e2e/template-visual-parity.spec.ts`).

---

## Related artifacts

- [`contract.ts`](./contract.ts) — the machine-checkable half (`REQUIRED_TOKENS`,
  `PRESET_NAMES`, type-only re-exports) this prose points at.
- `docs/lovable-prompt-scaffold.md` — the copy-paste Lovable prompt + the golden-fixture
  placeholder content the conformance/parity gates render against (Plan 03).
- The DATA-01/DATA-02 data-model write-up (Plan 04) — the launch-readiness confirmation
  the all-or-nothing-public `content` rule (§1) forward-references.
