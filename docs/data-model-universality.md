# Data Model Universality — Launch-Ready Confirmation + the `UNIQUE(portfolio_id, type)` Decision (DATA-01 / DATA-02)

> **What this is.** The Phase-9 write-up that **confirms** Portsmith's profession-agnostic
> data model is launch-ready (DATA-01) and **records** the explicit `UNIQUE(portfolio_id, type)`
> decision (DATA-02). This is **documentation only** — no migration is applied, no schema file
> is written, no behavioral test is added. The model's correctness is **already proven** by the
> existing test suite; this doc cites those tests as the proof rather than re-asserting behavior.
>
> **Why it exists.** The whole v2.0 template-supply pipeline (a new profession's section types,
> a marketer template, AI-ingested designs) rests on the claim that *adding a profession is a
> code change, not a migration*, and that *`content` carries no private data*. This doc pins
> that claim to the source + the tests so a future author (human or skill) never forks the model
> or smuggles a private field into `content`.
>
> Decision refs point to `.planning/STATE.md` / the Phase-9 decision log: **D-18** (DATA-01
> launch-ready / pure documentation), **D-19** (DATA-02 defer relaxation + the founder's
> multi-page-orthogonality rationale), **CMS-08** (soft-enum, new-type-no-migration).

---

## DATA-01 — the profession-agnostic model is launch-ready (D-18)

**Verdict: confirmed launch-ready. Pure documentation of already-proven behavior — no fork, no
migration, no new test.** The model is three things working together: a **schemaless JSONB
`content` column**, a **soft-enum `type`**, and the **Zod write gate** — all carrying
**all-or-nothing-public** content. Each property below is stated with its source citation and
the existing test that proves it.

### 1. Soft-enum `type` → a new profession's section needs NO migration

