# Runbook: Security & Cost Hardening (HARD-01..04)

> **Purpose.** Bound a traffic spike or abuse wave so it is never a cost or reputation
> event. A spike must **pause and notify** the operator — never silently bill, and never
> degrade into an unbounded abuse surface. This runbook is the durable, version-controlled
> half of Phase 16: it documents the Vercel **spend cap** (HARD-01), the Vercel
> **Firewall/WAF rate-limit rules + Attack Mode** escalation lever (HARD-02), the **BotID**
> free-Basic posture (HARD-02), the **Supabase egress/usage watch** (HARD-03 — building on
> the FND-06 tripwire), the **HARD-04 / D-09 route-review** summary, and the **D-03 triage
> thresholds**. The dashboard/account-level config it describes (spend cap, WAF rules, Attack
> Mode, usage alerts) is **not codeable or migratable** — it ships as this runbook + a
> tickable deploy checklist (see [`16-DEPLOY-CHECKLIST.md`](../../.planning/phases/16-security-cost-hardening/16-DEPLOY-CHECKLIST.md)).
>
> **Requirements:** HARD-01, HARD-02, HARD-03, HARD-04 · **Decisions:** D-01, D-02, D-03,
> D-04, D-05, D-08, D-09 · **Phase:** 16-security-cost-hardening
> **Constraint context:** Portsmith launches on **$0 / free tier** (Supabase + Vercel +
> `*.vercel.app`). The Vercel project is **intentionally not linked** and the Supabase remote
> is **not provisioned**, so the dashboard config below **cannot be applied now** — it is
> applied by the founder **when the projects are linked at deploy**. Per the FND-06 +
> `06-USER-SETUP.md` precedent (D-01), **acceptance = these docs exist & are correct, NOT
> that the cloud is configured.** Deploy is founder-owned, never a milestone gate.

---

## Acceptance posture (read first — D-01)

This runbook is the **deploy-only half** of Phase 16. The **code-where-real** half (BotID
wiring, the auth per-IP rate-limit, the upload Content-Length pre-check, the static security
headers) lands and is tested in plans 16-01/16-02/16-04/16-05/16-06.

- **Acceptance of this runbook = it exists and is correct.** The cloud config it describes is
  applied by the founder at deploy and verified via [`16-DEPLOY-CHECKLIST.md`](../../.planning/phases/16-security-cost-hardening/16-DEPLOY-CHECKLIST.md).
- **Every dashboard step carries a "confirm in the dashboard at deploy" hedge** — Vercel and
  Supabase free-tier labels, limits, and surfaces drift over time. Read the live UI when
  configuring, and reconcile this runbook if a label or limit differs.
- **Honest-to-$0.** Every paid lever below (BotID Deep Analysis / Vercel Pro, Attack Mode, a
  free→paid plan upgrade) is documented as a **deliberate escalation pulled only on a real
  attack** — never standing spend.

---

## Notification recipient

All usage / spend / abuse alerts notify:

**`james@eulclavieoutsourcing.com`**

This is the single operator inbox for the project (the same recipient as the FND-06
[`usage-cost-tripwire.md`](./usage-cost-tripwire.md) runbook). If/when the team grows, add
recipients here and in both dashboards — do not replace this address.

---

## 1. Vercel spend cap — pause, don't bill (HARD-01, D-04)

**Posture: paused-and-notified, not silently billed.** The whole point of the spend cap is
that an abuse-driven or organic spike **pauses the project at a threshold** rather than
silently crossing into a paid invoice. This is the same philosophy as FND-06's "keep spend
disabled" — we are deliberately $0, and we want to find out about a spike *first*.

The spend cap is a Vercel **account/team-level** setting. It is **NOT expressible** in
`vercel.json` / `vercel.ts` / any repo config (D-04) — it is dashboard-only.

### Where it lives (confirm the live label at deploy)

| Setting | Location (verify the exact label in the dashboard — A1) | What to set |
|---------|----------------------------------------------------------|-------------|
| **Spend Management** | Vercel Dashboard → **account/team Settings → Billing → Spend Management** | Set a **spend amount / threshold** and choose **pause the project** at that threshold (NOT "notify and keep serving / bill past it"). |

