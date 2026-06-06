-- =============================================================================
-- 013_seed_template_visibility.sql
-- Phase 12 (Template Gating — public / exclusive) — Plan 12-02, Task 3
--
-- The visibility + founder-grant SEED (DATA only — no schema change). It does THREE
-- things, idempotently, in this order (MUST run AFTER 011 adds the column/table +
-- 012 adds RLS):
--   (A) editorial → 'public'                     (D-P12-03)
--   (B) minimal, aurora → 'restricted'           (D-P12-04 / D-P12-05; explicit +
--       idempotent — also the safe-by-default 011 DEFAULT already set them, but we
--       set them explicitly so the seed is self-describing and re-appliable)
--   (C) the founder → minimal grant, derived FROM DATA (never a hardcoded username):
--       INSERT…SELECT the user_id of whatever portfolio is on the pinned minimal
--       UUID, so the founder (the only minimal portfolio) is granted his own
--       template. `ON CONFLICT (template_id, user_id) DO NOTHING` makes it a clean
--       no-op on re-apply.
--
-- WHY DERIVE THE FOUNDER FROM DATA (008's posture, `008:59-64`): the founder's
-- portfolio is resolved BY template_id (the pinned minimal UUID), NEVER by a
-- hardcoded `jadrianports` username — so this seed is correct regardless of who the
-- minimal portfolio belongs to in any environment.
--
-- AURORA GETS NO GRANT ROW (D-P12-05 / D-P12-12): aurora is restricted but ungranted
-- here. Kyle (user #2, the marketer) is granted aurora MANUALLY in /admin after he
-- signs up — there is no portfolio on aurora to derive a grant from at seed time.
--
-- THE FRESH-DB ORDERING LANDMINE (OQ-1): on a brand-new DB, if
-- `scripts/seed-founder-portfolio.ts` runs AFTER this migration, no portfolio is on
-- minimal when (C) runs → the INSERT…SELECT matches zero rows → the founder→minimal
-- grant is never created → the founder is ungranted-restricted on his OWN template.
-- FIX (OQ-1, recommended): `seed-founder-portfolio.ts` ALSO upserts the founder→minimal
-- grant (self-healing, order-independent) — so the grant exists whether the migration
-- or the seed script runs first. This migration's (C) covers the
-- migration-after-seed order; the seed-script upsert covers the seed-after-migration
-- order. Both are idempotent on the composite PK.
--
-- The pinned minimal UUID literal `00000000-0000-4000-8000-000000000001` MUST equal
-- `src/components/templates/registry.ts` TEMPLATE_UUIDS.minimal.
--
-- FORWARD migration (after 011 + 012). No `db reset`.
-- =============================================================================

-- (A) editorial → public (D-P12-03)
UPDATE templates SET visibility = 'public'
 WHERE slug = 'editorial';

-- (B) minimal + aurora → restricted (D-P12-04 / D-P12-05; explicit + idempotent)
UPDATE templates SET visibility = 'restricted'
 WHERE slug IN ('minimal', 'aurora');

-- (C) founder → minimal grant, derived from data (never a hardcoded username).
--     granted_by = NULL (a seed grant has no granting admin — the nullable audit col).
INSERT INTO template_grants (template_id, user_id, granted_by)
SELECT '00000000-0000-4000-8000-000000000001'::uuid, p.user_id, NULL
  FROM portfolios p
 WHERE p.template_id = '00000000-0000-4000-8000-000000000001'::uuid   -- pinned minimal UUID == registry
ON CONFLICT (template_id, user_id) DO NOTHING;

-- aurora: NO grant row (D-P12-05 / D-P12-12) — Kyle is granted manually in /admin
-- after signup.
