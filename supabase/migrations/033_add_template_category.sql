-- =============================================================================
-- 033_add_template_category.sql
--
-- 37-01 / TCAT-01: add the profession `category` to every template. This is the
-- SINGLE DB SOURCE OF TRUTH (D-02) that the dashboard picker + onboarding gallery
-- group by (Plan 02) — `category` rides `getAvailableTemplates()` onto the
-- `AllowedTemplate` interface as a plain serializable prop, exactly the way
-- `restricted` already flows into the zod-free picker.
--
-- SOFT-ENUM, NO CHECK (CMS-08, D-05). `category` is a plain TEXT column with NO
-- `CHECK` constraint — the same soft-enum posture as `sections.type` and
-- `templates.visibility`. A future profession (e.g. the reserved `video` slot, or
-- any new category) needs NO migration to the COLUMN; a new template simply seeds
-- its `category` value. Known values this milestone: dev / marketer / creative /
-- video / general.
--
-- DB-LEVEL DEFAULT 'general' (D-05, Claude's discretion). The column carries a
-- DEFAULT 'general' as belt-and-suspenders alongside the Task-2 app-layer
-- `?? 'general'` fallback (`getAvailableTemplates()`), so a future un-categorized
-- seed degrades safely at BOTH layers and never drops an allowed card.
--
-- NO NEW GRANT (D-05). The `templates` table is ALREADY platform-granted, and an
-- ADD COLUMN inherits the existing table grants — so this migration adds NO `GRANT`
-- statement. (Mirrors migration 032's documented "no new GRANT needed" note. The
-- TCAT-01 "explicit role GRANTs" wording is the new-TABLE rule, NOT the ADD-COLUMN
-- rule.)
--
-- IDEMPOTENCY. `ADD COLUMN IF NOT EXISTS` makes the schema change a clean no-op on
-- re-apply; the label UPDATEs set the same values each run (re-running is a no-op).
-- We label ONLY the 5 live rows: minimal=dev, editorial=general, aurora=marketer,
-- edgerunner-v2=dev, atelier=creative. The retired v1 `edgerunner` slug was DELETEd
-- in migration 018, so it is intentionally NOT labeled here. The trailing guard
-- (WR-01) is a READ-ONLY fresh-apply check — it RAISEs if an expected slug matched
-- zero rows and was left at the `'general'` default; on an already-categorized DB it
-- passes silently (a no-op), so it is safe to re-apply.
--
-- FORWARD migration (apply via `supabase migration up`, NEVER `db reset` — a reset
-- drops seed data + platform role grants). Regenerate `src/types/database.ts` after
-- (the CLI gen-types `--db-url` workaround — see project memory).
-- =============================================================================

ALTER TABLE templates ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

-- Label the 5 live template rows (idempotent — re-running sets the same values).
UPDATE templates SET category = 'dev'      WHERE slug = 'minimal';
UPDATE templates SET category = 'general'  WHERE slug = 'editorial';
UPDATE templates SET category = 'marketer' WHERE slug = 'aurora';
UPDATE templates SET category = 'dev'      WHERE slug = 'edgerunner-v2';
UPDATE templates SET category = 'creative' WHERE slug = 'atelier';

-- FRESH-APPLY GUARD (WR-01). A `WHERE slug = …` that matches zero rows is a SILENT
-- success in Postgres — a misspelled/retired/not-yet-seeded slug would be left at the
-- `'general'` DEFAULT with NO error, mis-grouping that template. Fail LOUD instead:
-- count the expected live rows still stuck at `'general'` (excluding `editorial`, which
-- is intentionally `'general'`) and RAISE if any remain. READ-ONLY + idempotent — on an
-- already-correctly-labeled DB the count is 0 and this block is a no-op.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM templates
   WHERE slug IN ('minimal','editorial','aurora','edgerunner-v2','atelier')
     AND category = 'general' AND slug <> 'editorial';
  IF n > 0 THEN
    RAISE EXCEPTION 'Phase 37: % expected template row(s) left uncategorized (slug missing at apply time)', n;
  END IF;
END $$;