### Steps (at deploy)

1. Open the Vercel Dashboard for the Portsmith team/account.
2. Go to **Settings → Billing → Spend Management** (exact label/path varies — confirm in the
   dashboard; A1).
3. Set a spend threshold (the founder picks the dollar figure — keep it low; we are $0 / free
   tier, so any non-zero spend is a signal, not a budget).
4. Choose the **pause-at-threshold** action so the project **pauses** rather than billing past
   the limit. If the only option is "notify," set the notification (recipient below) and treat
   it as a manual pause trigger.
5. Set the notification recipient to **`james@eulclavieoutsourcing.com`**.
6. Capture evidence (screenshot / checklist tick) that the cap is set.

> **Why pause-not-bill.** On a $0 / 2-user app, an unbounded bill from a traffic/abuse spike is
> the single worst-case cost event. Pausing is reversible and loud; a surprise invoice is
> neither. The first paid dollar should be a **planned** launch/production decision (per
> CLAUDE.md), never an emergency reaction to a spike.

---

## 2. Vercel Firewall / WAF + Attack Mode (HARD-02, D-05)

The Vercel **Firewall/WAF** (custom rate-limit rules) and **Attack Mode** are **dashboard/API
config only** (D-05). They are **NOT** expressed in `vercel.json` — and this runbook
deliberately does **NOT** add a `vercel.json` WAF rule (`vercel.json` `routes` can only hold
`challenge` / `deny` actions, not the `log` / `bypass` rate-limit shapes we'd want; D-05 keeps
WAF as docs). **Do not pre-build a `vercel.json` rule** — flag any future rule as a deliberate
deviation, not a phase deliverable.

The in-app `countAndRecord` ledger (the auth per-IP rate-limit in 16-04, plus the existing
contact/report/page-view caps) is the **app-tier complement** to the edge WAF rule — both
layer; neither replaces the other.

### WAF rate-limit rules (at deploy — confirm labels in the dashboard)

| Surface | Suggested rule | Action |
|---------|----------------|--------|
| `/api/*` (the service-role routes — contact, report, page-view, media/upload, preview) | A per-IP request-rate rule (e.g. a sane requests/minute ceiling per IP) | **challenge** first, escalate to **deny** on a sustained abusive IP |
| Auth pages (`/signup`, `/login`, `/forgot-password`) | A per-IP request-rate rule on the POST surface | **challenge** (layered under BotID + the app-tier `auth_*` per-IP cap) |

> Pick conservative ceilings — a real user (even behind CGNAT / a shared office IP) must never
> trip them. The app-tier `auth_*` caps (signup 10/h, login 20/h, reset 5/h per hashed IP —
> see §6 / 16-04) are the precise speed-bump; the WAF rule is the coarse edge backstop.

### Attack Mode — the escalation lever (D-05, D-08)

**Attack Mode** is a Vercel Firewall feature that challenges **all** traffic (a managed
challenge page) — it is the **escalation lever pulled only during a real, active attack**, not
a standing setting. Enabling it adds friction for every visitor, so it is a temporary
"we are under attack right now" switch, then turned back off.

- **When to pull it:** a sustained abuse wave that the per-IP WAF rules + the spend cap are not
  containing (e.g. a distributed flood from many IPs).
- **Honest-to-$0:** Attack Mode itself is a free Firewall feature on the relevant plans —
  pulling it is a *posture* change, not standing spend. Confirm the live availability/label in
  the dashboard at deploy.

---

## 3. BotID — free Basic, no standing spend (HARD-02, D-06 / D-08)

**BotID Basic is wired in code now** (plans 16-04 / 16-05 / 16-06): the `botid` package +
`withBotId(nextConfig)` wrapper in `next.config.ts`, `<BotIdClient>` mounted in the
`(chrome)` root layout (auth scope only — D-07, zero added JS to the lean public
`(portfolio)` bundle), and `checkBotId()` server-side in the protected handlers (signup /
login / reset + `/api/contact` / `/api/report`).

