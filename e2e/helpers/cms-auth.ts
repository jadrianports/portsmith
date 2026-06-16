/**
 * Shared E2E auth + owner-bootstrap helper for the Phase-4 CMS specs
 * (cms-loop / keyboard-reorder / dirty-guard — 04-10).
 *
 * WHY A COOKIE-INJECTED SESSION (not the signup→Mailpit funnel, not UI login):
 *   The Phase-2 `auth-signup.spec.ts` already PROVES the signup → Mailpit confirm
 *   → dashboard funnel end-to-end, and login is proven by that session model too.
 *   Re-driving a UI login per CMS test is flaky in Next 16 dev: the login `<form>`
 *   is a client island, and a click BEFORE hydration native-GET-submits (the
 *   action never runs). Rather than fight that race, we establish the session
 *   DETERMINISTICALLY using the SAME `@supabase/ssr` serialization the app uses:
 *     1. create a CONFIRMED owner via the service-role admin API (the SAME
 *        `auth.admin.createUser({ email_confirm: true })` idiom the integration
 *        fixtures use — it exercises the real `handle_new_user` trigger that
 *        provisions the profile row from `user_metadata`);
 *     2. bootstrap that owner's portfolio by calling the real idempotent
 *        `initialize_portfolio` RPC as the owner — so the editor loads the enriched
 *        D-P4-07 placeholder content;
 *     3. sign in with `@supabase/ssr`'s `createServerClient` against a captured
 *        cookie jar, then REPLAY those exact cookies (the library's own
 *        `sb-…-auth-token` chunked, base64-encoded session format) into the
 *        Playwright browser context. The app's middleware/server read them byte-for-
 *        byte the way they would after a real login — same `getClaims()` path.
 *
 * ORIGIN (load-bearing): everything runs on the Playwright `baseURL`
 * (`http://127.0.0.1:3000`). `127.0.0.1` and `localhost` are DISTINCT cookie
 * origins, so the cookies are injected for the `127.0.0.1` domain and the whole
 * dashboard → preview flow stays on the baseURL via RELATIVE `page.goto('/...')`.
 * The public `/[username]` read is cookie-less so its origin is irrelevant.
 *
 * LOCAL STACK ONLY — `*@example.test` is a reserved test domain; this reads the
 * local-stack service-role key from `.env.local` (loaded by playwright.config.ts)
 * and never touches production.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { expect, type Page } from '@playwright/test';

/** A confirmed test owner with a bootstrapped (unpublished) placeholder portfolio. */
export interface TestOwner {
  id: string;
  email: string;
  password: string;
  username: string;
  displayName: string;
  /** The owner's bootstrapped portfolio id (from the real initialize_portfolio RPC). */
  portfolioId: string;
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `[e2e] Missing env var ${name}. Start the local stack (\`supabase start\`) ` +
        'and ensure .env.local is loaded (playwright.config.ts loads it).',
    );
  }
  return value;
}

