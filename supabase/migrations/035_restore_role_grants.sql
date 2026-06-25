-- =============================================================================
-- 035_restore_role_grants.sql
--
-- CI-GREEN FIX (the 3rd layer): `supabase db reset` (run in CI) DROPS the Supabase
-- platform-default base-privilege grants that the CORE tables (profiles, portfolios,
-- sections, portfolio_settings, messages, page_views, … created in 001–005) leaned on
-- INSTEAD of granting explicitly. Without them, `authenticated` + `service_role` get
-- Postgres error 42501 (permission denied) on those tables, so the entire RLS
-- integration suite fails in CI with "expected { code: '42501' } to be null". Locally it
-- passes because the dev stack is built FORWARD (`supabase migration up`), which never
-- drops those grants. (Documented project gotcha: "db reset drops role grants".)
--
-- This migration re-asserts those base privileges so `db reset` (which re-runs every
-- migration, this one LAST) restores them. The newer tables (draft_shares/analytics_events/
-- username_history) already GRANT explicitly in their own migrations; this `ON ALL TABLES`
-- catch-all covers the core tables that never did + any future omission.
--
-- SECURITY — this does NOT weaken anything:
--   • `authenticated` DML is still gated row-by-row by RLS (the `*.own_all` policies on
--     `auth.uid()`); a table-level GRANT only restores the CAPABILITY the platform default
--     already implied — RLS is the actual tenant boundary, unchanged.
--   • `service_role` is the trusted admin role that intentionally BYPASSES RLS (used only by
--     the server-side `supabaseAdmin` routes); restoring its grants changes nothing about
--     who can call it (`import 'server-only'` + the service-role key gate are untouched).
--   • `anon` is DELIBERATELY NOT TOUCHED here. Its access stays EXACTLY the explicit
--     three-layer model from migration 005 (table-wide REVOKE + public-column GRANT +
--     `security_invoker` view GRANT), which `db reset` re-applies. A broad
--     `GRANT … TO anon` would clobber the column-level REVOKEs that keep email/role/etc.
--     off the public surface — so it is intentionally absent.
--
-- IDEMPOTENT + PROD-SAFE: re-granting an already-held privilege is a no-op, so this is safe
-- to re-apply and is a NO-OP on production (where the grants were never dropped — prod is
-- built forward via `migration up`). FORWARD migration (apply via `supabase migration up`).
-- =============================================================================

-- Schema usage (needed to reference any object in `public`).
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

-- Base table DML on every existing public table (RLS gates the rows for `authenticated`;
-- `service_role` bypasses RLS by design). Mirrors the per-table grants the newer migrations
-- already bake, applied catch-all to the core tables that relied on the platform default.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;

-- Sequences (SERIAL / identity columns need USAGE+SELECT for INSERTs to allocate ids).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