- **Basic tier is FREE, Vercel-only, and needs NO env var** — it auto-detects Vercel.
- **It no-ops off-Vercel** (`checkBotId()` resolves `isBot: false` locally and on any
  non-Vercel host), so the code lands safely now and **goes live the moment the project
  deploys to Vercel**. There is nothing to "turn on" in code at deploy.
- **On `isBot`, every protected surface returns its existing generic outcome** — never a
  distinct "bot detected" message (that would be an enumeration oracle; enumeration-safety is
  preserved, Phase-2 D-07).

### Escalation lever (D-08) — documented, NOT standing spend

- **BotID Deep Analysis** (requires **Vercel Pro, ~$20/mo**) is a documented escalation lever —
  enable it **only** if Basic BotID + Turnstile + the per-IP caps are not containing a real bot
  wave. It is **not** standing spend (honest-to-$0).

> **Deploy-time confirm:** after the first deploy, confirm BotID Basic is active in the Vercel
> BotID dashboard (this also confirms the Server-Action path-match — see the checklist). If the
> path-match is off, the wiring is harmless (the surface is still gated by Turnstile + the
> per-IP `auth_*` cap) — fix the protect paths and redeploy.

---

## 4. Supabase egress / usage watch (HARD-03)

**The FND-06 [`usage-cost-tripwire.md`](./usage-cost-tripwire.md) runbook is the source of
truth** for the ~80% Supabase + Vercel usage alerts (database size, storage, egress/bandwidth,
MAU) and the weekly manual-check fallback, including the full "what to do if it trips" triage.

**This runbook does not restate those steps** (D-02 — cross-link, do not duplicate). To wire
or check the Supabase egress / free-tier usage watch:

➜ **See [`docs/runbooks/usage-cost-tripwire.md`](./usage-cost-tripwire.md)** — its Thresholds
table, its Configuration steps (Supabase + Vercel), its weekly-manual-check fallback, and its
"What to do if it trips" triage are the authoritative source. Reconcile any ceiling that drifts
there, not here.

The security-cost-hardening view adds only the **abuse-lens triage** (§7 below) on top of those
usage numbers — it points at the same Supabase/Vercel usage surfaces from a "is this an attack?"
angle, leaning on the Phase-15 `/admin` Insights numbers.

---

## 5. HARD-04 / D-09 route & auth-action abuse-resistance review (summary)

Phase 16 ran a documented abuse-resistance review of the existing request surfaces (D-09). The
review scope and outcomes:

### Reviewed surfaces (D-09 scope)

| Surface | What it is | Review outcome |
|---------|-----------|----------------|
| `POST /api/contact` | service-role route (Zod → fail-closed Turnstile → public-target guard → `countAndRecord` → insert → generic errors) | **Reviewed — sound.** Added a layered `checkBotId()` gate (16-05/16-06). No structural gap. |
| `POST /api/report` | service-role route, two-bucket rate-limit (per-page + per-hashed-IP-sender), Turnstile fail-closed | **Reviewed — sound** (the closest analog the new auth rate-limit mirrors). Added `checkBotId()`. |
| `POST /api/page-view` | beacon: UA denylist + flood cap + silent-drop (Phase-15 D-08) | **Reviewed — sound.** Added `checkBotId()` as a **silent-drop** (keeps the no-friction beacon posture). |
| `POST /api/media/upload` | owner-authenticated upload: verified-claims + per-kind byte ceiling + magic-byte sniff + atomic quota trigger | **Gap closed inline (D-12):** see below. |
| `POST /api/preview/enable` + `.../disable` | owner `draftMode` toggles | **Reviewed — sound.** Owner-gated via `getVerifiedClaims()`; server resolves its own username (ignores any client `?username` → no open-redirect / cross-tenant toggle). **No fix needed.** |
| `signupAction` / `loginAction` / `requestReset` (auth Server Actions) | `'use server'` credential surfaces | **Gap closed inline (D-11):** see below. |

### Two bounded gaps closed inline this phase

