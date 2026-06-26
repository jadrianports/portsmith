<!-- GSD:project-start source:PROJECT.md -->

## Project

**Portsmith**

Portsmith is a multi-tenant hosting platform that lets people — especially **non-technical professionals** (marketers, virtual assistants, freelancers, and other professions) — publish a polished, single-scroll portfolio by filling in structured content and choosing a curated template. The platform owns the templates; the user owns the content. You cannot design your own layout, and that is the point: it is fast and **hard to make ugly**.

The product's *first* template is developer-flavored — the founder is the first user and wants their own portfolio live first — but the data model and roadmap are built for non-technical professionals. Developers are simply the first profession served; **marketers are the next expansion.**

**Core Value:** A non-technical professional can turn their existing experience into a published, professional web presence in ~15 minutes — without designing anything, and without being able to make it look bad.

If everything else fails, *this* must hold: pick a template, fill in structured fields, publish a good-looking portfolio. Speed plus a guaranteed-professional result is the whole wedge.

### Constraints

- **Status: LIVE.** Deployed to `portsmith.vercel.app` (2026-06-16, Supabase ref `uyrcecdmqzxgugnvqkxq`) at the close of v2.5. Signup currently **autoconfirms** (the Resend test-sender only mails the owner; real-user email-verify is gated on a custom domain — `DOMAIN-01`, see `docs/runbooks/launch.md` OQ-1).
- **Tech stack**: Next.js 16 (App Router / RSC), Tailwind, Supabase (Postgres / Auth / Storage), Zustand + TanStack Query, Zod (validation gate on *every* write), Resend (email — **wired in v2.5** for contact-notify, degrade-open), Cloudflare Turnstile + Vercel BotID (spam/bots), Vercel (hosting — live); Vitest + Playwright + local-Supabase RLS integration tests. — Inherited from the handoff; proven and profession-agnostic. Heavy/3D (e.g. WebGL) libs are allowed only as lazy client islands under the template contract's opt-in **rich/viz lane** (none currently installed — the Phase-13 Three.js template was retired for a CSS clone).
- **Security (non-negotiable invariants)**: RLS is the tenant boundary; a protected-columns trigger guards `role` / `username` / `storage_used_bytes` / etc.; contact and page-view writes go through a server-side service-role route, never the anon key; storage has MIME allowlists + size caps + a usage trigger; public profile reads must not leak private columns.
- **Data model**: must stay profession-agnostic and additive — section `type` is a soft enum so marketer / other-profession expansion needs no migration.
- **Budget**: **$0 on domains now** — launch on the free `*.vercel.app` (`portsmith.vercel.app/[username]`) with free-tier Supabase/Vercel. The first domain dollar is a public-launch / production-email expense, not a build expense. (`portsmith.app` is the intended future brand domain — handoff ADR-002.)
- **Hosting / URLs**: build rendering hostname-aware and drive absolute URLs from `NEXT_PUBLIC_SITE_URL`, so switching `.vercel.app` → a real domain later is an env-var + DNS + 301-redirect change — done *before* any big public/SEO push.
- **Deploy (CI-gated)**: pushes to `main` → the `deploy` job in `.github/workflows/ci.yml` runs `vercel deploy --prod` (Vercel-side build) **only after `test` + `template-gate` pass** — a red CI never reaches production. `vercel.json` (`git.deploymentEnabled.main=false`) disables Vercel's own git auto-deploy so the CI job is the sole deploy path; `main` is branch-protected. **Apply prod DB migrations (`supabase db push`, after a `supabase db dump` backup — free tier has no PITR) BEFORE deploying code that depends on them** — the production build prerenders against the live DB, so missing schema fails the deploy (the `/explore` lesson). Vercel secrets: `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` (GitHub Actions secrets).
- **Page model**: single-scroll core page (`/[username]`), one section per type; v2.0 added opt-in multi-page public routes — `/[username]/blog`, `/blog/[slug]`, `/services`.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

Next.js 16 (App Router/RSC) · React 19 · Supabase (Postgres/RLS/Auth/Storage) · Tailwind v4 (CSS-first) · TanStack Query (server state) + Zustand (UI state) · Zod 4 (write gate) · Cloudflare Turnstile · Resend (transactional email) · Vitest + Playwright · Vercel (**LIVE — `portsmith.vercel.app`**, deployed 2026-06-16).

