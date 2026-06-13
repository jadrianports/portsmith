/**
 * Account-settings request-body validation (ACCT-01..04, D-12).
 *
 * The net-new server-boundary parse contract for the Wave-2 account actions:
 * the change-email action (D-07) and the delete-account route (D-09/D-12). As
 * with every platform write (CLAUDE.md), the action/route RE-PARSES these
 * schemas server-side before any privileged call — the client parse is UX only.
 *
 * `changeEmailSchema` REUSES the single-source `canonicalEmail` from `auth.ts`
 * (same `.trim().toLowerCase().pipe(z.email(...).max(320))` IN-04 canonicalizer)
 * rather than re-authoring it — one canonical email rule for the whole platform,
 * and no chained `z.string().email()` (the validator stays the top-level
 * `z.email()` inside `canonicalEmail`).
 *
 * The password-change action reuses the existing `updatePasswordSchema`
 * (`auth.ts`, min 8 / max 72) — it is NOT re-declared here.
 *
 * D-12: the delete confirmation requires the user to type their EXACT username
 * plus their current password. The schema only asserts both fields are present
 * (non-empty strings); the type-exact-username MATCH is asserted in the route
 * against the verified profile username (the schema has no knowledge of the
 * caller's identity), and the current-password is fed to the D-01 reauth gate.
 */
import { z } from 'zod';

import { canonicalEmail } from './auth';

/**
 * Change-email body (D-07). `email` = the canonical NEW address; `current_password`
 * is verified by the D-01 reauth gate before `updateUser({ email })`. A bare
 * `.min(1)` on the password — the reauth verify is the real check, not a length
 * rule (the new password is not being SET here).
 */
export const changeEmailSchema = z.object({
  email: canonicalEmail,
  current_password: z.string().min(1, { error: 'Your current password is required' }),
});

/**
 * Delete-account body (D-09 / D-12). `username` is the typed confirmation gate —
 * the route asserts it equals the verified profile username EXACTLY before the
 * destructive sweep + `admin.deleteUser`. `current_password` feeds the D-01
 * reauth gate. The schema enforces presence only; identity-matching is the
 * route's job.
 */
export const deleteAccountSchema = z.object({
  username: z.string().min(1, { error: 'Type your username to confirm' }),
  current_password: z.string().min(1, { error: 'Your current password is required' }),
});

export type ChangeEmail = z.infer<typeof changeEmailSchema>;
export type DeleteAccount = z.infer<typeof deleteAccountSchema>;
