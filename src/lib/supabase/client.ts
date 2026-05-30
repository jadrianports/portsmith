import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client (Client Components only).
 *
 * Uses the PUBLIC anon key — `NEXT_PUBLIC_*` env, shipped to the browser by
 * design. RLS (not key secrecy) is the data boundary. Never import the
 * service-role client (`./service-role`) from a Client Component.
 *
 * In a browser, `@supabase/ssr` falls back to `document.cookie` for the auth
 * session automatically, so no cookie wiring is needed here.
 *
 * TODO(01-08): parameterize with the generated `Database` type
 *   (`createBrowserClient<Database>(...)`) once Plan 08 runs `supabase gen
 *   types` and creates `src/types/database.ts`. Until then the client is
 *   untyped (`Database = any`) so this module builds cleanly.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
