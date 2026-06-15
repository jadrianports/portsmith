# Runbook: Production Launch & Verification (LAUNCH-01..10)

> **Purpose.** The single master entry point that sequences the Portsmith production
> launch and verifies every prior pillar live on `portsmith.vercel.app`. This runbook
> **orchestrates — it links, it does not rewrite.** It points at the three existing
> runbooks for the cost/abuse/notify config they already own, and references the
> committed artifacts the rest of Phase 23 produced (`.vercelignore`, `check-env.mjs`,
> `lighthouserc.json`, the `prod-smoke` spec, the demo seeds, `og-default.png`). What it
> *adds* is the orchestration: the Vercel CLI deploy path, the 9-key prod-secret
> inventory, the prod Supabase bootstrap order, the prod Turnstile wiring, the
> email-delivery posture, the LHCI + smoke procedure, the explicit **go/no-go gate**, and
> `vercel rollback` recovery. Re-deploys are repeatable: re-run the one command.
>
> **Requirements:** LAUNCH-01..10 · **Decisions:** D-01..D-11 (Phase 23 context) ·
> **Phase:** 23-production-launch-verification
> **Constraint context:** Portsmith launches on **$0 / free tier** — the free
> `*.vercel.app` origin (`https://portsmith.vercel.app`), a fresh free-tier hosted
> Supabase project, and free-tier Vercel. **The first domain dollar is a public-launch /
> production-email expense, not a build expense** (per `CLAUDE.md`). The real brand
> domain (`portsmith.app` — handoff ADR-002) is a later env + DNS + 301 change, *not* a
> launch blocker; nothing here buys a domain.

---

## Acceptance posture (read first — D-01/D-09)

This runbook is the **documentation half** of the launch. The deploy itself — running
`vercel --prod`, provisioning the hosted Supabase project, wiring prod Turnstile keys,
enabling the spend cap / WAF / BotID / usage alerts, configuring SMTP — is a sequence of
**founder-owned dashboard/CLI actions (⚑)** and does **NOT gate phase completion.**

- **Acceptance = this runbook exists and is correct** (named sections present, correct
  cross-links, the documented steps name the real artifacts / scripts / keys) — **NOT
  that the cloud is configured.** Same precedent as `security-cost-hardening.md` and
  `usage-cost-tripwire.md` (acceptance is docs-exist-and-correct).
- **Every ⚑ dashboard step carries a "confirm in the dashboard at deploy" hedge** —
  Vercel / Supabase / Cloudflare / Resend free-tier labels, limits, and surfaces drift.
  Read the live UI when configuring, and reconcile this runbook if a label differs.
- **LINK, do not duplicate.** The spend-cap, WAF, usage-alert, and contact-notify *steps*
  live in their own runbooks (§7). This file cross-links them and never restates them —
  duplication causes drift.

---

## Notification recipient

All usage / spend / abuse / alert recipients are the single operator inbox (the same
recipient the linked runbooks use):

**`james@eulclavieoutsourcing.com`**

If/when the team grows, add recipients here and in the dashboards — do not replace this
address.

---

## 1. CLI deploy path (D-01 / D-04 / LAUNCH-01 / LAUNCH-10)

