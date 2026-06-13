/**
 * Auth request-body validation (AUTH-01..04, D-09).
 *
 * The parse contract for the Wave-2 server actions (signup / login / reset /
 * update-password). Those actions RE-PARSE these schemas server-side before any
 * Supabase auth call — client-side parse is UX only; the server-boundary parse
 * is the real gate (CLAUDE.md, contact.ts posture). A direct `auth.signUp` that
 * skips the form is still blocked because the action gates on `signupSchema`.
 *
 * Shared rules are not re-authored here: `username` reuses the single-source
 * `usernameSchema` (format + reserved guard). Zod 4 top-level validators
 * (`z.email()`, never chained `z.string().email()`) + the unified `{ error }`
 * message key, matching the rest of the platform schemas.
 *
 * Password cap: `.max(72)` — Supabase/bcrypt truncates at 72 bytes, so capping
 * here avoids silent-truncation surprises. `.min(8)` is the sane minimum.
 *
 * Email canonicalization (IN-04): every email field is `.trim().toLowerCase()`-d
 * at the schema boundary so the disposable-email check, the stored auth row, and
 * later logins all agree on ONE canonical form — mixed-case or whitespace-padded
 * input can never split an identity. `usernameSchema` already lowercases via its
 * own regex/transform, so it is left untouched.
 */
import { z } from 'zod';

import { usernameSchema } from './username';

/**
 * A canonical email (IN-04). We FIRST normalize the raw input — `.trim()` strips
 * stray whitespace and `.toLowerCase()` canonicalizes case — then `.pipe()` the
 * cleaned string through the top-level `z.email()` validator + length cap. Order
 * matters: the trim/lowercase must run BEFORE validation, otherwise a
 * whitespace-padded value would fail the email check before it could be cleaned.
 * (The normalizing `z.string()` carries NO `.email()` of its own — the platform's
 * "no chained `z.string().email()`" rule is about the VALIDATOR, which still lives
 * in the top-level `z.email()` on the pipe target.)
 */
export const canonicalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'A valid email is required' }).max(320));

/** Signup body — gated server-side by Turnstile + the disposable-email check (Wave 2). */
export const signupSchema = z.object({
  email: canonicalEmail,
  password: z
    .string()
    .min(8, { error: 'Password must be at least 8 characters' })
    .max(72, { error: 'Password must be at most 72 characters' }), // bcrypt 72-byte cap
  username: usernameSchema,
  turnstile_token: z.string().min(1, { error: 'Please complete the verification' }),
  // D-09: ToS acceptance is mandatory — only the literal `true` is valid.
  tos_accepted: z.literal(true, { error: 'You must accept the Terms to continue' }),
});

/** Login body — enumeration-safe (the action returns a generic invalid-credentials message). */
export const loginSchema = z.object({
  email: canonicalEmail,
  password: z.string().min(1, { error: 'Password is required' }),
});

/** Forgot-password request body — always answered generically (enumeration-safe). */
export const resetRequestSchema = z.object({
  email: canonicalEmail,
});

/** Update-password body (recovery session) — same 8–72 cap as signup. */
export const updatePasswordSchema = z.object({
  password: z
    .string()
    .min(8, { error: 'Password must be at least 8 characters' })
    .max(72, { error: 'Password must be at most 72 characters' }),
});

export type Signup = z.infer<typeof signupSchema>;
export type Login = z.infer<typeof loginSchema>;
export type ResetRequest = z.infer<typeof resetRequestSchema>;
export type UpdatePassword = z.infer<typeof updatePasswordSchema>;
