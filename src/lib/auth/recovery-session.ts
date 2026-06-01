/**
 * Recovery-session predicate (CR-01) — extracted from `reset-actions.ts`.
 *
 * WHY A SEPARATE MODULE: `reset-actions.ts` is a `'use server'` module, and Next 16
 * (Turbopack production build) requires EVERY export of a `'use server'` module to
 * be an async function (Server Actions). `isRecoverySession` is a pure synchronous
 * predicate, so it cannot live as an export of that module without failing
 * `next build` ("Server Actions must be async functions"). It lives here, in a
 * plain (non-`'use server'`) module, and `reset-actions.ts` imports it for the
 * `updatePassword` gate. Behaviour is unchanged.
 */

/**
 * The `amr` (authentication methods reference) entries gotrue stamps on a session
 * minted by the password-RECOVERY OTP. A `verifyOtp({ type: 'recovery' })` session
 * carries `{ method: 'otp' }` in this gotrue version; older/other builds may label
 * it `'recovery'`. A normal `signInWithPassword` session carries `{ method:
 * 'password' }`, which is exactly what this gate must reject.
 */
const RECOVERY_AMR_METHODS = new Set(['otp', 'recovery']);

/**
 * True iff the verified claims describe a password-RECOVERY session — i.e. some
 * `amr` entry's `method` is a recovery/otp method (CR-01). Returns false for a
 * normal password session, for claims without an `amr` array, and for null/
 * undefined/malformed input. The integration suite pins the exact gate against
 * REAL claims from the live stack (recovery vs password session).
 */
export function isRecoverySession(claims: unknown): boolean {
  if (!claims || typeof claims !== 'object') return false;
  const amr = (claims as { amr?: unknown }).amr;
  if (!Array.isArray(amr)) return false;
  return amr.some(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      RECOVERY_AMR_METHODS.has((entry as { method?: unknown }).method as string),
  );
}
