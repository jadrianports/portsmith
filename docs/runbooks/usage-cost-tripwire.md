# Runbook: Usage / Cost Tripwire (FND-06)

> **Purpose.** A free-tier abuse or cost spike must trip a notification to a human **before** it
> silently pauses the Supabase project or starts billing. This runbook is the durable,
> version-controlled half of FND-06; the dashboard alerts themselves are configured manually
> (they are not codeable or migratable — see 01-RESEARCH.md, Architectural Responsibility Map:
> "Usage/cost alerting (FND-06) = External (Supabase + Vercel dashboards)").
>
> **Requirement:** FND-06 · **Decisions:** D-12, D-13 · **Phase:** 01-security-data-foundation
> **Constraint context:** Portsmith launches on **$0 / free tier** (Supabase + Vercel + `*.vercel.app`).
> The whole point of this tripwire is that we find out about a spike *first*, and never silently
> cross into a paused project or a paid invoice.

---

## Notification recipient

All usage / spend alerts notify:

**`james@eulclavieoutsourcing.com`**

This is the single operator inbox for the project. If/when the team grows, add recipients here
and in both dashboards — do not replace this address.

---

## Thresholds

Trip at **~80% of each free-tier limit** for the four monitored metrics below. 80% gives headroom
to react (investigate, unpublish an abuser, or accept organic growth and plan an upgrade) *before*
the hard ceiling pauses the project or starts billing.

| # | Metric | Platform | Free-tier ceiling (verify in dashboard) | Trip at ~80% |
|---|--------|----------|------------------------------------------|--------------|
| 1 | **Database size** (Postgres disk) | Supabase | ~500 MB on the Free plan *(confirm current limit in dashboard)* | ~400 MB |
| 2 | **Storage** (uploaded files — avatars, covers, resumes) | Supabase | ~1 GB on the Free plan *(confirm current limit in dashboard)* | ~800 MB |
| 3 | **Egress / bandwidth** (data transfer out: DB + storage + Vercel) | Supabase **and** Vercel | Supabase ~5 GB/mo; Vercel ~100 GB/mo *(confirm current limits in dashboard)* | ~4 GB (Supabase) / ~80 GB (Vercel) |
| 4 | **MAU** (monthly active users — Supabase Auth) | Supabase | ~50,000 MAU on the Free plan *(confirm current limit in dashboard)* | ~40,000 MAU |

> **Why these four (D-12).** They are the free-tier limits most likely to be driven by abuse or a
> traffic spike: a storage flood (large uploads), a runaway DB, an egress/bandwidth spike (hotlinked
> assets or a scraped public page), and signup abuse (MAU). Function invocations / build minutes on
> Vercel are covered by the same Vercel usage-notification toggle below.

> **Ceilings are marked "(confirm current limit in dashboard)" on purpose.** Free-tier limits change
> over time and differ by plan. Read the live numbers when configuring the alerts and, if a ceiling
> differs from the table above, **update this table** so the runbook stays the source of truth
> (this reconciliation is part of the FND-06 human-verify done-criteria).

---

## Galleries & egress (v2.8)

> **Context.** The v2.8 "Show the Work" milestone adds batch image galleries (Phase 34–36).
> Galleries raise pressure on **both** monitored levers above: **Storage** (row 2 — more
> uploaded bytes per user) and **Egress/bandwidth** (row 3 — more image bytes served from the
> public `/[username]` pages). This subsection records how that pressure is bounded; it adds
> **no new in-app guard** (D-11) and **does not duplicate** the Thresholds table — the same
> storage (~800 MB / 1 GB) and egress (~4 GB / 5 GB Supabase) trip lines apply unchanged.

**In-product levers (the cost is bounded at the source, not by a new tripwire):**

- **2000px longest-edge clamp** *(this milestone — Phase 34 config + Plan 02 client downscale).*
  Gallery picks are downscaled client-side to a 2000px longest edge and stored as a single small
  WebP, so a multi-megapixel phone/DSLR original never lands at full size. This caps both the
  per-image stored bytes and the per-image egress.
