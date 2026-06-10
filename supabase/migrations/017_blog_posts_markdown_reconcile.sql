-- =============================================================================
-- 017_blog_posts_markdown_reconcile.sql
-- Reconcile the pre-existing Phase-1 `blog_posts` table to the Markdown-source
-- model (D-01 / D-08) and add a capped per-post edit history (D-07).
--
-- ADR-009 REVERSAL. `001_initial_schema.sql:150-167` created `blog_posts` with
-- `body JSONB NOT NULL` ("Tiptap document JSON, not HTML" — ADR-009). Phase 13.2
-- pivots blog storage to MARKDOWN SOURCE (D-08: one source of truth, no stored
-- HTML/JSON drift; markdown is rendered server-side at ISR time). This migration
-- therefore REVERSES ADR-009 for `blog_posts`: `body JSONB` becomes `body_md TEXT`.
--
-- This is an ALTER + reconcile, NOT a CREATE — the table, its RLS policies
-- (`004:162-177`), the three-layer `public_blog_posts` view (`005:162-184`), and
-- the `blog_post_is_public()` DEFINER helper (`002:198-208`) ALREADY EXIST and are
-- KEPT. See 13.2-RESEARCH § Open Questions Q-DB for the exact recipe (a)-(g).
--
-- The `blog_posts` table is empty (0 rows verified pre-apply; nothing inserts into
-- it — the founder's posts are still static React), so the `body #>> '{}'` cast in
-- step (a) is a safe no-op. The cast is written defensively regardless.
--
-- FORWARD migration (no `db reset` — a reset wipes the founder seed from 016 + the
-- local data; D-21). Apply via `supabase migration up`. Statements are written to
-- be idempotent / re-runnable where the grammar allows (IF NOT EXISTS / OR REPLACE
-- / DROP ... IF EXISTS) so re-applying converges.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (a) body JSONB -> body_md TEXT  (Q-DB recipe a)
--     The existing public_blog_posts view (`005:176-182`) SELECTs `body`, so the
--     column cannot be retyped while the view depends on it
--     ("cannot alter type of a column used by a view or rule", SQLSTATE 0A000).
--     DROP the view FIRST; it is re-created against `body_md` in step (e).
--     The `#>> '{}'` extracts the JSONB document as text (a no-op on the empty
--     table); RENAME makes the Markdown-source intent explicit.
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.public_blog_posts;

ALTER TABLE public.blog_posts ALTER COLUMN body TYPE TEXT USING (body #>> '{}');
ALTER TABLE public.blog_posts RENAME COLUMN body TO body_md;

-- -----------------------------------------------------------------------------
-- (b) display_date (D-05) — owner-editable display date; the index sorts by this.
--     NO stored `reading_time` column: it is computed on read (D-06 / D-08 spirit;
--     a stored copy would drift from body_md).
-- -----------------------------------------------------------------------------
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS display_date DATE;

-- -----------------------------------------------------------------------------
-- (c) KEEP cover_image_url / cover_image_alt / meta_title / meta_description
--     nullable — deferred features may use them later; dropping is destructive
--     and gains nothing (Q-DB recipe c). No statement needed; documented for intent.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- (d) blog_post_history + capped (5) history trigger (D-07).
--     Mirrors section_history (`001:249-256`) + save_section_history
--     (`002:542-568`) — but prunes to 5, NOT 10 (D-07: 64 KB bodies x auto-save
--     would eat free-tier storage). SECURITY DEFINER is REQUIRED — the history
--     table is trigger-write-only (own-SELECT RLS, NO insert/delete policy), so a
--     plain INVOKER trigger INSERT would violate RLS and block the very UPDATE it
--     hangs off (the exact save_section_history fix, `002:530-540`).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_post_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  body_md TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_post_history_post
  ON public.blog_post_history(blog_post_id, created_at DESC);

ALTER TABLE public.blog_post_history ENABLE ROW LEVEL SECURITY;

-- Own-SELECT only (join blog_posts -> portfolios, check owner). NO insert/update/
-- delete policy — populated ONLY by the save_blog_post_history trigger (DEFINER
-- context). Mirrors the section_history policy (`004:274-281`).
DROP POLICY IF EXISTS "blog_post_history own select" ON public.blog_post_history;
CREATE POLICY "blog_post_history own select"
  ON public.blog_post_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.blog_posts
    JOIN public.portfolios ON portfolios.id = blog_posts.portfolio_id
    WHERE blog_posts.id = blog_post_history.blog_post_id
      AND portfolios.user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.save_blog_post_history()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.blog_post_history (blog_post_id, body_md)
    VALUES (OLD.id, OLD.body_md);

  -- Prune this post's history to the 5 most-recent rows (D-07: cap at 5; the
  -- section trigger caps at 10).
  DELETE FROM public.blog_post_history
    WHERE blog_post_id = OLD.id
      AND id NOT IN (
        SELECT id FROM public.blog_post_history
          WHERE blog_post_id = OLD.id
          ORDER BY created_at DESC
          LIMIT 5
      );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS capture_blog_post_history ON public.blog_posts;
CREATE TRIGGER capture_blog_post_history
  BEFORE UPDATE OF body_md ON public.blog_posts
  FOR EACH ROW
  WHEN (OLD.body_md IS DISTINCT FROM NEW.body_md)
  EXECUTE FUNCTION public.save_blog_post_history();

-- -----------------------------------------------------------------------------
-- (e) Reconcile public_blog_posts: swap body -> body_md + add display_date.
--     The three-layer stack stays: anon table-SELECT REVOKE + column-level GRANT
--     of public columns only + security_invoker view filtered by the DEFINER
--     helper blog_post_is_public(id) (published post AND published portfolio).
--     The `published` draft flag stays OFF the anon grant + the view.
--     (The view was already dropped in step (a) so the column retype could run;
--     the DROP below is a re-runnability backstop only.)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.public_blog_posts;

-- Re-grant the public columns to anon, swapping body -> body_md and adding
-- display_date. (REVOKE SELECT on the base table was issued in 005 and persists
-- through the rename; the GRANT below is re-stated against the renamed column.)
REVOKE SELECT ON public.blog_posts FROM anon;
GRANT  SELECT (
         id, portfolio_id, title, slug, body_md, excerpt, display_date,
         cover_image_url, cover_image_alt, meta_title, meta_description,
         tags, published_at
       )
       ON public.blog_posts TO anon;

-- VISIBILITY VIA DEFINER HELPER: anon has no privilege on the draft-only
-- `published` flag, so an inline `WHERE published = true` would raise "permission
-- denied" under security_invoker. blog_post_is_public(id) (`002:198-208`) reads
-- `published`/`portfolio_id` as its owner and is UNAFFECTED by the rename.
CREATE VIEW public.public_blog_posts
  WITH (security_invoker = true) AS
  SELECT id, portfolio_id, title, slug, body_md, excerpt, display_date,
         cover_image_url, cover_image_alt, meta_title, meta_description,
         tags, published_at
  FROM public.blog_posts
  WHERE public.blog_post_is_public(id);

GRANT SELECT ON public.public_blog_posts TO anon;

-- -----------------------------------------------------------------------------
-- (f) The "blog_posts public select" + "blog_posts own all" RLS policies
--     (`004:162-177`) reference `published` / `portfolio_id` only — unaffected by
--     the body -> body_md rename. Left in place intentionally.
-- -----------------------------------------------------------------------------
