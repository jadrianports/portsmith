/**
 * `redirectIfRenamedHandle` — the HANDLE-02 old-handle → current-handle 308 redirect
 * (D-01/D-02/D-03), called at each public route's post-read `notFound()` site.
 *
 * When a published portfolio was NOT found for `oldHandle`, this resolves the
 * `public_username_redirects` view (old_handle → the user's CURRENT username) and, on a
 * hit, `permanentRedirect`s (HTTP 308 — Google treats it as SEO-equivalent to 301) to
 * `'/' + current + subPath`, preserving the sub-path. Because the view joins history to
 * the user's CURRENT handle, an `A → B → C` chain resolves both `/A` and `/B` to `/C` in
 * a SINGLE hop (D-01). On a genuine miss (no history row, or the row resolves to the same
 * handle / a non-public target) it RETURNS, and the caller then `notFound()`s.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ COOKIE-LESS (D-22, LOAD-BEARING — mirrors get-portfolio.ts): this builds a     │
 * │ plain anon `createClient` from `@supabase/supabase-js` with the NEXT_PUBLIC_*  │
 * │ env + `persistSession: false`. It MUST NOT import `src/lib/supabase/server.ts` │
 * │ (whose `await cookies()` would flip the 4 public routes DYNAMIC, killing ISR    │
 * │ and the perf budget). The lookup runs only on a MISS, so a live portfolio never │
 * │ pays for it. Placed at the post-read genuine-not-found site, before any         │
 * │ templateSpec.pages gate (Pitfall 11 — the destination still applies its gate).  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * SECURITY: reads ONLY `public_username_redirects` (old_handle + current_username) — never
 * the base `username_history.user_id`. The redirect target is composed from the joined
 * current handle (a validated `[a-z][a-z0-9-]*` username) + a fixed sub-path literal, never
 * raw user input — so there is no open-redirect to an arbitrary host (T-30-11).
 */
import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { permanentRedirect } from 'next/navigation';

import type { Database } from '@/types/database';

/**
 * Resolve a renamed `oldHandle` to its current handle and 308-redirect to
 * `'/' + current + subPath`. Returns on a miss (caller then calls `notFound()`); throws
 * `NEXT_REDIRECT` (terminating the render) on a hit.
 *
 * @param oldHandle the handle from the URL that yielded no published portfolio.
 * @param subPath   the preserved sub-path ('' | '/blog' | '/blog/<slug>' | '/services').
 */
export async function redirectIfRenamedHandle(
  oldHandle: string,
  subPath = '',
): Promise<void> {
  // Cookie-LESS anon client — keeps the public routes ISR-cacheable (D-22, Pitfall 4).
  const db = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await db
    .from('public_username_redirects')
    .select('current_username')
    .eq('old_handle', oldHandle)
    .maybeSingle();

  // A read error or a genuine miss → caller notFound()s (never mask a 404 on a blip).
  if (error || !data) return;

  const current = data.current_username;
  // No resolved current handle (target not public), or the row resolves to the same
  // handle → treat as a miss, let the caller notFound().
  if (!current || current === oldHandle) return;

  // Hit: 308 permanent redirect preserving the sub-path. Throws NEXT_REDIRECT.
  permanentRedirect('/' + current + subPath);
}
