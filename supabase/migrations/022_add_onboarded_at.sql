-- =============================================================================
-- 022_add_onboarded_at.sql
-- Phase 18 (Onboarding Wizard) — Plan 18-01, Wave 1
--
-- ONE additive thing, no destructive change to profiles (D-01):
--   (1) A `profiles.onboarded_at TIMESTAMPTZ` completion marker. Nullable, NO
--       default, NO NOT NULL — `null` means "not yet onboarded" (the D-02 dashboard
--       gate routes `onboarded_at IS NULL` users into the wizard). It is stamped
--       ONLY at the wizard's Publish step (D-14), in the same authenticated RLS
--       UPDATE that flips `published=true` (`markOnboardedAndPublish()`).
--
--       The column itself carries NO backfill semantics — a brand-new row is born
--       null (not yet onboarded). The single UPDATE below is a belt-and-suspenders
--       FOUNDER backfill: the already-published founder (jadrianports) is stamped
--       `now()` so the D-02 first-run gate never bounces an existing published user
--       back through the wizard (ONB-05: finished users are never forced back).
--
-- PROTECTED-COLUMNS POSTURE (T-18-onboarded-col): `onboarded_at` is deliberately
-- NOT one of the 8 columns guarded by `enforce_protected_profile_columns`
-- (002_functions_triggers.sql:108-118 — username/role/locked/locked_reason/
-- storage_used_bytes/deleted_at/email/created_at). So the authenticated owner may
-- write it directly under RLS exactly as it writes `published` — no privilege
-- escalation, no protected-columns trigger trip. The trigger still guards the 8.
--
-- DECISIONS:
--   D-01  additive nullable `onboarded_at` timestamptz; stamped at the publish step.
--   D-02  the `/dashboard` RSC gate routes `onboarded_at IS NULL → /onboarding`.
--   D-14  publish reuses `publish-action` + stamps `onboarded_at` in the same flow.
--
-- FORWARD migration (after 021). No `db reset` required — runs forward with
-- `supabase migration up`. Purely additive, so the founder seed + template grants
-- survive. Regenerate database.ts after applying (D-01).
-- =============================================================================

-- (1) Additive completion marker (D-01). Nullable, NO default — null = not yet
--     onboarded. A brand-new profile row is born null.
ALTER TABLE public.profiles
  ADD COLUMN onboarded_at TIMESTAMPTZ;   -- nullable; null = not yet onboarded (D-01)

-- Belt-and-suspenders FOUNDER backfill: any ALREADY-published profile is stamped
-- `now()` so the D-02 first-run gate never bounces an existing published user
-- (the founder, jadrianports) back into the wizard (ONB-05). New/unpublished rows
-- stay null and correctly route into onboarding on first dashboard visit.
UPDATE public.profiles SET onboarded_at = now() WHERE published = true;