**Full, code-verified detail** (exact versions, every config file, all env-var names, integration gotchas): `.planning/codebase/STACK.md` + `.planning/codebase/INTEGRATIONS.md`.

### Pinned versions — do not drift

`next 16.2.6` (pins React `19.2.6` transitively — don't re-pin) · `@supabase/supabase-js 2.106.2` + `@supabase/ssr 0.10.3` · `tailwindcss 4.3.0` + `@tailwindcss/postcss` · `@tanstack/react-query 5.100.14` · `zustand 5.0.14` · `zod 4.4.3` · `react-cropper 2.3.3` (pulls `cropperjs@^1` — never add v2) · `@dnd-kit/core 6.3.1` · `file-type 21.3.4`. **Added in v2.0:** `botid 1.5.11` (bot mitigation) · `react-markdown 10` + `remark-gfm 4` + `shiki 4` (CMS Markdown blog — NOT MDX) · `motion 12` (the one budget-gated animation island) · `@axe-core/playwright`/`axe-core` (the template a11y gate). **Added in v2.5:** `resend 6.12.4` (contact-notify, server-only, degrade-open — no longer a no-op) · `@lhci/cli 0.15.1` (dev — authoritative deploy Lighthouse gate).

**Not installed yet (roadmap):** `ai`/`@ai-sdk/*`, `unpdf`/`mammoth`, `octokit` (AI résumé + GitHub import — the v3.0 headline). **Absent by choice:** ESLint (`tsc --noEmit` is the gate), Sharp, Prettier, shadcn.

### Verify against these, not training data — gotchas & bans

- **Next 16 request APIs are async:** `await cookies()` / `await headers()`; `params: Promise<…>` then `await params`. The sync forms are removed.
- **ISR:** `export const revalidate` + `generateStaticParams`; revalidate on save with **`revalidatePath('/' + username)` — literal path, NO 2nd arg** (the `'max'` / `{ expire: 0 }` profile belongs to `revalidateTag`, a different function).
- **@supabase/ssr triad** (browser / server / middleware). `getClaims()` / `getUser()` **verify** → use for authz. `getSession()` does **not** → UI hints only, never authz. Never `createBrowserClient` in middleware. Run no code between client-create and the auth call in middleware. `@supabase/auth-helpers-nextjs` is banned (deprecated).
- **Zod 4:** top-level formats — `z.email()` / `z.url({ protocol: /^https?$/ })`, never `z.string().email()`. The `protocol` allowlist is the stored-XSS gate (plain `z.url()` accepts `javascript:` / `data:`).
- **Tailwind v4:** single `@import "tailwindcss"` + `@theme` tokens. No `@tailwind base/components/utilities`, no `tailwind.config.js` as source of truth, no autoprefixer/postcss-import.
- **State:** never mirror server data into Zustand (TanStack Query owns it).
- **Images:** no Sharp / server image processing — client `react-cropper` → `<canvas>.toBlob('image/webp')`. Never add `cropperjs@2`.
- **Anon writes:** App Router route handler running service-role (`/api/contact`, `/api/report`, `/api/page-view`, `/api/media/upload`), never `pages/api`, never the anon key.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Full detail with `file:line` citations: `.planning/codebase/CONVENTIONS.md`. The load-bearing rules:

**Security invariants — each has tests + CI guards; violating one is a blocker:**
- **Zod on every write.** Client parse = UX; the **server re-parse is the gate**. `validateSectionContent(type, content)` (`src/lib/validations/sections.ts`) before any section write. Import schemas only from the `@/lib/validations` barrel.
- **Verified identity only.** `getVerifiedClaims()` / `getClaims()` for authz everywhere; `getSession()` is forbidden server-side (not even exported from `src/lib/supabase/server.ts`). Hard-fail on a missing `sub` — never `sub ?? ''` (that becomes a silent 0-row no-op).
- **SHARED-A write sequence** (every `'use server'` CMS write): `getVerifiedClaims()` → explicit `sub` guard → Zod re-parse → authenticated **RLS** write (NEVER service-role) → `revalidatePath('/' + username)` (literal, no 2nd arg) → `{ ok: true }`.
- **Explicit-column allowlists** on profile writes (never `...parsed`/`...input`); the protected-columns trigger guards 8 cols (`role`/`username`/`email`/`storage_used_bytes`/`locked`/…). Service-role short-circuits it.
- **`import 'server-only'`** as the first line of every secret-touching module (`service-role.ts`, `auth/turnstile.ts`, `trust/ip-hash.ts`); CI greps `.next/static` for the service-role key.
- **Enumeration-safe auth** — signup success and "already registered" return identical shapes; every login credential failure returns one generic message.

**Patterns:**
- **Action result shape:** `{ ok: true } | { ok: false; error?; fieldErrors? }`. Actions never throw to the caller; route handlers return typed JSON error bodies with **generic** messages (no rate-limit/internal-detail leaks).
- **Soft-enum section types (CMS-08):** a new type = one entry in `sectionContentSchemas` + its schema. **No Postgres migration** (`sections.type` is `TEXT`, no CHECK; `content` is schemaless JSONB gated only by Zod).
- **Two-layer UI tokens:** chrome (Evergreen & Copper `@theme`, Inter) vs scoped `.tmpl-*` template themes — never cross-reference; no inline hex outside `theme.css`; the chrome accent is focus-ring / link-hover / "available" only, never a button fill.
- **State split:** TanStack Query (`cmsKeys`) owns all server data; Zustand (`uiStore`) holds only `activeSectionId`/`dirty`/`dragState`/`checklistOpen`. Only reorder + eye-toggle are optimistic; content saves are not.
- **Public ISR invariant (D-22):** `/[username]` must stay `● SSG`/ISR. No `cookies()`/`headers()`/host-read on the public branch; the cookie-less anon read (`portfolio/get-portfolio.ts`) and the authenticated owner read (`get-portfolio-owner.ts`) stay in **separate** modules. Asserted by `tests/build/route-table-ssg.test.ts` + `npm run check:bundle`. Client components import templates from `template-meta.ts`, never `registry.ts` (keeps Zod off the public bundle).
- **Absolute URLs from `siteUrl()`** (`src/lib/url.ts`, driven by `NEXT_PUBLIC_SITE_URL`) — never the request Host. Domain switch = env + DNS + 301.
- **`'use server'` modules export only `async` functions** (Next 16 Turbopack rejects sync exports — why `isRecoverySession` is a separate plain module).
- **TS strict; `moduleResolution: bundler`; `tsc --noEmit` is the lint gate** (no ESLint). `z.infer` for write types; generated `Database` type (`src/types/database.ts`) for reads — regenerate after every schema change.
- **Template gating (GATE):** `templates.visibility` (`public`/`restricted`, soft-enum, no CHECK) + a `template_grants` (template×user) m2m. The picker is a data-layer allowed-list (public ∪ granted), and switching/rendering an ungranted restricted template is rejected server-side (mirrors the switch-action Zod/RLS gate). Grants are operator-only from `/admin/templates`; the one cross-user write is a self-gated `SECURITY DEFINER` RPC, never service-role.
- **Blog = CMS Markdown, never MDX:** posts are GFM Markdown rendered server-side to **sanitized HTML** with Shiki (display-only code, never executed). The only sanctioned `dangerouslySetInnerHTML` is that one sanitized path — no executable user content on the shared multi-tenant domain.
- **BotID degrade-open:** every `checkBotId()` call is wrapped (try/catch → default `isBot=false`) so a BotID outage / missing `VERCEL_OIDC_TOKEN` never 500s; it is defense-in-depth layered *above* Turnstile + per-IP rate-limits (the primary gates). `/api/page-view` silent-drops bots (200 `{ok:true}`); `/api/contact`+`/api/report` return the generic 403; the gate sits after Zod.
- **Conventional Commits**, scoped by phase (`feat(08-03): …`). Decision-ref comments (`// WR-05`, `// D-08`) point to the `.planning/STATE.md` decision log.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Full detail (component table, data-flow diagrams, security layers): `.planning/codebase/ARCHITECTURE.md`; directory map in `.planning/codebase/STRUCTURE.md`.

**Shape:** a multi-tenant CMS **write-path** (owner-authenticated Server Actions + service-role route handlers) and a separate anonymous **ISR/SSG read-path** (public portfolio pages). Two segregated Next 16 root layouts enforce the two-layer UI identity.

- **Route groups:** `(chrome)` root (`src/app/(chrome)/`) = Inter + Evergreen/Copper tokens + TanStack Query/Zustand → `/` (real product landing page, `force-static`) `/login` `/signup` `/onboarding` (first-run wizard) `/dashboard` (+ `/dashboard/settings` account mgmt, `/dashboard/inbox`) `/admin` (+ `/admin/templates`, `/admin/insights`) `/legal`. `(portfolio)` root (`src/app/(portfolio)/[username]/`) = lean, cookie-less, no chrome → public pages: `/[username]`, `/[username]/blog`, `/blog/[slug]`, `/services`, + the per-username `opengraph-image` Route Handler segment (its own SSG/ISR, keeps `/[username]` `● SSG`). Plus bare `/auth/confirm` and `/api/*`.
- **Write path:** `EditorShell` → `saveSectionAction` (`'use server'`, SHARED-A) → RLS UPDATE → `revalidatePath`. Files: `src/lib/cms/*-action.ts`.
- **Read path:** `/[username]/page.tsx` → `getPortfolioByUsername` (cookie-less anon read of `public_*` `security_invoker` views) → `slugForTemplateId` (static UUID→slug map, no DB join) → `<TemplateRenderer>` → lazy `next/dynamic` template root.
- **Template engine:** `src/components/templates/` — `registry.ts` (slug→dynamic import + slug↔UUID map + `templateSlugSchema`), a shared chrome-free **`_kit/`** (the 2 client islands ThemeToggle + ScrollReveal + the pre-paint FOUC guard — slug-agnostic, zod-free, imported never re-implemented), and per-template folders (live: `minimal/`, `editorial/`, `aurora/`, `edgerunner-v2/`, `atelier/` — the v2.8 `creative`-category image template, `blueprint/` — the dev "engineering bench", the first *public* page-capable template), each a Server-Component root + scoped `theme.css`. The formalized contract is `contract.ts`/`CONTRACT.md`; `PortfolioData` (`templates/types.ts`) is the one typed contract every template consumes (all view columns are `| null` — null-guard). Per-template `spec.ts` does field-gating + mismatch warnings. New templates are gated by the `gate:template` umbrella (`scripts/gate-template.mjs`) + the CI `template-gate` job. Shipping a template ALSO requires generating its picker thumbnail — run `scripts/generate-template-thumbnails.mjs` and commit `public/templates/<slug>.webp`; **no gate checks the file exists**, so a missing one ships a silently-broken picker preview (the full registration checklist lives in the `lovable-ingest` skill's translation-playbook).
- **Service-role routes** (`runtime='nodejs'`, `supabaseAdmin`, bypass RLS): `/api/contact`, `/api/report`, `/api/page-view`, `/api/media/upload`, and `/api/account/delete` (v2.5 — verified-identity → reauth → own-folder Storage sweep → `admin.deleteUser` cascade) — each Zod + rate-limit gated, with Turnstile(fail-closed) on the human-facing ones and a degrade-open BotID layer. These are the only sanctioned RLS bypass. (Account export `/api/account/export` is authenticated-RLS, NOT service-role.)
- **Security:** RLS is the tenant boundary (`*.own_all` policies on `auth.uid()`; cross-tenant writes hit 0 rows); protected-columns trigger; three-layer public-column safety (anon REVOKE + column GRANT + `security_invoker` views) keeps `email`/`role`/`storage_used_bytes`/`locked` off anon; service-role is `server-only`. Migrations in `supabase/migrations/`.
- **Entry points:** `middleware.ts` (session refresh + redirect-unauth from `/dashboard`,`/admin`), the `/dashboard` RSC also redirects a not-yet-onboarded owner (`profiles.onboarded_at IS NULL`) into `/onboarding` (one-shot `onboarding-skip` cookie soft-skip); `src/app/(portfolio)/[username]/page.tsx` (ISR `revalidate=3600`; the `draftMode().isEnabled` owner branch is the single sanctioned dynamic path), `src/app/(chrome)/(dashboard)/dashboard/page.tsx`, seed `scripts/seed-founder-portfolio.ts`.
- **Data model:** 15-table Postgres (v1.0's 12 + `template_grants` (gating) + `blog_post_history` (blog) + `activation_events` (v2.5 funnel — write-once, own-INSERT RLS, no SELECT)); plus the additive `profiles.onboarded_at` first-run marker. `sections.content` schemaless JSONB gated only by Zod; one section per type (`UNIQUE(portfolio_id, type)`); soft-enum `type` (13: hero/about/projects/testimonials/experience/contact/blog_preview/skills + education/metrics/services/moodboard/certifications). Profession-agnostic + additive by design — a new profession's section is a code change, not a migration.

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