- **Source.** `sections.type` is `TEXT NOT NULL` with **no enumerating `CHECK`**
  (`supabase/migrations/001_initial_schema.sql:135`; the table comment at `:128-130` states it
  explicitly: *"`type` is TEXT NOT NULL with NO enumerating CHECK — the Zod union is the sole
  gate"*). The sole structural gate is the Zod `sectionContentSchemas` record consulted by
  `validateSectionContent(type, content)` (`src/lib/validations/sections.ts:1-13` header:
  *"Zod is the SOLE gate … `type` is a plain string key … adding a future profession's section
  type is a NEW entry in that record … never a Postgres migration"*).
- **Proven by CMS-08.** `skills` was the first net-new section type added after the Phase-1
  baseline, and it landed as a **one-line record entry** —
  `skills: skillsContentSchema` (`src/lib/validations/sections.ts:242`, with its schema at
  `:220` and the `[03-01]` decision in STATE.md) — **with no Postgres migration and no enum
  change.** A marketer's future `services` / `clients` / `gallery` types are likewise
  schema-only additions (one record entry + a per-template section renderer; REQUIREMENTS
  MKT-01 "zero migration").
- **Test proof.** `tests/unit/validations.test.ts` exercises `skills` as a registered,
  validated type through `validateSectionContent` — i.e. a type that exists ONLY as a Zod
  record entry (never in any Postgres enum/CHECK) round-trips the live gate.

### 2. JSONB `content` is schemaless, gated only by Zod — adding a field is additive

- **Source.** `content JSONB NOT NULL DEFAULT '{}'` (`001_initial_schema.sql:138`). Postgres
  validates nothing about the object's shape; `validateSectionContent(type, content)` re-parses
  it on **every** write (the SHARED-A write skeleton in `src/lib/cms/*-action.ts`).
- **Additive in practice.** Adding a field to a section type = adding it to that type's Zod
  schema, no migration. Two fields were added exactly this way after launch:
  `hero.resume_url` (`src/lib/validations/sections.ts:146`) and
  `contact.email_public` (`src/lib/validations/sections.ts:188`) — both "purely additive on the
  schemaless JSONB content — NO migration" per the inline comments at `:140-145` and `:183-188`.

### 3. All-or-nothing-public `content` — no per-field privacy inside the JSONB

- **The rule (for template authors + the skill):**
  > **`content` carries no private fields. The whole object is public once published. Anything
  > that must stay private is a *protected column*, not a content field.**
- **Source.** The public read (`src/lib/portfolio/get-portfolio.ts:101`) reads the
  `public_sections` `security_invoker` view, which exposes the **WHOLE `content` object** for
  **VISIBLE** sections of **PUBLISHED / non-deleted / non-locked** portfolios. There is **no
  per-field privacy inside `content`** — once a section is visible on a published portfolio,
  its entire `content` JSONB is public. Private data (`email`, `role`, `storage_used_bytes`,
  `locked`) lives in **PROTECTED COLUMNS** on `profiles` / `portfolio_settings` that the
  `public_*` views REVOKE / exclude (and the protected-columns trigger guards) — **never inside
  `sections.content`**.
- **Test proof.** `tests/integration/public-read-portfolio.test.ts` (the anon read returns the
  full visible-section `content` for a published portfolio) +
  `tests/integration/rls-anon-column-safety.test.ts` (the **negative** test: anon clients can
  never read the protected/private columns the public views exclude). Together these prove the
  boundary this rule documents — the enforcement already exists; this doc only records the rule
  so no author ever assumes per-field privacy in `content`.

### 4. Lossless template switching — items carry data for all fields regardless of template

- **The guarantee.** *Items carry data for all fields regardless of whether the current template
  renders them; switching templates never loses data.* A template that doesn't render a field
  still has the data sitting in `content`; switching to a template that *does* render it shows
  it. This is why even a rich/viz (Three.js) template — which consumes the same all-nullable
  `PortfolioData` and renders the user's sections 1:1 (WebGL is **additive**, never a content
  replacement, per D-09) — keeps the switch in and out **lossless**.
- **Test proof.** `tests/integration/cms/template-switch-rls.test.ts`.

**DATA-01 conclusion:** the four properties above are already true and already tested. DATA-01 is
**documentation OF proven behavior** (D-18) — there is no fork, no migration, and no new test in
Phase 9.

---

## DATA-02 — defer relaxing `UNIQUE(portfolio_id, type)` (decision recorded) (D-19)

**Decision: DEFER relaxation. Keep the one-section-per-type constraint. No migration applied in
Phase 9.**

### Where the constraint lives

- `sections` table, `UNIQUE(portfolio_id, type)` (`supabase/migrations/001_initial_schema.sql:141`;
  the table comment at `:129-130` flags it as *"the deliberate, reversible UNIQUE(portfolio_id,
  type) (ADR-011)"*). It caps each portfolio at **one section per type** — the single-scroll model.

### The reversible one-line change (for when a real multi-section need appears)

```sql
ALTER TABLE sections DROP CONSTRAINT sections_portfolio_id_type_key;
```

Postgres auto-names a column unique constraint `<table>_<cols>_key`, hence
`sections_portfolio_id_type_key`. **Confirm the exact name with `\d sections` before any future
migration** (the name is derived, not declared, so it can differ if the table is ever recreated).

### Necessary-but-not-sufficient caveat (so a future relaxer doesn't think the one-liner is the whole job)

Dropping the DB constraint is **necessary but not sufficient**. Relaxing one-section-per-type also
requires a **render-ordering story** for multiple same-type sections AND **CMS + renderer changes**,
because two layers currently *assume* one-per-type:

- **The CMS editor is one-form-per-type.** `src/components/editor/section-form.tsx` dispatches the
  edit form by a single `switch (type)` (`section-form.tsx:101`) — one form panel per section
  type. Multiple sections of one type would need a list/instance model here, not a single panel.
- **Each template root finds a single section per type.** Every template root resolves a section
  with a single-`find` `sectionOfType` helper —
  `sections.find((s) => s.type === type)` (`src/components/templates/minimal/index.tsx:53-54`,
  mirrored in `editorial/index.tsx`) — which returns only the **first** match. Rendering multiple
  same-type sections would require every template root to map over all matches in `sort_order`.

(Today `sort_order` already orders sections, so multiple-of-one-type would *be* multiple rows; the
gap is the CMS form model + the renderer single-find, not the ordering primitive.)

### Founder rationale (the deferral intent, recorded verbatim)

The future need the founder foresees — **`blog` (and maybe `services` if leaning freelance) getting
their OWN dedicated pages** — is a **multi-page** direction (the deferred LATER-02 blog engine),
**orthogonal** to multiple-sections-of-one-type. Relaxing `UNIQUE` **isn't even the right lever**
for that need. So keep the constraint: it keeps the single-scroll model + lossless template
switching simple, and it is a **reversible one-liner** (plus the CMS/renderer follow-on above) if a
genuine multi-section-of-one-type need ever actually appears. (CONTEXT D-19; the dedicated-sub-pages
direction is tracked as a Deferred Idea.)

---

## Summary

| Requirement | Decision | Status |
|-------------|----------|--------|
| **DATA-01** | The profession-agnostic model (schemaless JSONB `content` + soft-enum `type` + Zod gate, all-or-nothing-public `content`) is **launch-ready** — a new profession's type needs no migration (CMS-08 `skills` proof), and `content` carries no private fields. | Confirmed via documentation of already-proven behavior (D-18). No fork, no migration, no new test. |
| **DATA-02** | **Defer** relaxing `UNIQUE(portfolio_id, type)`; keep one-section-per-type. Recorded with the exact reversal SQL, the necessary-but-not-sufficient caveat, and the founder's multi-page-orthogonality rationale. | Decided + recorded (D-19). No migration applied in Phase 9. |

*Phase 9 — Template Contract, Shared Kit & Data Universality. Documentation only: this file
applies no migration and adds no behavioral test. The cited tests
(`tests/unit/validations.test.ts`, `tests/integration/public-read-portfolio.test.ts`,
`tests/integration/rls-anon-column-safety.test.ts`, `tests/integration/cms/template-switch-rls.test.ts`)
remain the proof and are unchanged.*