- **Lazy-loading** *(Phase 36 — the creative gallery template).* Gallery images render lazily so a
  visitor only pulls the images actually scrolled into view, bounding egress per page view rather
  than serving every gallery image on first paint.

**Per-user storage lever — the 65 MiB cap.** The per-user storage budget is raised 25 → **65 MiB**
this milestone (D-10, migration 031, enforced by the atomic BEFORE-INSERT quota trigger). That cap
is the per-user **storage** lever: a single user's galleries can never push their footprint past
65 MiB, so storage growth stays linear in active users and is bounded per head.

**No per-user egress signal — by design.** There is deliberately **no per-user egress tripwire**.
Egress is not cheaply attributable per user on $0 infra (matching the FND-06 precedent at the top of
this runbook — the alerts are project-wide, not per-user). Egress is covered by the existing
**project-wide** Supabase egress threshold (row 3) plus the in-product levers above (clamp +
lazy-load), not by a new per-user mechanism.

**"Set where possible" (MEDIA-05) is already satisfied.** The MEDIA-05 "set a guard where possible"
obligation is met by the **existing** Supabase usage-notification step below (the billing-email
alerts in *Configuration steps → Supabase*) — galleries add no new alert, they ride the storage +
egress alerts already configured there.

---

## Configuration steps

### Supabase (Billing / Usage / Alerts)

1. Open the Supabase Dashboard for the Portsmith project.
2. Go to **Organization (or Project) → Billing / Usage / Alerts** (exact label varies by plan/version).
3. For each of **Database size**, **Storage**, **Egress/bandwidth**, and **MAU**, set a usage/spend
   alert at **~80%** of the current free-tier limit (use the "Trip at ~80%" column above, reconciled
   to the live ceiling).
4. Set the alert recipient to **`james@eulclavieoutsourcing.com`**.
5. If a **Spend cap** toggle exists, keep spend **disabled** (we are deliberately $0; we want to be
   *paused-and-notified*, not silently billed — see "What to do if it trips").
6. Capture evidence (screenshot or checklist) that each alert is set.

> If the Free plan does **not** expose push alerts for one or more of these metrics (Supabase
> alerting availability varies by plan — see 01-RESEARCH.md Open Question 1), record which metrics
> are uncovered and fall back to the **weekly manual usage check** below for those metrics.

### Vercel (Settings / Billing / Spend Management / Usage Notifications)

1. Open the Vercel Dashboard for the Portsmith project/team.
2. Go to **Settings → Billing / Spend Management / Usage Notifications** (exact label varies).
3. Enable **usage notifications** at **~80%** of the relevant free-tier limits — primarily
   **bandwidth/egress**, and **function invocations / execution** if exposed.
4. Set the notification recipient to **`james@eulclavieoutsourcing.com`**.
5. Keep **spend management** such that we are notified (and, if possible, paused) rather than
   automatically charged — we are intentionally on the free tier.
6. Capture evidence (screenshot or checklist) that the notifications are set.

> If Vercel free-tier usage notifications are unavailable, record that and rely on the weekly
> manual check below for Vercel bandwidth/functions.

---

## Fallback: weekly manual usage check (if free-tier alerting is unavailable)

Free-tier push alerting is **not guaranteed** on either platform (01-RESEARCH.md Open Question 1:
some alerting is a paid-plan feature). If any metric above cannot be wired to a push alert, cover it
with this **weekly** manual check. Put a recurring weekly reminder on the calendar for
`james@eulclavieoutsourcing.com`.

**Every week, open both dashboards and read these numbers:**

