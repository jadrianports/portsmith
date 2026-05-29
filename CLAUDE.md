<!-- GSD:project-start source:PROJECT.md -->

## Project

**Portsmith**

Portsmith is a multi-tenant hosting platform that lets people — especially **non-technical professionals** (marketers, virtual assistants, freelancers, and other professions) — publish a polished, single-scroll portfolio by filling in structured content and choosing a curated template. The platform owns the templates; the user owns the content. You cannot design your own layout, and that is the point: it is fast and **hard to make ugly**.

The product's *first* template is developer-flavored — the founder is the first user and wants their own portfolio live first — but the data model and roadmap are built for non-technical professionals. Developers are simply the first profession served; **marketers are the next expansion.**

**Core Value:** A non-technical professional can turn their existing experience into a published, professional web presence in ~15 minutes — without designing anything, and without being able to make it look bad.

If everything else fails, *this* must hold: pick a template, fill in structured fields, publish a good-looking portfolio. Speed plus a guaranteed-professional result is the whole wedge.

### Constraints

- **Tech stack**: Next.js 16 (App Router / RSC), Tailwind, Supabase (Postgres / Auth / Storage), Zustand + TanStack Query, Zod (validation gate on *every* write), Resend (email), Cloudflare Turnstile (spam), Vercel (hosting); Vitest + Playwright + local-Supabase RLS integration tests. Three.js deferred. — Inherited from the handoff; proven and profession-agnostic.
- **Security (non-negotiable invariants)**: RLS is the tenant boundary; a protected-columns trigger guards `role` / `username` / `storage_used_bytes` / etc.; contact and page-view writes go through a server-side service-role route, never the anon key; storage has MIME allowlists + size caps + a usage trigger; public profile reads must not leak private columns.
- **Data model**: must stay profession-agnostic and additive — section `type` is a soft enum so marketer / other-profession expansion needs no migration.
- **Budget**: **$0 on domains now** — launch on the free `*.vercel.app` (`portsmith.vercel.app/[username]`) with free-tier Supabase/Vercel. The first domain dollar is a public-launch / production-email expense, not a build expense. (`portsmith.app` is the intended future brand domain — handoff ADR-002.)
- **Hosting / URLs**: build rendering hostname-aware and drive absolute URLs from `NEXT_PUBLIC_SITE_URL`, so switching `.vercel.app` → a real domain later is an env-var + DNS + 301-redirect change — done *before* any big public/SEO push.
- **Page model**: single-page, one scroll; one section per type for the MVP.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js** | **16.2.6** (App Router / RSC) | Framework: routing, RSC, ISR, server actions, route handlers | Best-in-class static+dynamic blend for public pages (ISR) + an authenticated dashboard; first-class Vercel integration. **v16 makes the request-data APIs async — this is the #1 migration gotcha (see Pitfalls).** |
| **React** | **19.2.6** | UI runtime (pulled by Next 16) | Next 16 requires React 19. Server Components are the default; `use()` and Actions are stable. Don't pin React separately — let Next own it. |
| **Supabase** | Platform (self-hosted CLI for tests) | Postgres + RLS (tenant boundary), Auth, Storage | RLS *is* the multi-tenant isolation model — exactly the security-reviewed design in the handoff. One managed service covers DB + auth + object storage on a free tier. |
| **@supabase/supabase-js** | **2.106.2** | JS client (browser + server + service-role) | Current v2 line. Pairs with `@supabase/ssr` for cookie-based SSR auth. |
| **@supabase/ssr** | **0.10.3** | SSR auth: cookie-based session for App Router (browser client, server client, middleware refresh) | **The only supported SSR auth path.** Replaces the long-deprecated `@supabase/auth-helpers-nextjs`. Provides `createBrowserClient` / `createServerClient` with a `getAll`/`setAll` cookie interface. |
| **Tailwind CSS** | **4.3.0** | Styling for dashboard + templates | v4 is a major shift: **CSS-first config** (`@import "tailwindcss"` + `@theme`), Oxide engine (much faster), `@tailwindcss/postcss` plugin. No `tailwind.config.js` by default. |
| **TanStack Query (react-query)** | **5.100.14** | **Server state** in the dashboard (fetch/cache/mutate portfolio data, optimistic edits, invalidation) | The standard for client-side server-state. v5 API is object-form everywhere (`useQuery({...})`, `useMutation({...})`). Clean RSC hydration via `dehydrate` + `HydrationBoundary`. |
| **Zustand** | **5.0.14** | **UI state** only (editor open/closed, active section, drag state, unsaved-flag) | Tiny, unopinionated, no provider boilerplate. The intended split — **Zustand = ephemeral UI, TanStack Query = server data** — is the correct, non-overlapping division (see Architecture note below). |
| **Zod** | **4.4.3** | Validation gate on **every write** (forms, server actions, route handlers, AI-import output, env) | v4 is current and stable. Big perf win + smaller types vs v3. **API change:** string formats moved to top-level (`z.email()` not `z.string().email()`). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **resend** | **6.12.4** | Transactional email (contact-form notifications; optionally Supabase auth-email SMTP) | Contact-form "you got a message" emails from the server route. For *auth* emails see the SMTP caveat below. Supports React Email via the `react:` field. |
| **@marsidev/react-turnstile** | **1.5.2** | Cloudflare Turnstile widget (client React component) | Renders the Turnstile challenge on the contact form. **Server-side `siteverify` is a plain `fetch` — no SDK needed** (see Pitfalls for the exact call). |
| **@tanstack/react-query-devtools** | matches 5.x | Query cache inspection in dev | Dev-only; helps debug stale/invalidation behavior in the dashboard. |
| **react-cropper** | **2.3.3** | Client-side image crop UI (avatar / cover) | The crop UI. **It depends on `cropperjs@^1.5.13`, NOT cropperjs 2.x** — do not install cropperjs 2 alongside it (see Pitfalls). Output goes to a `<canvas>` → `toBlob('image/webp')`. No `Sharp`, no server image processing — correct for Vercel free tier. |
| **ai** (Vercel AI SDK) | **6.0.193** | Résumé/CV → structured portfolio draft (the AI onboarding accelerator) | Use `generateObject` / `Output.object()` with a **Zod schema** to extract structured fields from résumé text. Provider-agnostic. Fast-follow feature, not launch-blocking. |
| **@ai-sdk/anthropic** *or* **@ai-sdk/openai** | **3.0.81** / **3.0.66** | LLM provider for the AI SDK | Pick one provider. Anthropic and OpenAI both do structured extraction well; choose on cost/latency. The AI SDK abstracts the call so this is swappable. |
| **unpdf** | **1.6.2** | Extract text from uploaded résumé PDFs (serverless-friendly) | **Recommended PDF text extractor** — it's a serverless-optimized wrapper around a build of pdf.js, no native binaries, runs in Node/edge/Vercel functions. Feed extracted text to the AI SDK. |
| **mammoth** | **1.12.0** | Extract text from `.docx` résumés (optional) | Only if you accept Word uploads in addition to PDF. Converts `.docx` → plain text/HTML. |
| **octokit** | **5.0.5** | GitHub API client (the dev-flavored import) | Fetch repos/profile/pinned items for the founder's dev portfolio import. Use the umbrella `octokit` package; it bundles REST + pagination + auth. Dev-flavor only. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Vitest** | **4.1.7** — unit/integration test runner | Fast, Vite-native, Jest-compatible API. Use for Zod schemas, server-route logic, and **local-Supabase RLS integration tests** (spin up `supabase start`, run policies against real Postgres). |
| **@playwright/test** | **1.60.0** — E2E browser tests | Walking-skeleton happy path: sign up → fill content → publish → public page renders. Also good for verifying `noindex`/SEO and the auth redirect flow. |
| **Supabase CLI** | local Postgres + migrations + `gen types` | Run RLS tests against a real local stack (the integration-test strategy in the constraints). Generate `Database` types and pass them to `createServerClient<Database>` for end-to-end type safety. |
| **TypeScript** | 5.x (latest) | Strict mode. Zod-inferred types (`z.infer`) for write payloads; Supabase-generated `Database` type for reads. |
| **@tailwindcss/postcss** | matches 4.x | The v4 PostCSS plugin — replaces the v3 `tailwindcss` PostCSS entry and removes the need for `autoprefixer` + `postcss-import`. |

