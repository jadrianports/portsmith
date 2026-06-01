'use server';

/**
 * Server-fronted signup action — the gate (AUTH-01, SAFE-01, D-05, D-07, D-09).
 *
 * This is the funnel's front door and the highest-stakes security surface in the
 * phase. It is a Server Action (`'use server'`) so a bot CANNOT bypass Turnstile
 * by calling `supabase.auth.signUp` directly — the server boundary owns every
 * gate, and the gates run in this EXACT order (a failure at step N never reaches
 * step N+1):
 *
 *   1. signupSchema.safeParse  — Zod re-parse server-side. Client parse is UX
 *      only; THIS is the real gate (contact.ts posture). Field errors on failure.
 *   2. tos_accepted required    — D-09. The `z.literal(true)` in the schema already
 *      enforces this, surfaced as a `tos_accepted` field error.
 *   3. verifyTurnstile          — D-05. Raw siteverify (server-only) BEFORE signUp.
 *   4. isDisposableEmail        — SAFE-01 / D-03. Bundled blocklist BEFORE signUp;
 *      rejection shows the specific D-04 message (NOT an enumeration vector).
 *   5. supabase.auth.signUp     — passes `options.data = { username, display_name }`
 *      so the live `handle_new_user` trigger (Phase 1) creates the profile, and
 *      `emailRedirectTo` → `${NEXT_PUBLIC_SITE_URL}/auth/confirm`.
 *
 * Enumeration-safety (D-07 / T-02-07): an already-registered email returns the
 * IDENTICAL generic "check your email" outcome as a fresh signup — the action
 * NEVER branches the result on whether the email exists. The check-email page
 * renders the same copy in both cases.
 *
 * Verified-identity discipline carries over: this action never calls
 * `getSession()` (the AUTH-05 guard test greps for it); it does not need identity
 * at all here — `signUp` writes the session cookies via the `@supabase/ssr`
 * server client.
 */
import { headers } from 'next/headers';

import { createClient } from '@/lib/supabase/server';
import { signupSchema } from '@/lib/validations';

import { isDisposableEmail } from './disposable-email';
import { verifyTurnstile } from './turnstile';

/** Per-field validation messages, keyed by the signup field name. */
export type SignupFieldErrors = Partial<
  Record<'email' | 'password' | 'username' | 'turnstile_token' | 'tos_accepted', string>
>;

/**
 * The signup outcome. On success (AND on an already-registered email — D-07) the
 * shape is `{ ok: true, email }`, identical in both cases. On failure it is
 * `{ ok: false, error?, fieldErrors? }`.
 */
export type SignupResult =
  | { ok: true; email: string }
  | { ok: false; error?: string; fieldErrors?: SignupFieldErrors };

const DISPOSABLE_MESSAGE =
  "Disposable or temporary email addresses aren't allowed — please use a permanent address.";
const TURNSTILE_MESSAGE = 'Please complete the verification.';
const GENERIC_ERROR = 'Something went wrong. Please try again.';

/** Best-effort client IP from the request headers (passed to siteverify). */
async function clientIp(): Promise<string | undefined> {
  try {
    const h = await headers();
    const fwd = h.get('x-forwarded-for');
    if (fwd) return fwd.split(',')[0]?.trim() || undefined;
    return h.get('x-real-ip') ?? undefined;
  } catch {
    return undefined;
  }
}

export async function signupAction(input: unknown): Promise<SignupResult> {
  // 1) Zod re-parse (server gate). Covers email/password/username format, the
  //    required non-empty turnstile_token, and tos_accepted === true (step 2).
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: SignupFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !(key in fieldErrors)) {
        (fieldErrors as Record<string, string>)[key] = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  const { email, password, username, turnstile_token } = parsed.data;

  // 3) Turnstile siteverify (D-05) — BEFORE any account creation.
  const ip = await clientIp();
  const human = await verifyTurnstile(turnstile_token, ip);
  if (!human) {
    return { ok: false, fieldErrors: { turnstile_token: TURNSTILE_MESSAGE } };
  }

  // 4) Disposable-email block (SAFE-01 / D-03) — BEFORE any account creation.
  if (isDisposableEmail(email)) {
    return { ok: false, error: DISPOSABLE_MESSAGE };
  }

  // 5) Create the account. The live handle_new_user trigger reads options.data.
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: username },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  });

  // A hard error (rate-limit, network, weak-password policy) → generic message.
  // We do NOT inspect the returned user for an already-registered signal: with
  // email confirmation on, Supabase obfuscates that case by design, and branching
  // on it would be an enumeration leak (D-07). Success and already-registered both
  // fall through to the identical generic outcome below.
  if (error) {
    return { ok: false, error: GENERIC_ERROR };
  }

  // Enumeration-safe: identical outcome whether the email was new or existing.
  return { ok: true, email };
}
