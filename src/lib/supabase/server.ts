import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Server Supabase client (Server Components, Route Handlers, Server Actions).
 *
 * Cookie-based auth via `@supabase/ssr`. `cookies()` is ASYNC in Next 16 — it
 * returns a Promise, so we `await` it and read/write through `getAll`/`setAll`.
 *
 * The `setAll` loop is wrapped in try/catch on purpose: in a Server Component
 * the response headers are already sent / read-only, so writing cookies throws.
 * That is harmless because the middleware (`./middleware` → `updateSession`)
 * refreshes and persists the session cookies on every request. The try/catch is
 * the canonical Supabase SSR pattern.
 *
 * TODO(01-08): parameterize with the generated `Database` type
 *   (`createServerClient<Database>(...)`) once Plan 08 runs `supabase gen
 *   types`. Until then the client is untyped (`Database = any`) so this module
 *   builds cleanly.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Safe to ignore — middleware refreshes the session cookies.
          }
        },
      },
    },
  );
}

/**
 * Returns the VERIFIED identity for server-side authorization (AUTH-05).
 *
 * Uses `getClaims()`, which validates the JWT signature against the project's
 * published asymmetric keys (locally, no network round-trip when keys are
 * cached) — Supabase's current recommendation. Returns `null` when there is no
 * valid session.
 *
 * NEVER use `getSession()` for authorization in server code: it reads cookies
 * WITHOUT verifying the JWT and is spoofable. `getSession()` is for non-security
 * UI hints only, and is intentionally not exported here.
 */
export async function getVerifiedClaims() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return data.claims;
}
