/**
 * Phase-gate smoke flow #1 — signup -> confirm -> dashboard (AUTH-01/02) plus
 * the legal-link assertion (SAFE-05). 02-VALIDATION.md E2E rows; docs/07 flow #1.
 *
 * This is the cross-cutting proof that the Wave-1/2 slices (signup action +
 * /signup form, the /auth/confirm verifyOtp route, the Supabase email config)
 * compose into a working funnel end-to-end against the REAL local stack — it
 * reads the REAL confirmation link out of the local mail catcher (not a mocked
 * token), so a regression anywhere in the chain fails this test.
 *
 * MAIL CATCHER — MAILPIT, not Inbucket. The plan text says "Inbucket :54324",
 * but this Supabase CLI ships MAILPIT at :54324 with a different HTTP API
 * (02-02-SUMMARY recorded the live link shape coming from Mailpit). We use the
 * Mailpit API:
 *   - GET  /api/v1/messages          -> { messages: [{ ID, To, Subject }...] } (newest first)
 *   - GET  /api/v1/message/{ID}      -> { HTML, Text, ... }
 *   - DELETE /api/v1/messages        -> clear the inbox
 *
 * ORIGIN — the confirm email link carries `http://127.0.0.1:3000` (config.toml
 * site_url; verified in 02-02-SUMMARY). `127.0.0.1` and `localhost` are distinct
 * cookie origins, so we run the whole flow on `127.0.0.1:3000` (playwright
 * baseURL) and `page.goto` the EXACT url parsed from the email — we never
 * reconstruct the origin. That keeps the signup page, the confirm navigation,
 * and the auth-token cookie all on one origin.
 *
 * /dashboard does NOT exist yet (it's a later phase, and is intentionally NOT in
 * this plan's files). After confirm, verifyOtp sets the session and redirects to
 * /dashboard, which renders Next's 404 body — but the navigation DOES reach
 * `/dashboard` with the session cookie set. We assert (a) pathname === /dashboard
 * and (b) a Supabase auth-token cookie is present; we do NOT assert on the 404
 * body. That is exactly the plan's "or the dashboard placeholder" allowance.
 *
 * TURNSTILE — the Cloudflare always-pass TEST keys are in `.env.local`; `next
 * dev` loads them and the widget auto-solves, enabling submit. We wait for the
 * submit button to become enabled (token populated) before submitting. If the
 * Turnstile script genuinely cannot load (no network), the funnel test skips
 * with a loud message rather than false-greening the phase gate.
 *
 * CLEANUP — a unique `*@example.test` email per run; the created auth user is
 * deleted via the service-role admin API afterward so the flow is repeatable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

const MAILPIT_URL = 'http://127.0.0.1:54324';
const SIGNUP_ORIGIN = 'http://127.0.0.1:3000';

/** Service-role admin client for repeatable cleanup of the created test user. */
function adminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[e2e] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — start the local ' +
        'stack and ensure .env.local is loaded (playwright.config.ts loads it).',
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface MailpitMessageSummary {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

/** Clear the Mailpit inbox so we only ever read this run's confirmation email. */
async function clearMailpit(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
}

/** Poll Mailpit for the newest message addressed to `email`; returns its ID. */
async function waitForMessageId(email: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const target = email.toLowerCase();
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    if (res.ok) {
      const body = (await res.json()) as { messages?: MailpitMessageSummary[] };
      const match = (body.messages ?? []).find((m) =>
        (m.To ?? []).some((t) => t.Address?.toLowerCase() === target),
      );
      if (match) return match.ID;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`[e2e] No confirmation email for ${email} arrived in Mailpit within ${timeoutMs}ms`);
}

/** Fetch a message body and extract the /auth/confirm?token_hash=...&type=email link. */
async function extractConfirmUrl(messageId: string): Promise<string> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/message/${messageId}`);
  if (!res.ok) throw new Error(`[e2e] Mailpit message fetch failed: ${res.status}`);
  const body = (await res.json()) as { HTML?: string; Text?: string };
  const haystack = `${body.HTML ?? ''}\n${body.Text ?? ''}`;
  // The template emits {{ .SiteURL }}/auth/confirm?token_hash=...&type=email&next=/dashboard
  const match = haystack.match(/https?:\/\/[^\s"'<>]*\/auth\/confirm\?[^\s"'<>]+/i);
  if (!match) {
    throw new Error('[e2e] Could not find an /auth/confirm link in the confirmation email');
  }
  // Decode any HTML entities (e.g. &amp;) so query params survive intact.
  return match[0].replace(/&amp;/g, '&');
}

test.describe('signup funnel (AUTH-01/02 + SAFE-05)', () => {
  // Unique per-run identity so the flow is repeatable and never collides.
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const email = `e2e-${token}@example.test`;
  const username = `e2e${token}`.slice(0, 30); // starts with a letter, [a-z0-9], <=30
  const password = 'Sup3rSecret-pw';

  test.afterAll(async () => {
    // Repeatable-run cleanup: delete the created auth user (cascades to profile).
    try {
      const admin = adminClient();
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const user = (data?.users ?? []).find(
        (u) => (u.email ?? '').toLowerCase() === email.toLowerCase(),
      );
      if (user) await admin.auth.admin.deleteUser(user.id);
    } catch {
      // Best-effort: a cleanup hiccup must never mask the real test result.
    }
  });

  test('signup -> confirm (real Mailpit link) -> dashboard with a session', async ({
    page,
    context,
  }) => {
    // `next dev` cold-compiles /signup, /check-email, and /auth/confirm on first
    // hit (Windows, Next 16) and the Turnstile widget loads remotely — the 30s
    // Playwright default is too tight. Give generous headroom so the inner
    // Turnstile-skip fallback (25s) can actually fire within the test budget
    // instead of the whole test timing out first.
    test.setTimeout(120_000);

    await clearMailpit();

    // 1) Sign up on the SAME origin the email link will carry (127.0.0.1:3000).
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

    await page.getByLabel('Email', { exact: true }).fill(email);
    // `exact` avoids matching the password show/hide toggle (aria-label "Show password").
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByRole('checkbox').check();

    // The always-pass Turnstile auto-solves; the submit button is disabled until
    // the token populates. Wait for it to enable (proof the widget loaded). If it
    // never enables (no network for the Turnstile script), skip loudly rather
    // than false-green the phase gate.
    const submit = page.getByRole('button', { name: 'Create account' });
    try {
      // Inner budget < whole-test budget (120s) so the loud Turnstile-skip
      // fallback can fire if the widget genuinely cannot load/auto-solve.
      await expect(submit).toBeEnabled({ timeout: 25_000 });
    } catch {
      test.skip(
        true,
        'Cloudflare Turnstile script did not load / auto-solve (likely no network ' +
          'for challenges.cloudflare.com) — the always-pass token never populated, ' +
          'so submit stayed disabled. PHASE-GATE SMOKE WAS SKIPPED, NOT GREEN.',
      );
      return;
    }

    await submit.click();

    // 2) Generic post-signup interstitial (D-07) — /check-email.
    await expect(page).toHaveURL(/\/check-email/);
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

    // 3) Read the REAL confirmation link from Mailpit and navigate to it directly
    //    (exact origin from the email — do NOT reconstruct it).
    const messageId = await waitForMessageId(email);
    const confirmUrl = await extractConfirmUrl(messageId);
    expect(confirmUrl).toContain('/auth/confirm');
    expect(confirmUrl).toContain('token_hash=');
    expect(confirmUrl).toContain('type=email');
    // The link carries the config.toml site_url origin (127.0.0.1:3000) — same as baseURL.
    expect(confirmUrl).toContain(SIGNUP_ORIGIN);

    await page.goto(confirmUrl);

    // 4) verifyOtp established the session and redirected to /dashboard. That
    //    route does not exist yet (later phase) so the BODY is a 404, but the
    //    navigation reaches /dashboard AND a Supabase auth-token cookie is set.
    //    Assert the pathname + the session cookie — NOT the 404 body.
    await expect(page).toHaveURL(/\/dashboard(\/|\?|$)/);

    const cookies = await context.cookies();
    const authCookie = cookies.find((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
    expect(
      authCookie,
      'Expected a Supabase auth-token cookie after confirm (proves the session was established)',
    ).toBeTruthy();
  });
});

test('the signup ToS link reaches /legal and the Terms & Privacy page renders (SAFE-05)', async ({
  page,
}) => {
  await page.goto('/signup');

  // The ToS checkbox label carries the legal link: "I agree to the Terms & Privacy."
  const legalLink = page.getByRole('link', { name: 'Terms & Privacy' }).first();
  await expect(legalLink).toHaveAttribute('href', '/legal');
  await legalLink.click();

  await expect(page).toHaveURL(/\/legal$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Terms & Privacy' })).toBeVisible();
  // The D-09 provisional-boilerplate banner must be present.
  await expect(
    page.getByText('provisional boilerplate text', { exact: false }),
  ).toBeVisible();
  // Both sections render.
  await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
});
