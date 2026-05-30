import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Service-role (admin) Supabase client — the FND-05 isolation boundary.
 *
 * `import 'server-only'` (the FIRST line, intentionally) turns any attempt to
 * import this module from a Client Component into a BUILD ERROR — the
 * compile-time wall that keeps the service-role key out of every browser
 * bundle. CI also greps `.next/static` for the key value as a regression
 * backstop (see .github/workflows/ci.yml).
 *
 * The service-role key BYPASSES RLS, so this client is the sole holder of that
 * key and must only be imported by server-side code:
 *   - the contact route handler (Plan 06)
 *   - the page-view logger (Plan 03)
 *   - scripts/promote-admin.ts (Plan 08)
 *
 * Key rules:
 *   - `SUPABASE_SERVICE_ROLE_KEY` has NO `NEXT_PUBLIC_` prefix → never bundled.
 *   - `NEXT_PUBLIC_SUPABASE_URL` is public by design and OK to read here.
 *   - `persistSession: false` / `autoRefreshToken: false` — this is a stateless
 *     server client, not a user session.
 *
 * TODO(01-08): parameterize with the generated `Database` type
 *   (`createClient<Database>(...)`) once Plan 08 runs `supabase gen types` and
 *   creates `src/types/database.ts`. Until then the client is untyped
 *   (`Database = any`) so this module builds cleanly.
 */
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY is not set — the service-role client cannot be created.',
  );
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