## Installation

# Core framework (React comes transitively, correctly pinned by Next)

# Supabase (DB/Auth/Storage + SSR cookie auth)

# State

# Validation

# Styling (Tailwind v4 — note the @tailwindcss/postcss plugin)

# Email + spam

# Image crop (pulls cropperjs@^1 transitively — do NOT add cropperjs@2)

# AI résumé import (fast-follow) + PDF/docx text extraction

# optional, only if accepting Word docs:

# GitHub import (dev flavor only)

# Dev / test

# Supabase CLI for local RLS tests (or use npx supabase ...)

## The patterns that actually changed (verify against these, not training data)

### 1. Next.js 16 — request-data APIs are **async**

### 2. Next.js 16 — ISR + on-demand revalidation (public portfolio pages)

### 3. supabase-js v2 SSR auth — the `@supabase/ssr` triad

- **Browser** (`createBrowserClient`) — Client Components.
- **Server** (`createServerClient` with `cookies()` from `next/headers`) — Server Components / route handlers / server actions.
- **Middleware** (`createServerClient`, **not** `createBrowserClient`) — refreshes the session on every request and writes refreshed cookies to **both** the request and the `NextResponse`.
- **`getUser()` / `getClaims()` for authorization** — they verify the token. `getClaims()` validates the JWT signature locally against published asymmetric keys (newer, no network round-trip when keys are cached) and is now Supabase's recommended check.
- **Never trust `getSession()` for authz in server code** — it reads cookies without verifying. Use it only for non-security UI hints.
- Do not run code between client creation and the auth call in middleware — it breaks the refresh/cookie-write timing.

