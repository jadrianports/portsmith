import 'server-only';

import MailChecker from 'mailchecker';

/**
 * Server-side disposable/temp-email guard (SAFE-01 / D-03 / T-02-08).
 *
 * Wraps `mailchecker` (a bundled static blocklist of ~55k+ disposable domains,
 * updated via dependency bump — no live API/MX check, which would collide with
 * the $0 constraint). This runs in the signup action BEFORE `auth.signUp`, next
 * to the Turnstile verify — a client-only check is bypassable (Pitfall 4), so the
 * server boundary owns it.
 *
 * `import 'server-only'` keeps it on the server (it has no secret, but the gate
 * must never be a client decision). `MailChecker.isValid(email)` takes the FULL
 * email (not a domain) and returns `true` for a deliverable, well-formed,
 * NON-disposable address — so a disposable/malformed address is `!isValid`.
 *
 * Zod already validates email FORMAT upstream; this is the disposable/temp gate
 * (belt-and-suspenders on format). Rejection surfaces the specific D-04 message
 * at the action — disposable rejection is NOT an enumeration vector, so it is
 * exempt from the D-07 generic treatment.
 */
export function isDisposableEmail(email: string): boolean {
  return !MailChecker.isValid(email);
}