1. **Auth per-IP rate-limit (D-11, plan 16-04).** The auth Server Actions had **no rate-limit
   ledger** (signup had Turnstile only; login/reset had neither). **Fixed:** added
   `countAndRecord` caps in three new buckets — `auth_signup` (10/h), `auth_login` (20/h),
   `auth_reset` (5/h) — **per hashed IP only** (reusing `REPORT_IP_HASH_SECRET` via a new
   `hashClientIpFromHeaders()` helper; **degrades to no-cap when the secret is unset**, never a
   lockout). **NOT per-email** (a per-email cap would introduce an account-lockout DoS +
   enumeration vector). **Enumeration-safety preserved:** a throttled login returns the SAME
   generic message as any operational failure — the throttle is never an oracle. BotID +
   Turnstile are the layered bot gates on the same routes.

2. **Upload Content-Length pre-check (D-12, plan 16-02).** `POST /api/media/upload` buffered the
   **whole** request body into memory before the per-kind byte-ceiling check — a function-OOM /
   memory-pressure lever on the $0 tier. **Fixed:** a coarse `Content-Length` pre-check
   (max of the per-kind ceilings = 10 MiB) **rejects obviously-oversized bodies before
   buffering**; the post-read `byteLength` per-kind re-check **stays** as the authoritative gate
   (Content-Length is untrusted). A true streaming-multipart parser is a documented deferred
   follow-up (D-10 — fix bounded gaps inline, don't gold-plate; the buffered worst case is now
   bounded to ≤10 MiB).

### Reviewed-as-context (no fix needed — D-09)

- **CMS `'use server'` writes** are RLS-scoped (a cross-tenant write hits 0 rows). Reviewed as
  context; **not** the full CMS-write audit, and no fix expected or made (the tenant boundary is
  RLS, asserted by the existing integration tests).
- **Admin SECURITY DEFINER aggregate RPCs** (`page_view_*`, `rate_limit_events_by_bucket`,
  `report_volume_series`) — spot-checked: each is `is_admin()`-self-gated, `SET search_path=''`,
  returns **aggregates only** (no raw rows). No unbounded-read gap.
- **Owner page-view TS-aggregation** (the authenticated own-rows read in 15-05) — spot-checked:
  RLS-scoped to the owner's own rows; aggregation is in TypeScript over a bounded own-rows page.
  No unbounded-read gap.

---

## 6. Code-where-real summary (lands now — context for the reviewer)

