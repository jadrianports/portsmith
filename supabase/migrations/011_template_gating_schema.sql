-- =============================================================================
-- 011_template_gating_schema.sql
-- Phase 12 (Template Gating — public / exclusive) — Plan 12-02, Task 1
--
-- GATE-01 (the visibility + grant model, enforced at the data layer). This is the
-- DDL-ONLY migration: it ADDS columns + the `template_grants` table + its index.
-- It enables NO RLS, creates NO policy, NO function, NO RPC — those land in 012;
-- the visibility/grant SEED lands in 013 (which MUST run after 011 + 012).
--
-- DECISIONS:
--   D-P12-01  template gating is a small additive schema (a `visibility` axis on
--             `templates` + a `template_grants` many-to-many), never a migration of
--             the existing `is_premium`/`is_active` booleans (a DIFFERENT, paid axis
--             — `001:42`). `visibility` is ORTHOGONAL to those.
--   D-P12-02  `visibility` is `TEXT NOT NULL DEFAULT 'restricted'` — SAFE BY DEFAULT.
--             A brand-new template row is `restricted` until an operator explicitly
--             promotes it to `'public'` (013 promotes `editorial`). The DEFAULT here
--             backfills all THREE existing template rows (minimal/editorial/aurora)
--             to `'restricted'`; 013 then flips editorial → public (order matters).
--
-- SOFT-ENUM (CMS-08 precedent, `001:135` — `sections.type TEXT NOT NULL` with NO
-- enumerating CHECK): `visibility` carries NO `CHECK (visibility IN (...))`. The
-- legal values are `'public'` | `'restricted'`, gated by the Zod
-- `templateVisibilitySchema` (12-05) — the SAME posture as section `type`, so a
-- future visibility value (e.g. a partner/curated lane) needs NO migration.
--
-- FK RATIONALE (the load-bearing choice for `template_grants.user_id`):
--   `auth.uid() = profiles.id` (profiles.id REFERENCES auth.users(id) 1:1, `001:54`),
--   and `portfolios.user_id REFERENCES profiles(id)` (`001:95`). So
--   `template_grants.user_id` FKs `profiles(id)` — NOT `auth.users` — which lets the
--   own-grant RLS policy (012) use a bare `(select auth.uid()) = user_id`, and the
--   D-P12-06 admin email/username lookup resolve a `profiles.id` directly.
--   `template_grants.template_id` FKs `templates(id)` (mirrors `portfolios.template_id`,
--   `001:96`). Both FKs are `ON DELETE CASCADE` — a deleted user/template drops its
--   grants cleanly.
--
-- COMPOSITE NATURAL KEY: `PRIMARY KEY (template_id, user_id)` — a grant is uniquely a
-- (template, user) pair; no surrogate id is needed and the composite PK is also the
-- conflict target the seed/upsert idempotency (013 + the founder seed script) keys on.
--
-- FORWARD migration (the local stack already has 001-010 applied). No `db reset`.
-- =============================================================================

-- (1) templates.visibility — soft-enum, safe-by-default (D-P12-02). No CHECK.
ALTER TABLE templates ADD COLUMN visibility TEXT NOT NULL DEFAULT 'restricted';

-- (2) portfolios.template_fallback_at — the one-time dashboard-notice signal set by
--     the auto-fallback RPC (012 / D-P12-10) when a user's restricted template is
--     pulled out from under them and their page is repointed to editorial. Nullable;
--     the dashboard clears it on dismiss.
ALTER TABLE portfolios ADD COLUMN template_fallback_at TIMESTAMPTZ;

-- (3) template_grants — the (template_id × user_id) many-to-many mapping (GATE-01).
CREATE TABLE template_grants (
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- profiles(id), NOT auth.users (FK rationale above)
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by  UUID REFERENCES profiles(id),                              -- nullable audit (the seed grant → NULL; admin grants → the admin's id)
  PRIMARY KEY (template_id, user_id)                                     -- composite natural key, no surrogate id
);

-- The own-grant SELECT (012) and the allowed-list read (12-04) filter by user_id;
-- the composite PK leads with template_id, so a user_id-leading index serves those.
CREATE INDEX idx_template_grants_user ON template_grants(user_id);