The deploy is **Vercel CLI from the local working tree** — no git remote, no
Git-integration, no preview-per-PR. The CLI uploads the **working tree** (honoring the
committed [`.vercelignore`](../../.vercelignore) — plan 23-03), **not git history** — so
`.planning/` (gitignored, and only embedded in `master`'s history) never travels. ⚑ The
deploy *action* is founder-run; the *path* below is the deliverable.

```bash
vercel login                 # once
vercel link                  # once — links this local dir to the prod project (no git remote)
vercel --prod                # each deploy — uploads the tree (NOT git history), honoring .vercelignore
# verify/manage prod env (see §2):
vercel env ls production
# debug a bad deploy:
vercel logs --environment production
```

- **`NEXT_PUBLIC_SITE_URL=https://portsmith.vercel.app`** in prod (§2). Every absolute
  URL derives from `siteUrl()` (`src/lib/url.ts`) — never the request Host. A real-domain
  switch later stays env + DNS + 301 only.
- **No `vercel.json` / `vercel.ts` (D-03).** Standard Next.js project, framework
  auto-detected; the CSP / HSTS / nosniff / Referrer-Policy / Permissions-Policy security
  headers already live in `next.config.ts` `headers()` (Phase 16). Do **not** add a
  `vercel.json` — it would duplicate / diverge.
- **`.vercelignore` precedence (verified, plan 23-03):** when `.vercelignore` exists,
  Vercel uses it **instead of** `.gitignore` (not merged) — the committed file is
  self-sufficient and re-covers `.env.local`. It excludes `.planning/`, `docs/`,
  `supabase/`, `tests/`, `e2e/`; it ships `scripts/` (the build runs `check-env.mjs`),
  `src/`, `public/`, `next.config.ts`, `package.json`. `supabase/` is safely excluded
  because the prod DB is provisioned out-of-band via `db push` (§3), not from the build.
- **Confirm the committed [`public/og-default.png`](../../public/og-default.png)** ships
  (LAUNCH-09 — the branded 1200×630 OG fallback served on chrome pages that have no
  dynamic share card; `public/` is *not* excluded by `.vercelignore`).

---

## 2. Prod-secret inventory (LAUNCH-05)

The single source for this list is [`.env.example`](../../.env.example). The build runs
[`scripts/check-env.mjs`](../../scripts/check-env.mjs) via the `prebuild` npm lifecycle
(plan 23-02) — scoped to `VERCEL_ENV=production` — and **hard-fails the prod build** if
any of the nine required keys below is missing or empty, so a half-configured app never
ships. `check-env.mjs` logs key **names + present/MISSING only**, never a value.

⚑ Set all nine in the Vercel **Production** environment (`vercel env add <KEY> production`
or the dashboard → Settings → Environment Variables), then redeploy.

| # | Key | Where it is obtained | Notes |
|---|-----|----------------------|-------|
| 1 | `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project → Settings → API | Public (browser-shipped); RLS protects data, not its secrecy. |
| 2 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API | Public anon key. |
| 3 | `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API | **Server-only secret** — never `NEXT_PUBLIC_`; CI greps `.next/static` for it. |
| 4 | `NEXT_PUBLIC_SITE_URL` | Set by hand | `https://portsmith.vercel.app` (the prod origin; drives `siteUrl()`). |
| 5 | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile dashboard (§4) | Public site key — the **real** key, not the always-pass test key. |
| 6 | `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile dashboard (§4) | Server-only secret-verify key. |
| 7 | `REPORT_IP_HASH_SECRET` | A generated random secret (e.g. `openssl rand -hex 32`) | Server-only; hashes client IPs for the per-IP rate-limit ledgers (Phase 16). Degrades-open if unset (no lockout) but **required in prod**. See [`16-HUMAN-UAT.md`](../../.planning/phases/16-security-cost-hardening/16-HUMAN-UAT.md). |
| 8 | `RESEND_API_KEY` | Resend dashboard → API Keys (§5) | Server-only. See [`./contact-notify-resend.md`](./contact-notify-resend.md). |
| 9 | `RESEND_FROM_EMAIL` | Resend dashboard (§5) | An address on a **verified** Resend sending domain in prod. |

**Warn-only (degrade-open — NOT a hard-fail):** `VERCEL_OIDC_TOKEN` is Vercel-managed /
auto-injected for BotID. BotID degrades-open on its absence (a missing token never 500s —
it is defense-in-depth above Turnstile + the per-IP caps), so `check-env.mjs` warns but
does not block. **Do not set it by hand.**

> `ADMIN_EMAIL` (in `.env.example`) is read only by the one-time `promote-admin` script
> (§3), not by the running app — it is not in the nine build-time required keys.

---

## 3. Production Supabase bootstrap order (D-05 / D-06 / D-07)

A **fresh hosted free-tier Supabase project** is provisioned for production (dev keeps the
local stack). Schema reaches prod via `supabase db push` — no manual SQL. **Order matters:
`db push` MUST precede `promote-admin` / the seeds** (the `profiles` / `templates` tables +
the `handle_new_user` trigger must exist first; the demos depend on the `aurora` /
`minimal` / `editorial` template rows that the migrations create).

```bash
# 1. [⚑] Provision a fresh hosted free-tier Supabase project (dashboard).            D-05
# 2.     supabase login --token sbp_...           (or interactive)
# 3.     supabase link --project-ref <ref>        (prompts for the DB password)
# 4.     supabase db push                         # applies ALL supabase/migrations/*.sql  D-06
#            └─ incl. 003_storage_buckets.sql → buckets + RLS policies provision WITH the schema.
#            └─ NOTE: the known Supabase CLI regression is `gen types --local`, NOT `db push`.
#               `db push` is unaffected — do not block on the gen-types issue.
# 5. [⚑] Set the deployed app's Vercel prod env to the prod Supabase URL / anon /
#         service-role keys (+ the other 6 secrets from §2).
# 6.     promote-admin against prod (NO tripwire — point at prod by setting prod env FIRST):
#         NEXT_PUBLIC_SUPABASE_URL=<prod> SUPABASE_SERVICE_ROLE_KEY=<prod> ADMIN_EMAIL=<...> \
#           npm run promote-admin
# 7.     Seed the demos against prod (the seeds enforce a non-localhost tripwire → SEED_TARGET=prod):
#         SEED_TARGET=prod NEXT_PUBLIC_SUPABASE_URL=<prod> SUPABASE_SERVICE_ROLE_KEY=<prod> \
#           npm run seed:founder      # then: npm run seed:minimal / seed:editorial / seed:aurora
# 8. [⚑] Configure Supabase Auth SMTP via Resend (Auth → Email) — confirmation/recovery.  §5 / LAUNCH-04
# 9.     Smoke (§6: the public spec + the manual gated checklist).                         LAUNCH-08
```

- **Target-DB selection (the critical "how"):** `promote-admin.ts` and the seeds select
  the target DB **purely from `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`** in
  env — there is no `--target` flag. You point at prod by setting those env vars to the
  prod values. The seeds add a safety tripwire: a non-localhost URL **refuses to write**
  unless `SEED_TARGET=prod` is set. `promote-admin.ts` has **no** such tripwire, so be
  explicit that promoting against prod means setting the prod env first.
- **⚑ Demo accounts must be created via normal signup FIRST on prod.** The seeds bootstrap
  an auth user only on a *local* target; on prod each demo persona
  (`devon-park`, `lena-voss`, `jadrianports`, `aurora-demo`) needs a real signed-up account
  before its seed runs. The seeds then UPSERT the profile / portfolio / sections (every
  write Zod-gated) and publish.
- **The four demo usernames** are the single-source `DEMO_USERNAMES`
  ([`scripts/seed/demo-usernames.ts`](../../scripts/seed/demo-usernames.ts) — plan 23-01),
  imported by the LHCI config and the prod smoke so they cannot drift:

  | Template | Username | Seed |
  |----------|----------|------|
  | `minimal` | `devon-park` | `npm run seed:minimal` |
  | `editorial` | `lena-voss` | `npm run seed:editorial` |
  | `edgerunner-v2` | `jadrianports` (founder) | `npm run seed:founder` |
  | `aurora` | `aurora-demo` (marketer) | `npm run seed:aurora` |

---

## 4. Prod Turnstile wiring (LAUNCH-03)

The dev / test environment uses Cloudflare's **always-pass** Turnstile test keys. For prod:

1. ⚑ In the **Cloudflare Turnstile dashboard**, create a widget for the
   `portsmith.vercel.app` hostname and copy its **site key** + **secret key**.
2. ⚑ Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (the real site key) and `TURNSTILE_SECRET_KEY`
   (the real secret key) in the Vercel prod env (§2, keys 5–6), replacing the test keys;
   redeploy.
3. **Verify with the manual gated smoke (§6 / D-14)** — a real signup must render the real
   Turnstile widget and pass real server-side `siteverify`. **No** test keys, **no**
   programmatic bypass — a stubbed run is exactly what would defeat LAUNCH-03.

> Turnstile is fail-closed on the human-facing routes (`/signup` / `/login` /
> `/forgot-password` and `/api/contact` / `/api/report`); BotID (§7) layers above it,
> degrade-open. Confirm both at deploy.

---

## 5. Email-delivery posture (LAUNCH-04 / OQ-1)

Two transactional-email surfaces both flow through **Resend**: Supabase **Auth** email
(signup confirmation + password recovery, via custom SMTP configured in the Supabase
dashboard → Auth → Email) and the **contact-notify** seam
([`./contact-notify-resend.md`](./contact-notify-resend.md) — the source of truth for the
verified-sending-domain dependency; do not restate its steps here).

OQ-1 (RESOLVED) splits email into two explicitly-documented postures:

**(a) Immediate founder-proof check — what launch verifies now.** Send a real signup +
password-recovery to the **founder's own email address** and confirm delivery. This works
on `*.vercel.app` without owning a brand domain by using Supabase default SMTP or Resend's
shared `onboarding@resend.dev` test sender (which delivers **only to the Resend account
owner** — i.e. the founder). The **manual gated smoke (§6 / D-14)** exercises exactly this,
and the go/no-go gate's "founder-proof email delivery" item (§8) asserts it.

**(b) Domain-gated follow-up — the documented known-gap.** Reliable signup-confirmation /
recovery email to **arbitrary new-user addresses** needs a **verified Resend sending
domain** + Supabase Auth SMTP switched to it. That is gated on the **first domain dollar**
(per `CLAUDE.md`, a production-email expense). The DNS-only path: verify a sending domain
in Resend (SPF / DKIM / DMARC records — see
[`./contact-notify-resend.md`](./contact-notify-resend.md)), set `RESEND_FROM_EMAIL` to an
address on it, switch Supabase Auth SMTP to that domain. This **decouples the email domain
from the app domain** — the app can stay on `*.vercel.app`.

> **Real multi-user / arbitrary-recipient email is an explicit DOCUMENTED known-gap in the
> go/no-go gate (§8), NOT a phase blocker.** The launch ships with founder-proof email
> verified; real-user email is the deliberate post-domain follow-up.

---

## 6. LHCI + smoke procedure (LAUNCH-02 / LAUNCH-08)

Run all of these **after** each prod deploy. The configs are committed and deploy-gated
(no dev server, no local URLs).

### 6a. Lighthouse-CI (LAUNCH-02 — closes `lighthouse-deploy-reverify`)

```bash
npm run lighthouse            # lhci autorun against lighthouserc.json
```

- Hits the **four live demo URLs** (the `DEMO_USERNAMES` values, kept in sync with the
  seed via [`lighthouserc.json`](../../lighthouserc.json)), in **mobile** config,
  `numberOfRuns: 3`, asserting **`categories:performance` ≥ 0.90** — a sub-0.90 mobile run
  exits non-zero. JSON output lands in `.lighthouseci/` (gitignored).
- **Record the four numbers** in the phase HUMAN-UAT.
- **One-time cross-check:** paste one demo URL into `pagespeed.web.dev` (mobile) and record
  the score, so the local LHCI numbers aren't tooling-optimistic (it runs on Google infra).

### 6b. Automated public smoke (LAUNCH-08 — public half)

```bash
BASE_URL=https://portsmith.vercel.app npm run smoke:prod
```

The committed re-runnable [`e2e/prod-smoke.spec.ts`](../../e2e/prod-smoke.spec.ts) (via
[`playwright.prod.config.ts`](../../playwright.prod.config.ts), `BASE_URL`-driven, **no
webserver**) asserts the deterministic public/no-auth surface: 4-template render,
`/blog` + `/services` sub-pages, the `opengraph-image` route, sitemap + robots, the 404
body, the no-platform-branding leak check, and absolute-URLs-from-`siteUrl()` (D-04/PUB-03,
the SSG/ISR invariant). Re-run on every redeploy.

### 6c. Manual gated checklist (D-14 — the auth half, DELIBERATELY manual)

Walk this once post-deploy. It MUST exercise **real prod Turnstile** + **real email** —
**no** Turnstile test keys, **no** programmatic email-confirm (that is exactly what would
defeat LAUNCH-03/04):

- [ ] Real signup on `https://portsmith.vercel.app/signup` → the **real Turnstile widget**
      renders and passes.
- [ ] The **real confirmation email** arrives (to the founder's own address — §5a) and the
      confirm link works.
- [ ] Onboard (the wizard) → fill content → **publish**.
- [ ] View the published live `/[username]` page — it renders the chosen template fully.
- [ ] Password-recovery email arrives and the reset flow works (real email — §5a).

---

## 7. Cost / abuse controls + usage alerts (LAUNCH-06 / LAUNCH-07)

These are **dashboard-only and already documented in their own runbooks — LINK, do not
duplicate.** ⚑ The founder applies them at deploy and confirms in the dashboard.

- ➜ **[`./security-cost-hardening.md`](./security-cost-hardening.md)** — the Vercel
  **spend cap** (pause-don't-bill), the **Firewall / WAF rate-limit rules + Attack Mode**
  escalation lever, **BotID Basic** (free, Vercel-auto, degrade-open), and the abuse-vs-
  organic triage thresholds (LAUNCH-06). Its
  [`16-DEPLOY-CHECKLIST.md`](../../.planning/phases/16-security-cost-hardening/16-DEPLOY-CHECKLIST.md)
  is the tickable deploy list. **Includes the WR-03 trusted-proxy assertion:** the per-IP
  caps are only sound while the app is reachable **ONLY through the Vercel edge** (an
  off-edge direct-origin hit lets an attacker forge `x-forwarded-for` and mint a fresh
  hashed subject per request) — confirm edge-only reachability at deploy (a go/no-go item,
  §8).
- ➜ **[`./usage-cost-tripwire.md`](./usage-cost-tripwire.md)** — the Supabase + Vercel
  **~80% usage / cost alerts** (DB size, storage, egress/bandwidth, MAU) + the weekly
  manual-check fallback + the "what to do if it trips" triage (LAUNCH-07).

This runbook does **not** restate the spend-cap / WAF / alert configuration steps — wire or
check them from the linked runbooks (reconcile any free-tier label/ceiling drift *there*).

---

## 8. Go/no-go gate (D-10)

**ALL must be TRUE before James announces the launch.** A red item is a no-go.

- [ ] **LHCI ≥ 90 ×4** — `npm run lighthouse` green for all four demo URLs (§6a).
- [ ] **Public smoke green** — `BASE_URL=… npm run smoke:prod` passes (§6b).
- [ ] **Manual gated checklist passed** — real signup → real Turnstile → real email-confirm
      → onboard → publish → live render (§6c / D-14).
- [ ] **⚑ Vercel spend cap set** — pause-at-threshold, recipient set
      ([`./security-cost-hardening.md`](./security-cost-hardening.md)).
- [ ] **⚑ WAF / rate-limit rules + Attack Mode availability confirmed** in the Vercel
      Firewall dashboard (§7).
- [ ] **⚑ BotID enforcing** — confirmed active in the Vercel BotID dashboard (§7).
- [ ] **⚑ Edge-only reachability** — the app is reachable ONLY through the Vercel edge
      (WR-03 trusted-proxy assertion, §7) — no direct-origin bypass.
- [ ] **⚑ ~80% usage/cost alerts configured** — Supabase + Vercel
      ([`./usage-cost-tripwire.md`](./usage-cost-tripwire.md)).
- [ ] **⚑ Prod Turnstile keys wired** — real site+secret keys, test keys replaced (§4).
- [ ] **⚑ Founder-proof email delivery confirmed** — confirmation + recovery email
      delivered to the founder's own address (§5a).

**Accepted documented known-gap (NOT a no-go):** reliable signup-confirmation / recovery
email to **arbitrary new-user addresses** is domain-gated and deferred to the first domain
dollar (§5b). The launch ships with founder-proof email verified; real-user email is the
deliberate post-domain follow-up.

---

## 9. Rollback recovery (D-11)

If the public smoke or LHCI fails on a live deploy, re-promote the prior good deployment —
the one-command fix:

```bash
vercel list --prod              # find the prior good deployment URL/id
vercel rollback <url-or-id>     # re-promote it
vercel rollback status          # check progress
```

No code revert is required to recover the live site; fix forward in the tree and
`vercel --prod` again once green.

---

## Status

- **Runbook (this file):** authored and committed (Phase 23, Plan 23-05, Task 1). ✅
- **Committed launch artifacts (the other Phase 23 plans):**
  [`.vercelignore`](../../.vercelignore) + rewritten
  [`og-default.png`](../../public/og-default.png) (23-03),
  [`check-env.mjs`](../../scripts/check-env.mjs) + the `prebuild` wiring (23-02),
  [`lighthouserc.json`](../../lighthouserc.json) + `npm run lighthouse` (23-04),
  [`playwright.prod.config.ts`](../../playwright.prod.config.ts) +
  [`e2e/prod-smoke.spec.ts`](../../e2e/prod-smoke.spec.ts) + `npm run smoke:prod` (23-04),
  the demo seeds + [`demo-usernames.ts`](../../scripts/seed/demo-usernames.ts) (23-01). ✅
- **Linked runbooks (already complete):**
  [`security-cost-hardening.md`](./security-cost-hardening.md) (LAUNCH-06),
  [`usage-cost-tripwire.md`](./usage-cost-tripwire.md) (LAUNCH-07),
  [`contact-notify-resend.md`](./contact-notify-resend.md) (LAUNCH-04 contact-notify). ✅
- **Deploy + dashboard config + the live LHCI/smoke EXECUTION:** ⚑ **OPEN / founder-owned**
  — applied when the Vercel/Supabase projects are linked at deploy, then verified through
  the go/no-go gate (§8). **Acceptance is docs-exist-and-correct, NOT cloud-configured.**
  Deploy is founder-owned, never a milestone gate.
- **Real-user (arbitrary-recipient) email:** ⚑ documented known-gap, gated on the first
  domain dollar (§5b / §8).

---

*LAUNCH-01..10 · Decisions D-01..D-11 · Phase 23 — Production Launch & Verification ·
recipient: james@eulclavieoutsourcing.com · orchestrates (links, does not rewrite)
[`security-cost-hardening.md`](./security-cost-hardening.md),
[`usage-cost-tripwire.md`](./usage-cost-tripwire.md),
[`contact-notify-resend.md`](./contact-notify-resend.md).*
