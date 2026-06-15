-- =============================================================================
-- 023_activation_events_and_funnel.sql
-- Phase 21 (Activation Funnel · Contact Notify) — Plan 21-02, Wave 1
--
-- The data-layer foundation for the activation funnel (ACTV-01/ACTV-03). PURELY
-- ADDITIVE — no destructive change to any existing table, no edit to
-- handle_new_user()/initialize_portfolio(). One new event-source table + its
-- index + own-INSERT RLS, one new signup trigger on profiles, and one new
-- admin-self-gated aggregate funnel RPC:
--
--   (1) public.activation_events — the honest, event-sourced milestone store
--       (D-05). Write-once per (user_id, event_type) so each milestone is recorded
--       at most once ('signup' | 'first_save' | 'first_publish'). Deriving the
--       funnel from timestamps is REJECTED (D-05): initialize_portfolio() seeds 7
--       placeholder sections at signup (created_at == updated_at), which would
--       pollute any derived first-save signal, and `portfolios` has no
--       `published_at`. The event source is the only honest signal.
--
--   (2) record_signup_activation() + its AFTER INSERT ON profiles trigger — records
--       the 'signup' event for EVERY signup, degrade-open (D-06/Discretion #2). A
--       SEPARATE trigger, NOT an edit to handle_new_user (see Task 2 below).
--
--   (3) activation_funnel_counts() — an is_admin()-self-gated SECURITY DEFINER
--       aggregate RPC returning per-stage funnel counts, admin-excluded,
--       aggregates-only (D-07/D-08). The ONLY read path (no SELECT RLS policy).
--
-- NO FOUNDER BACKFILL (D-08): unlike migration 022 (which DID backfill the
-- already-published founder's `onboarded_at` — 022:44, `UPDATE ... WHERE
-- published = true`), this migration DELIBERATELY contains NO equivalent UPDATE.
-- The founder predates this migration, so they simply have zero activation_events
-- rows (the signup trigger only fires for post-migration signups; first_save /
-- first_publish only fire on future actions). Combined with the RPC's
-- `WHERE pr.role <> 'admin'` exclusion (Discretion #3), the operator/founder never
-- inflates the funnel — which matters at launch scale where 1 counts (Pitfall 6).
--
-- DECISIONS:
--   D-05  event-sourced (not timestamp-derived); write-once via UNIQUE(user,type).
--   D-06  the signup event fires at signUp (in the profile-create path), degrade-open.
--   D-07  the funnel read is one admin-gated aggregate RPC (per-stage counts).
--   D-08  NO founder backfill; admin/founder excluded from the counts.
--   D-10  ON DELETE CASCADE (via profiles, which cascades from auth.users).
--   D-16  the table has NO SELECT RLS policy — the DEFINER RPC is the only read.
--
-- FORWARD migration (after 022). No `db reset` required — runs forward with
-- `supabase migration up`. Purely additive, so the founder seed + template grants
-- survive. Regenerate src/types/database.ts after applying (so activation_events /
-- activation_funnel_counts become typed before any code consumes them — 21-03).
-- =============================================================================

-- (1) Additive event-source table (D-05). Soft-enum `event_type` (TEXT, NO CHECK —
--     a 4th event type later is a code change, not a migration). FK target is
--     public.profiles(id) NOT auth.users (Discretion #1): every other `public`
--     table references `public` tables; profiles.id IS auth.users.id (1:1,
--     profiles.id REFERENCES auth.users(id) ON DELETE CASCADE — 001:54), so this
--     FK still delivers D-10's account-deletion cascade (auth.users delete →
--     profiles delete → activation_events delete); and the funnel RPC joins
--     activation_events → profiles on `role`, so the FK target IS the join target.
--     UNIQUE(user_id, event_type) is the write-once mechanism (D-05).
CREATE TABLE public.activation_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,                 -- soft-enum: 'signup' | 'first_save' | 'first_publish' (+ future, no migration)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type)               -- write-once per (user, event) (D-05)
);

-- Event-type-leading index backing the funnel RPC's per-stage
-- `count(*) FILTER (WHERE event_type = …)` scan + admin-exclusion join, WITHOUT
-- needing the user_id prefix. The UNIQUE(user_id, event_type) constraint already
-- provides a (user_id, event_type) btree (serves the write-once conflict check +
-- per-user lookups); ship both for honesty + future scale (Discretion #1).
CREATE INDEX idx_activation_events_type ON public.activation_events (event_type);

-- RLS: enable + an own-INSERT policy ONLY (D-16). The first_save / first_publish
-- actions insert their OWN verified `sub` under this policy (never anon, never
-- service-role forging another tenant's milestone). The signup event is written by
-- the DEFINER trigger (which bypasses RLS). There is NO SELECT policy — the table
-- is read ONLY via the admin-gated activation_funnel_counts() DEFINER RPC, so a
-- normal authenticated user can never read another tenant's (or their own) raw
-- milestone rows. Mirrors the page_views write-only-from-authenticated posture.
ALTER TABLE public.activation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY activation_events_own_insert ON public.activation_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());         -- the action inserts its own verified sub only

-- (2) Signup event — a SEPARATE trigger on profiles INSERT (Discretion #2), NOT an
--     edit to handle_new_user() and NOT inside initialize_portfolio(). Rationale:
--       - initialize_portfolio() is the WRONG home: it fires at first dashboard load
--         (auth.uid()-gated, idempotent early-return — 002:334-368), so it would MISS
--         the signup moment and never fire for a user who signs up but never opens the
--         dashboard. The signup moment is the profile-create path (handle_new_user,
--         AFTER INSERT ON auth.users — 002:281-331) at the signUp call (D-06: fires at
--         signUp, before email confirmation).
--       - We do NOT edit handle_new_user's body: it has CR-02/CR-03 security carve-outs
--         + an `EXCEPTION WHEN unique_violation` block; adding an event insert there
--         risks that clause swallowing the WRONG error. A separate trigger keeps
--         handle_new_user byte-unchanged, fires atomically in the same transaction as
--         the profile insert (unbypassable), and covers EVERY profile-create path incl.
--         future OAuth.
--     SECURITY DEFINER so the insert bypasses RLS in the GoTrue/auth-admin execution
--     context (same reason handle_new_user is DEFINER — 002:253-262). Degrade-open:
--     ON CONFLICT DO NOTHING (write-once) + `EXCEPTION WHEN OTHERS THEN RETURN NEW` so a
--     failed event insert NEVER blocks account creation (T-21-06).
CREATE OR REPLACE FUNCTION public.record_signup_activation()
RETURNS TRIGGER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.activation_events (user_id, event_type)
    VALUES (NEW.id, 'signup')
    ON CONFLICT (user_id, event_type) DO NOTHING;   -- write-once, best-effort
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;   -- degrade-open: a failed event insert NEVER blocks signup (T-21-06)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER record_signup_activation_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.record_signup_activation();

-- (3) The aggregate funnel RPC (D-07) — mirrors 019's DEFINER RPCs VERBATIM:
--     LANGUAGE plpgsql, SECURITY DEFINER SET search_path = '', every object
--     public.-qualified, the is_admin() self-gate as the FIRST body statement, GRANT
--     TO authenticated only. Returns ONLY per-stage aggregate counts (never raw
--     activation_event rows — D-16). The DEFINER context bypasses RLS, so the inner
--     `IF NOT public.is_admin() THEN RAISE` is the REAL (and only) authorization
--     (T-21-03); the empty search_path + public.-qualified refs close the
--     search-path-hijack footgun.
--     ADMIN-EXCLUSION (Discretion #3 / D-08): JOIN profiles, filter `role <> 'admin'`
--     so the operator/founder never inflates the funnel. `role` is NOT NULL DEFAULT
--     'user' (001), so `<>` has no null-role edge case. Combined with the no-founder-
--     backfill posture above, the founder contributes zero either way (Pitfall 6).
CREATE OR REPLACE FUNCTION public.activation_funnel_counts()
RETURNS TABLE (signup BIGINT, first_save BIGINT, first_publish BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Self-gate (DEFINER bypasses RLS — this is the REAL authorization). T-21-03.
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
    SELECT
      count(*) FILTER (WHERE e.event_type = 'signup')::bigint,
      count(*) FILTER (WHERE e.event_type = 'first_save')::bigint,
      count(*) FILTER (WHERE e.event_type = 'first_publish')::bigint
    FROM public.activation_events e
    JOIN public.profiles pr ON pr.id = e.user_id
    WHERE pr.role <> 'admin';            -- admin/founder excluded (D-08 / Discretion #3)
END;
$$;
GRANT EXECUTE ON FUNCTION public.activation_funnel_counts() TO authenticated;