| Dashboard | Where | Read this number | Trip if ≥ ~80% |
|-----------|-------|------------------|-----------------|
| Supabase → Usage | Database size | current DB size vs ceiling | ~400 MB / ~500 MB |
| Supabase → Usage | Storage | total stored bytes vs ceiling | ~800 MB / ~1 GB |
| Supabase → Usage | Egress / bandwidth | month-to-date egress vs ceiling | ~4 GB / ~5 GB |
| Supabase → Auth | MAU | month-to-date active users vs ceiling | ~40,000 / ~50,000 |
| Vercel → Usage | Bandwidth | month-to-date bandwidth vs ceiling | ~80 GB / ~100 GB |
| Vercel → Usage | Functions | invocations / execution vs ceiling | ~80% of limit |

**If any number is at or above its ~80% trip line, treat it exactly as a tripped alert** and follow
"What to do if it trips" below. Record the weekly reading (a one-line note or a checklist tick) so
there is evidence the check happened — the same screenshot/checklist evidence that satisfies the
FND-06 done-criteria when push alerts are unavailable.

---

## What to do if it trips

When an alert fires (or a weekly check crosses ~80%), work this procedure. The goal is to stay at
**$0** and decide quickly whether this is **abuse** or **organic growth**.

1. **Identify the metric.** Which of the four tripped — DB size, storage, egress/bandwidth, or MAU?
   Note the platform (Supabase vs Vercel) and the current value vs the ceiling.

2. **Abuse vs. organic growth — triage.**
   - **Storage / DB spike:** check Supabase Storage and the largest tables for a single user
     uploading huge or many files, or a single portfolio bloating the DB. One outlier user = likely
     abuse; broad, even growth = likely organic.
   - **Egress/bandwidth spike:** check Vercel/Supabase logs for a single hot `/[username]` page,
     hotlinked assets, or scraper traffic. A single URL dominating = likely abuse/scrape.
   - **MAU spike:** check Supabase Auth for a burst of signups in a short window (signup abuse /
     bot registrations) vs. a steady climb.

3. **Identify the top consumer(s).** Sort by user / portfolio / URL to find who or what is driving
   the metric. Note the offending `user_id` / `username` / asset path / URL.

4. **Immediate $0 levers (do NOT enable spend):**
   - **Do not** turn on a paid plan or enable spend just to clear the alert. Being
     *paused-and-notified* is the intended free-tier behavior; clear the *cause* first.
   - **Temporarily unpublish the offending portfolio** to stop the bleed (set the portfolio
     unpublished so the public page and its assets stop serving). This is the immediate,
     reversible lever for a single abusive/runaway portfolio.
   - For storage abuse, the offending uploads can be removed once the owner is identified.

5. **Abusive portfolio → kill-switch / lock path is Phase 6.** The durable lock/kill-switch for an
   abusive portfolio (admin lock + fast cache purge + anon report path) is **Phase 6 (Trust &
   Safety, SAFE-*)**, not built yet. Until then, the manual lever in step 4 (temporary unpublish +
   removing offending uploads) is the stopgap. Reference Phase 6 when escalating a confirmed
   abuse case.

6. **Organic growth → plan, don't panic.** If the spike is real, healthy usage approaching a free
   ceiling, that is a *good* problem: record it, and plan the free→paid upgrade deliberately (the
   first paid dollar is a launch/production expense, per CLAUDE.md — not an emergency). Do not enable
   spend reflexively in the middle of an alert; decide it as a planned step.

7. **Reconcile the runbook.** If the dashboards showed a different ceiling than the Thresholds table,
   update the table here. If a new metric matters, add it.

---

## Status

- **Runbook (this file):** authored and committed (Phase 1, Plan 01-02, Task 1). ✅
- **Dashboard alerts (Task 2):** **OPEN / deferred** — pending the operator provisioning the remote
  Supabase and Vercel projects, then configuring the alerts above (or recording the weekly
  manual-check fallback where free-tier push alerts are unavailable). Tracked as an end-of-phase
  human-verify item. The operator confirms with screenshot/checklist evidence and reconciles any
  ceiling that differs from the Thresholds table.

---

*FND-06 · Decisions D-12 / D-13 · Phase 01 — Security & Data Foundation · recipient: james@eulclavieoutsourcing.com*