The non-dashboard half of Phase 16 is real, committed code (not in this runbook's deploy
scope, but listed here so this runbook is a complete map of the phase's hardening):

| Item | Where | Plan |
|------|-------|------|
| Auth per-IP rate-limit (`auth_signup`/`auth_login`/`auth_reset`) | `src/lib/auth/{signup,login,reset}-action.ts` + `src/lib/trust/ip-hash.ts` | 16-04 |
| BotID wiring (`withBotId` + `BotIdClient` + `checkBotId()`) | `next.config.ts`, `(chrome)/layout.tsx`, the auth actions + `/api/{contact,report,page-view}` | 16-05 / 16-06 |
| Upload Content-Length pre-check | `src/app/api/media/upload/route.ts` | 16-02 |
| Static SSG-safe security headers (CSP without script-src nonce, HSTS, nosniff, frame-ancestors, Referrer-Policy, Permissions-Policy) | `next.config.ts` `headers()` | 16-01 |

> The security headers are emitted at the framework/edge layer (`next.config.ts` `headers()`) —
> **zero change to any page render path**, so the public `/[username]` route stays ● SSG/ISR
> (D-22, asserted by `tests/build/route-table-ssg.test.ts` + `npm run check:bundle`). The HSTS
> header currently ships **1-year, no `preload`** — see the checklist for the future
> `preload` upgrade when the brand domain launches.

---

## 7. D-03 triage thresholds — abuse vs. organic (NO new infra / cron)

**D-03 ships as documented triage thresholds + a weekly manual check — there is NO cron, NO new
infra, NO active alerting service this phase.** This is honest to a $0 / ~2-user app. The
thresholds lean on the **Phase-15 `/admin` Insights** numbers the operator already eyeballs (the
`page_view_*` / `rate_limit_events_by_bucket` / `report_volume_series` aggregate RPCs from
migration 019) plus the weekly manual dashboard check.

When a usage alert fires (§4 → the FND-06 runbook) **or** during the weekly check, use these
numbers to decide **abuse vs. organic** before reaching for a lever:

| Signal (where to read it) | Eyeball threshold (tune to live traffic — these are starting numbers) | Likely meaning |
|---------------------------|------------------------------------------------------------------------|----------------|
| **`rate_limit_events` by bucket** (`/admin` Insights — `rate_limit_events_by_bucket` RPC) | A sudden spike in `auth_login` / `auth_signup` / `report_sender` rows from a tight window — well above the steady baseline (near-zero on a 2-user app) | A per-IP cap is firing repeatedly → credential-stuffing / signup-abuse / report-flood from one source. Find the top bucket + window. |
| **Report volume** (`/admin` Insights — `report_volume_series` RPC) | More than a handful of reports in a day (baseline is ~0) | Report-path abuse (spam reports) or a genuine content problem — triage the reported portfolios. |
| **Page-view flood** (`/admin` Insights — `page_view_*` RPCs) | A single `/[username]` dominating the per-day / top-portfolios counts far above the rest | A scraped/hotlinked public page driving egress — the FND-06 egress lever applies (temporarily unpublish the offending portfolio). |

**Triage procedure (lean — defers to the FND-06 "what to do if it trips"):**

1. **Read the three Insights numbers above** + the tripped usage metric (from the FND-06 runbook).
2. **One source dominating** (one IP bucket, one reporter, one hot URL) = likely **abuse** →
   apply the $0 lever: temporarily unpublish the offending portfolio (FND-06 step 4), let the
   per-IP cap + WAF rule + (if it is a real attack) Attack Mode bound the source. Do **not**
   enable spend to clear an abuse alert.
3. **Broad, even growth** = likely **organic** → record it, plan the free→paid upgrade
   deliberately (the first paid dollar is a planned launch expense, not an emergency).
4. **Escalation ladder (honest-to-$0):** per-IP app cap (always on) → WAF rate-limit rule
   (deploy) → Attack Mode (active attack only) → BotID Deep Analysis / Vercel Pro (sustained bot
   wave only). Each rung is a deliberate step, not standing spend.

> **Why no cron (D-03).** Active spike alerting as code/cron is a **scale task** deferred until
> traffic volume justifies the infra. For a $0 / 2-user app, the existing `/admin` Insights +
> the FND-06 ~80% usage alerts + a weekly manual check are sufficient and free. The D-09
> route-review confirms no **unbounded-read** gap remains in the reviewed surfaces, so an
> unnoticed abuse spike is bounded by the per-IP caps + the spend cap even before a human looks.

---

## Status

- **Runbook (this file):** authored and committed (Phase 16, Plan 16-03, Task 1). ✅
- **Deploy checklist:** [`16-DEPLOY-CHECKLIST.md`](../../.planning/phases/16-security-cost-hardening/16-DEPLOY-CHECKLIST.md)
  authored (Plan 16-03, Task 2). ✅
- **Dashboard config (spend cap, WAF rules, Attack Mode readiness, usage alerts):**
  **OPEN / deferred** — applied by the founder when the Vercel/Supabase projects are linked at
  deploy, then ticked through the deploy checklist (D-01). **Acceptance is docs-exist-and-correct,
  NOT cloud-configured.** Deploy is founder-owned, never a milestone gate.
- **Code-where-real half (BotID, auth rate-limit, upload pre-check, security headers):** landed in
  plans 16-01 / 16-02 / 16-04 / 16-05 / 16-06 (tested now; BotID goes live on deploy).

---

*HARD-01 / HARD-02 / HARD-03 / HARD-04 · Decisions D-01..D-05, D-08, D-09 · Phase 16 —
Security & Cost Hardening · recipient: james@eulclavieoutsourcing.com · cross-links
[`usage-cost-tripwire.md`](./usage-cost-tripwire.md) (FND-06, source of truth for the ~80%
usage alerts).*
