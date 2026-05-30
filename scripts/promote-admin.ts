/**
 * scripts/promote-admin.ts — one-time admin bootstrap (ADR-015).
 *
 * `role` is a PROTECTED column (the `enforce_protected_profile_columns` trigger,
 * Plan 01-06, blocks any UPDATE of `role` from a normal client). No user can
 * self-promote. The FIRST admin is created by this one-off tool: it connects with
 * the SERVICE-ROLE key, which bypasses both RLS and the protected-columns trigger
 * (the trigger's admin/service short-circuit plus the service-role bypass are the
 * sole sanctioned path to set `role`).
 *
 * USAGE:  set ADMIN_EMAIL in .env.local, then `npm run promote-admin`
 *         (-> `tsx scripts/promote-admin.ts`).
 *
 * THIS IS NOT RUNTIME APP CODE. It is a manual, one-time tool. `ADMIN_EMAIL` is
 * NEVER read by the running app — there is no env-var runtime promotion path
 * (ADR-015: chosen over a runtime bootstrap that would leave permanent "magic"
 * promotion code in the app). Run it once after signing up; run it again only if
 * you rebuild the database.
 *
 * IMPORTANT: this script constructs its OWN standalone admin client with
 * `@supabase/supabase-js`. It deliberately does NOT import
 * `src/lib/supabase/service-role.ts`, because that module begins with
 * `import 'server-only'`, which throws when imported outside a Next.js server
 * bundle (i.e. under `tsx`). The key rules are identical: the service-role key
 * has no NEXT_PUBLIC_ prefix and is never bundled; the URL is public.
 */
import { createClient } from '@supabase/supabase-js';

// Load .env.local so `npm run promote-admin` works without manual `export`s.
// dotenv is a devDependency; ignore if absent (env may already be exported).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
} catch {
  // dotenv not installed / unavailable — rely on the ambient process env.
}

function fail(message: string): never {
  console.error(`[promote-admin] ERROR: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!adminEmail) {
    fail(
      'ADMIN_EMAIL is not set. Set it in .env.local to the email of the account ' +
        'to promote, then re-run `npm run promote-admin`.',
    );
  }
  if (!supabaseUrl) {
    fail('NEXT_PUBLIC_SUPABASE_URL is not set.');
  }
  if (!serviceRoleKey) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY is not set. This script needs the service-role ' +
        'key (server-only, no NEXT_PUBLIC_ prefix) to bypass RLS and set `role`.',
    );
  }

  // Standalone admin client — bypasses RLS + the protected-columns trigger.
  // Stateless: no session persistence, no token refresh.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Find the profile by email. `email` is a private column on `profiles`; the
  // service-role client reads it directly (RLS-bypassing).
  const { data: profile, error: lookupError } = await admin
    .from('profiles')
    .select('id, email, role')
    .eq('email', adminEmail)
    .maybeSingle();

  if (lookupError) {
    fail(`profile lookup failed: ${lookupError.message}`);
  }
  if (!profile) {
    fail(
      `no profile found for ADMIN_EMAIL="${adminEmail}". Sign up through the ` +
        'normal flow first, then re-run this script.',
    );
  }

  if (profile.role === 'admin') {
    console.log(
      `[promote-admin] profile ${adminEmail} (${profile.id}) is already admin — nothing to do.`,
    );
    return;
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', profile.id);

  if (updateError) {
    fail(`failed to set role=admin for ${adminEmail}: ${updateError.message}`);
  }

  console.log(
    `[promote-admin] SUCCESS: ${adminEmail} (${profile.id}) is now role=admin.`,
  );
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