### 4. TanStack Query v5 + Zustand — non-overlapping responsibilities

- **TanStack Query** owns *server* data: portfolio, sections, items. Mutations invalidate on success.
- **Zustand** owns *ephemeral UI*: which panel is open, drag state, dirty flag. **Never** mirror server data into Zustand — that reintroduces the cache-sync bug TanStack Query exists to kill.

### 5. Zod 4 — top-level string formats

### 6. Cloudflare Turnstile — server `siteverify` is a raw fetch

### 7. Tailwind v4 — CSS-first setup

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | **Never** — deprecated and unmaintained. `@supabase/ssr` is the only supported SSR auth path. |
| `unpdf` for PDF text | `pdf-parse` (2.4.5), `pdfjs-dist` (5.7.284) | `pdf-parse` works but is heavier/less serverless-friendly; raw `pdfjs-dist` if you need page-level layout/coordinates. For "extract text → LLM", `unpdf` is the lean choice. |
| `octokit` (umbrella) | `@octokit/rest` (22.0.1) | Use `@octokit/rest` if you want only REST and a smaller dep surface; the umbrella `octokit` is fine and includes pagination/throttling plugins. |
| AI SDK `generateObject` + Zod | Raw provider SDK + manual JSON parse | Only if you outgrow the AI SDK's provider abstraction; for résumé→schema extraction the SDK's schema-validated output is strictly better than hand-parsing JSON. |
| Resend custom SMTP for auth email | Supabase **default** email service | At launch (no verified domain) lean on Supabase's built-in email; switch auth email to Resend SMTP once a domain is verified (see variant below). |
| `@marsidev/react-turnstile` | Hand-rolled `<script>` + global callback | The component handles script loading, reset, and React lifecycle; only hand-roll if you're avoiding the dependency. Server verify is identical either way. |
| Zustand (UI) + TanStack Query (server) | Redux Toolkit / Jotai | Overkill here. The two-tool split is lighter and matches the dashboard's needs. Jotai only if you specifically want atomic state. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Deprecated; doesn't follow the App Router cookie model | `@supabase/ssr` (`createServerClient` / `createBrowserClient`) |
| `supabase.auth.getSession()` for authorization in server code | Reads cookies **without verifying** the JWT — spoofable | `getUser()` or `getClaims()` (verified) on the server/middleware |
| `createBrowserClient` inside middleware | Middleware must refresh + persist via request/response cookies | `createServerClient` in middleware with `getAll`/`setAll` |
| Synchronous `cookies()` / `headers()` / sync `params` | **Removed in Next 16** — they're Promises now | `await cookies()` etc.; `params: Promise<…>` then `await params` |
| `cropperjs@2.x` | Full rewrite (web-components API); **incompatible with `react-cropper@2.3.3`**, which needs `cropperjs@^1` | Let `react-cropper` pull `cropperjs@^1` transitively; don't add cropperjs yourself |
| `Sharp` / server-side image processing | Heavy native binary; unnecessary on Vercel free tier; the design is client-side resize | `react-cropper` → `<canvas>.toBlob('image/webp', q)` then upload the WebP |
| `tailwind.config.js` as the source of truth (v3 mental model) | v4 is CSS-first; the JS config path is legacy | `@import "tailwindcss"` + `@theme` tokens in CSS |
| `@tailwind base/components/utilities` directives | Removed in v4 | Single `@import "tailwindcss";` |
| `pages/api` route style for the contact write | Legacy router; you're on App Router | App Router **route handler** (`app/api/contact/route.ts`) running service-role, server-only |
| `revalidateTag(tag)` single-arg (Next ≤15 habit) | Next 16 expects the cache-profile 2nd arg | `revalidateTag(tag, 'max')` or `{ expire: 0 }` |
| Mirroring server data into Zustand | Recreates cache-invalidation bugs TanStack Query solves | TanStack Query for all server data; Zustand for UI-only state |

## Stack Patterns by Variant

