-- =============================================================================
-- 018_tombstone_edgerunner_v1.sql
-- TOMBSTONE the orphaned `edgerunner` v1 template (…0004) — the DATA half of the
-- D-21 v1 cleanup. The CODE half (deregister from registry.ts / specRegistry /
-- TEMPLATE_UUIDS + the CI slug-anchor surfaces + delete the edgerunner/ folder) ships
-- in the SAME commit (lockstep), so no slug is left dangling.
--
-- CONTEXT. 015 seeded `edgerunner` (v1, …0004, restricted) and switched the founder onto
-- it. 016 then made `edgerunner-v2` (…0005) the founder's DURABLE live template and
-- switched the founder OFF v1 (`016:84-88` moved …0004 → …0005). After 016 the v1 row +
-- the founder's orphaned v1 grant remained ONLY as dead state — no portfolio is on …0004
-- (verified pre-migration: 0 rows). 016's own header (line 27-29) flagged "Fully removing
-- v1 (registry + folder + row) is a separate, optional cleanup" — this migration is that
-- cleanup, on the SC-2 SSG/ISR + gate-coverage wave (D-21).
--
-- IDEMPOTENT. Both DELETEs are unconditional set operations keyed on the v1 identifiers,
-- so a re-apply is a clean no-op (the rows are already gone). Mirrors 016's idempotency
-- posture (`016:63-82` ON CONFLICT … DO UPDATE/DO NOTHING — converges to the same state
-- whether the rows pre-exist or not).
--
-- ORDERING. Step 1 (DELETE the grant) BEFORE Step 2 (DELETE the template): `template_grants`
-- has a FK to `templates(id)`; deleting the grant first avoids relying on ON DELETE CASCADE
-- ordering and makes the intent explicit (remove the founder's orphaned …0004 grant, then
-- the now-unreferenced template row).
--
-- SAFETY. The founder is on edgerunner-v2 (…0005), NOT v1 — confirmed no live portfolio
-- references …0004 before this runs. After removal, `slugForTemplateId(…0004)` resolves no
-- UUID and safely degrades to 'minimal' (registry.ts:114-116) — but no row points at …0004,
-- so that degrade path is unreachable in practice. T-13.2-21 (dangling slug) is mitigated by
-- the lockstep registry edit in the same commit.
--
-- FORWARD migration (no `db reset` — D-21; a reset wipes the founder seed). Apply via
-- `npx supabase migration up`.
-- =============================================================================

-- ── Step 1 — DELETE the founder's orphaned v1 grant (…0004). ──
--    Idempotent: a no-op once the grant is gone. Done BEFORE the template DELETE so the
--    FK from template_grants → templates is never the thing forcing the order.
DELETE FROM template_grants
 WHERE template_id = '00000000-0000-4000-8000-000000000004'::uuid;

-- ── Step 2 — DELETE the orphaned v1 template row (the `edgerunner` slug, …0004). ──
--    Keyed by slug for human-readability (the slug↔id pin is 1:1 — registry.ts:98 / the
--    015 seed). Idempotent: a no-op once the row is gone. No portfolio references it (the
--    founder moved to v2 in 016), so this leaves the templates table fully coherent.
DELETE FROM templates
 WHERE slug = 'edgerunner';