function supabaseUrl(): string {
  return requireEnv('SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}
function anonKey(): string {
  return requireEnv('SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
function serviceRoleKey(): string {
  return requireEnv('SUPABASE_SERVICE_ROLE_KEY');
}

/** Service-role admin client — BYPASSES RLS. Setup/cleanup only. */
function adminClient(): SupabaseClient {
  return createClient(supabaseUrl(), serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * The cookie domain for the injected session — MUST match the Playwright
 * `baseURL` host in playwright.config.ts (`http://127.0.0.1:3000`). `127.0.0.1`
 * and `localhost` are distinct cookie origins, so this is load-bearing.
 */
const BASE_HOST = '127.0.0.1';

/** A fresh per-run token so usernames/emails never collide across runs. */
function runToken(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Create a CONFIRMED owner via the admin API and bootstrap their portfolio via
 * the real idempotent `initialize_portfolio` RPC (as the owner). The created
 * portfolio is UNPUBLISHED (a fresh account), with the enriched D-P4-07
 * placeholder sections — exactly what the dashboard editor loads.
 *
 * `prefix` keeps usernames readable per spec; pass a short [a-z] string.
 */
export async function createConfirmedOwner(prefix: string): Promise<TestOwner> {
  const token = runToken();
  // username: starts with a letter, [a-z0-9], <= 30 chars (matches usernameSchema).
  const username = `${prefix}${token}`.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
  const email = `e2e-${token}@example.test`;
  const password = 'Test-Password-123!';
  const displayName = `E2E ${prefix} Owner`;

  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: displayName },
  });
  if (error || !data.user) {
    throw new Error(
      `[e2e] createConfirmedOwner failed for ${email}: ${error?.message ?? 'no user returned'}`,
    );
  }

  // Bootstrap the portfolio by calling the REAL idempotent RPC as the owner
  // (anon-key client signed in via password) — mirrors the integration fixtures.
  const owner = createClient(supabaseUrl(), anonKey(), {
    auth: { persistSession: false },
  });
  const { error: signInErr } = await owner.auth.signInWithPassword({ email, password });
  if (signInErr) {
    throw new Error(`[e2e] owner sign-in (for bootstrap) failed: ${signInErr.message}`);
  }
  const { data: portfolioId, error: rpcErr } = await owner.rpc('initialize_portfolio');
  if (rpcErr || !portfolioId) {
    throw new Error(
      `[e2e] initialize_portfolio failed for ${username}: ${rpcErr?.message ?? 'no id'}`,
    );
  }

  // Stamp `onboarded_at` so the owner clears the v2.5 first-run gate (phase 18, D-02):
  // a fresh owner has `onboarded_at IS NULL`, which the `/dashboard` RSC redirects into
  // `/onboarding` — so the editor the CMS specs drive never mounts. These owners model
  // an ESTABLISHED account opening the editor, so we mark them onboarded. `onboarded_at`
  // is a protected column; the service-role admin client bypasses the protected-columns
  // trigger the same way `setOwnerPublished`/`promoteToAdmin` do for `published`/`role`.
  const { error: onboardErr } = await admin
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', data.user.id);
  if (onboardErr) {
    throw new Error(`[e2e] stamping onboarded_at failed for ${username}: ${onboardErr.message}`);
  }

  return {
    id: data.user.id,
    email,
    password,
    username,
    displayName,
    portfolioId: portfolioId as unknown as string,
  };
}

/**
 * Sign the BROWSER in as `owner` through the real `/login` form, then wait until
 * the middleware has bounced us onto `/dashboard` with the real editor mounted.
 * Establishes the `@supabase/ssr` cookie triad for the baseURL origin.
 */
export async function signInAsOwner(page: Page, owner: TestOwner): Promise<void> {
  // 1) Mint the @supabase/ssr session cookies for this owner using the library's
  //    OWN serializer (createServerClient + a captured cookie jar), so the cookie
  //    name(s) + chunked base64 value format match exactly what the app's
  //    middleware/server read after a real login.
  const cookieJar: { name: string; value: string }[] = [];
  const ssr = createServerClient(supabaseUrl(), anonKey(), {
    cookies: {
      getAll() {
        return cookieJar.map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          const i = cookieJar.findIndex((c) => c.name === name);
          if (i >= 0) cookieJar[i].value = value;
          else cookieJar.push({ name, value });
        }
      },
    },
  });
  const { error } = await ssr.auth.signInWithPassword({
    email: owner.email,
    password: owner.password,
  });
  if (error) throw new Error(`[e2e] signInAsOwner sign-in failed: ${error.message}`);
  if (cookieJar.length === 0) {
    throw new Error('[e2e] signInAsOwner produced no auth cookies');
  }

  // 2) Inject those cookies into the browser context for the baseURL origin
  //    (127.0.0.1 — must match playwright.config.ts baseURL; `localhost` is a
  //    distinct cookie origin). httpOnly:false is fine for the test; the app reads
  //    them via the request cookie header either way.
  await page.context().addCookies(
    cookieJar.map(({ name, value }) => ({
      name,
      value,
      domain: BASE_HOST,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    })),
  );

  // 3) Land on the real editor — the middleware verifies the injected session
  //    (getClaims) and serves /dashboard; the H1 is the readiness beat.
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Your portfolio' })).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * Publish the owner's portfolio directly via the admin API (service-role bypasses
 * the protected-columns trigger for the `published` flag the same way the founder
 * seed does) — used by specs that need a LIVE public page WITHOUT driving the UI
 * publish button first. Returns once the flag is set; the caller still triggers a
 * revalidate by editing+saving or by polling the public page.
 */
export async function setOwnerPublished(owner: TestOwner, published: boolean): Promise<void> {
  const admin = adminClient();
  const { error } = await admin
    .from('profiles')
    .update({ published })
    .eq('id', owner.id);
  if (error) {
    throw new Error(`[e2e] setOwnerPublished(${published}) failed: ${error.message}`);
  }
}

/**
 * Promote an owner to `admin` via the service-role API (role is a protected column;
 * service-role bypasses the protected-columns trigger the same way the founder seed
 * does). Setup only — used by the /admin gating spec to reach the is_admin() surface.
 */
export async function promoteToAdmin(owner: TestOwner): Promise<void> {
  const admin = adminClient();
  const { error } = await admin.from('profiles').update({ role: 'admin' }).eq('id', owner.id);
  if (error) {
    throw new Error(`[e2e] promoteToAdmin failed for ${owner.username}: ${error.message}`);
  }
}

/** Delete the created owner (cascades to profile/portfolio/sections). Best-effort. */
export async function deleteOwner(owner: TestOwner | undefined): Promise<void> {
  if (!owner) return;
  try {
    const admin = adminClient();
    const { error } = await admin.auth.admin.deleteUser(owner.id);
    if (error && !/not found/i.test(error.message)) {
      // best-effort: a cleanup hiccup must never mask the real test result.
      // eslint-disable-next-line no-console
      console.warn(`[e2e] deleteOwner could not delete ${owner.id}: ${error.message}`);
    }
  } catch {
    // swallow — cleanup is best-effort.
  }
}

/**
 * Poll a public/preview URL until it both returns the expected HTTP status AND
 * (optionally) contains `expectText` in its body — the on-demand `revalidatePath`
 * is fast but not synchronous, so a short poll absorbs the few-hundred-ms purge
 * latency without a brittle fixed sleep. Returns the final status.
 */
export async function waitForPublicState(
  page: Page,
  path: string,
  opts: { status: number; expectText?: string; timeoutMs?: number },
): Promise<void> {
  const deadline = Date.now() + (opts.timeoutMs ?? 20_000);
  let lastStatus = -1;
  let lastBodyHadText = false;
  // Use a fresh request context tied to the page so we hit the same baseURL origin.
  const request = page.context().request;
  for (;;) {
    const res = await request.get(path);
    lastStatus = res.status();
    const statusOk = lastStatus === opts.status;
    let textOk = true;
    if (opts.expectText) {
      const body = await res.text();
      lastBodyHadText = body.includes(opts.expectText);
      textOk = lastBodyHadText;
    }
    if (statusOk && textOk) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `[e2e] waitForPublicState timed out for ${path}: ` +
          `last status ${lastStatus} (wanted ${opts.status})` +
          (opts.expectText
            ? `, body ${lastBodyHadText ? 'HAD' : 'did NOT have'} "${opts.expectText}"`
            : ''),
      );
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}