- Drive every absolute URL (SEO canonical, JSON-LD, sitemap, email links) from `NEXT_PUBLIC_SITE_URL` so the later `.vercel.app → portsmith.app` switch is env + DNS + 301 only — exactly the relocatable-rendering constraint.
- **Auth email caveat:** Resend production sending **requires a verified domain**; `onboarding@resend.dev` is test-only and not appropriate for real signup emails. So at launch, use **Supabase's default auth-email service** for confirmation/reset, and reserve Resend for the contact-form notification you control. Supabase's default auth email also has low free-tier limits (built-in service is rate-limited; custom SMTP starts at ~30/hr until raised) — fine for early volume.
- Wire **Resend as Supabase's custom SMTP** (Dashboard → Auth → SMTP, or Management API `config/auth`) so auth emails come from your domain and aren't rate-limited by the shared service. Optionally move richer transactional emails to a Supabase **Auth send-email hook** Edge Function rendering React Email via Resend.
- ISR (`export const revalidate`) + `generateStaticParams` for known usernames + **`revalidatePath('/[username]')` on publish/save**. Keeps public pages CDN-fast and cheap, fresh-on-edit, and friendly to the "fast single-scroll" promise.
- `noindex` until published *and* reasonably complete (per the trust-and-safety requirement) — set robots metadata conditionally in `generateMetadata`.
- TanStack Query for data + optimistic reorder/show-hide; Zustand for editor UI; Zod on every mutation payload **and** at the server boundary (route handler / server action) — client validation is UX, server validation is the gate.
- PDF/docx → text (`unpdf` / `mammoth`) → `generateObject({ schema: PortfolioDraftSchema })` (AI SDK + Zod) → user reviews/edits before save. **Validate the LLM output with the same Zod schemas** as manual entry — never trust model output into the DB directly.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@16.2.6` | `react@19.2.6`, `react-dom@19.2.6` | Next 16 requires React 19; let Next pin them. |
| `@supabase/ssr@0.10.3` | `@supabase/supabase-js@2.106.2` | Use together; pass a generated `Database` type to both clients. |
| `react-cropper@2.3.3` | `cropperjs@^1.5.13`, `react@>=17` | **Pulls cropperjs v1 transitively. Do not install cropperjs@2 — it will break the component.** |
| `tailwindcss@4.3.0` | `@tailwindcss/postcss@4.x`, `postcss` | v4 needs the new PostCSS plugin; drop `autoprefixer` + `postcss-import` (handled internally). |
| `ai@6.0.193` | `@ai-sdk/anthropic@3.0.81` / `@ai-sdk/openai@3.0.66`, `zod@4` | AI SDK v6 accepts Zod schemas directly for structured output. |
| `zod@4.4.3` | everything above | If a transitive lib needs Zod 3 APIs, v4 ships `zod/v3` and `zod/v4` subpaths for side-by-side use. |
| `@tanstack/react-query@5.x` | `react@19` | v5 is object-form API; `HydrationBoundary`/`dehydrate` for RSC hydration. |

## Open Items / Flags for the Roadmap

## Sources

- `/vercel/next.js` (Context7, v16.x) — async `cookies`/`headers`/`params`/`draftMode`, `next-async-request-api` codemod, ISR (`revalidate`, `generateStaticParams`), `revalidatePath`/`revalidateTag` (incl. the new second-arg profile), `unstable_cache`. **HIGH.**
- `/supabase/ssr` (Context7) — `createServerClient` signature, `getAll`/`setAll` cookie interface, middleware-required refresh model, `getUser()` vs `getSession()` vs `getClaims()`, "no code between client creation and auth call." **HIGH.**
- `/supabase/supabase` (Context7) — custom SMTP via Dashboard/Management API, Resend auth send-email hooks, default-service rate limits (~30/hr initial). **HIGH.**
- `/tanstack/query` (Context7, v5) — `useQuery`/`useMutation` object form, `invalidateQueries`, `setQueryData`, `dehydrate` + `HydrationBoundary` RSC hydration, `defaultOptions`. **HIGH.**
- `/colinhacks/zod` (Context7, v4) — top-level string formats (`z.email()` etc.), `zod/v3`+`zod/v4` subpaths. **HIGH.**
- `/websites/tailwindcss` (Context7, v4) — `@tailwindcss/postcss`, `@import "tailwindcss"`, `@theme`, removal of `@tailwind` directives + autoprefixer/postcss-import. **HIGH.**
- developers.cloudflare.com/turnstile/get-started/server-side-validation — `siteverify` endpoint, params (`secret`/`response`/`remoteip`/`idempotency_key`), single-use 5-min tokens, response fields, "verify only in backend." **HIGH.**
- ai-sdk.dev/docs/ai-sdk-core/generating-structured-data — AI SDK v6 structured output with a Zod schema (`generateObject`/`Output.object`), provider packages. **HIGH.**
- resend.com/docs/send-with-nextjs — `Resend` client, `emails.send`, React Email via `react:`, verified-domain requirement (`onboarding@resend.dev` is test-only). **HIGH.**
- npm registry (live, 2026-05-29) — exact current versions for every package listed. **HIGH.**

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
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
